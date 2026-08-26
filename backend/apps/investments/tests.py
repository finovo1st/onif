from decimal import Decimal
from unittest.mock import patch
from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.investments.models import Plan, Investment
from apps.investments.services import (
    distribute_direct_income,
    distribute_roi_for_investment,
    update_user_active_level,
)
from apps.wallet.models import Wallet, WalletTransaction
from apps.referrals.models import ReferralCommission
from apps.core.models import PlatformSettings

User = get_user_model()


def make_user(email, username, parent=None):
    u = User.objects.create_user(email=email, username=username, password='Pass123!')
    u.parent = parent
    u.save(update_fields=['parent'])
    return u


def make_active_investment(user, plan, cost=None):
    cost_val = Decimal(cost) if cost is not None else plan.cost
    trading_cap = plan.trading_capital
    max_ret = plan.max_total_return if plan.max_total_return else (trading_cap * plan.max_return_factor)
    inv = Investment.objects.create(
        user=user,
        plan=plan,
        cost=cost_val,
        trading_capital=trading_cap,
        amount=cost_val,
        max_return=max_ret,
        status=Investment.Status.ACTIVE,
        start_date=timezone.now().date(),
    )
    return inv


class WalletServiceTests(TestCase):
    def setUp(self):
        self.user = make_user('wallet@test.com', 'walletuser')

    def test_credit_wallet(self):
        from apps.wallet.services import credit_wallet
        tx = credit_wallet(
            self.user, Decimal('100.00'),
            WalletTransaction.Category.DEPOSIT, 'Test deposit'
        )
        self.user.wallet.refresh_from_db()
        self.assertEqual(self.user.wallet.balance, Decimal('100.00'))
        self.assertEqual(tx.balance_before, Decimal('0.00'))
        self.assertEqual(tx.balance_after, Decimal('100.00'))
        self.assertEqual(tx.transaction_type, WalletTransaction.TransactionType.CREDIT)

    def test_debit_wallet(self):
        from apps.wallet.services import credit_wallet, debit_wallet
        credit_wallet(self.user, Decimal('200.00'), WalletTransaction.Category.DEPOSIT)
        tx = debit_wallet(
            self.user, Decimal('50.00'), WalletTransaction.Category.WITHDRAWAL
        )
        self.user.wallet.refresh_from_db()
        self.assertEqual(self.user.wallet.balance, Decimal('150.00'))

    def test_debit_insufficient_balance_raises(self):
        from apps.wallet.services import debit_wallet
        with self.assertRaises(ValueError):
            debit_wallet(self.user, Decimal('999.00'), WalletTransaction.Category.WITHDRAWAL)


class DirectIncomeTests(TestCase):
    def setUp(self):
        self.plan = Plan.objects.create(
            name='Test Plan',
            cost=Decimal('120.00'),
            trading_capital=Decimal('5000.00'),
            max_return_factor=Decimal('350.00'),
            weekly_roi_rate=Decimal('1.5'),
        )
        # Build a 3-level chain
        self.level1 = make_user('l1@test.com', 'l1')  # top sponsor
        self.level2 = make_user('l2@test.com', 'l2', parent=self.level1)
        self.investor = make_user('inv@test.com', 'inv', parent=self.level2)

        # Give level1 and level2 an active investment so they have active directs
        make_active_investment(self.level2, self.plan)  # level1 has 1 active direct

    def test_direct_income_distributed_to_eligible_sponsor(self):
        # level2 has investor as direct child, and investor creates investment
        investment = make_active_investment(self.investor, self.plan, '120.00')

        commissions = distribute_direct_income(investment)
        # level2 has 1 active direct (investor). Level 1 threshold = 0 directs.
        # So level2 will receive Level 1 direct income from this investment.
        self.assertEqual(len(commissions), 1)
        self.assertEqual(commissions[0].amount, Decimal('100.00'))

    def test_direct_income_with_eligible_sponsor(self):
        # Add a second direct child to level2
        extra_user = make_user('extra@test.com', 'extra', parent=self.level2)
        make_active_investment(extra_user, self.plan)

        investment = make_active_investment(self.investor, self.plan, '120.00')
        commissions = distribute_direct_income(investment)

        # level2 now has 2 active directs (extra_user + investor) → unlocks Level 2
        # But this investment is on level 1 relative to them, so they get 1 commission.
        self.assertEqual(len(commissions), 1)

        # Check commission amount: 2% of 5000 = 100.00
        self.assertEqual(commissions[0].amount, Decimal('100.00'))
        self.assertEqual(commissions[0].user, self.level2)
        self.assertEqual(commissions[0].commission_type, ReferralCommission.CommissionType.DIRECT)


class ROIDistributionTests(TestCase):
    def setUp(self):
        self.plan = Plan.objects.create(
            name='ROI Plan',
            cost=Decimal('120.00'),
            trading_capital=Decimal('120.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('350.00'),
            weekly_roi_rate=Decimal('10.00'),  # 10% for easy math
        )
        self.investor = make_user('roi@test.com', 'roiuser')
        self.investment = make_active_investment(self.investor, self.plan)

    @patch('apps.investments.services._get_profit_days')
    def test_roi_credited_to_wallet(self, mock_profit_days):
        mock_profit_days.return_value = 5  # 5 profit days (full week)
        roi = distribute_roi_for_investment(self.investment)
        # 10% of 120 = 12.00
        self.assertEqual(roi, Decimal('12.00'))
        wallet = Wallet.objects.get(user=self.investor)
        self.assertEqual(wallet.balance, Decimal('12.00'))
        self.assertEqual(wallet.total_roi_earned, Decimal('12.00'))

    @patch('apps.investments.services._get_profit_days')
    def test_investment_marked_completed_when_max_return_reached(self, mock_profit_days):
        mock_profit_days.return_value = 5
        # Set total_credited close to max_return so next ROI tips it over
        self.investment.total_credited = Decimal('345.00')
        self.investment.save()

        roi = distribute_roi_for_investment(self.investment)
        # Remaining = 350 - 345 = 5. ROI calc = 12.00 but capped at 5.
        self.assertEqual(roi, Decimal('5.00'))

        self.investment.refresh_from_db()
        self.assertEqual(self.investment.status, Investment.Status.COMPLETED)

    @patch('apps.investments.services._get_profit_days')
    def test_completed_investment_skipped(self, mock_profit_days):
        mock_profit_days.return_value = 5
        self.investment.status = Investment.Status.COMPLETED
        self.investment.save()
        roi = distribute_roi_for_investment(self.investment)
        self.assertEqual(roi, Decimal('0.00'))

    @patch('apps.investments.services._get_profit_days')
    def test_roi_commission_distributed_to_eligible_sponsor_at_75_percent(self, mock_profit_days):
        mock_profit_days.return_value = 5
        # Create sponsor with an active plan and 2 active directs (meeting Level 1)
        sponsor = make_user('roisponsor@test.com', 'roisponsor')
        make_active_investment(sponsor, self.plan)

        # Set investor's parent to sponsor
        self.investor.parent = sponsor
        self.investor.save(update_fields=['parent'])

        # Add second child to sponsor to fulfill Level 1 unlock (>= 2 active directs)
        child2 = make_user('child2@test.com', 'child2', parent=sponsor)
        make_active_investment(child2, self.plan)

        # Distribute ROI for investor ($12.00 ROI)
        roi = distribute_roi_for_investment(self.investment)
        self.assertEqual(roi, Decimal('12.00'))

        # Sponsor should receive 75% of $12.00 = $9.00
        comm = ReferralCommission.objects.filter(user=sponsor, commission_type=ReferralCommission.CommissionType.ROI).first()
        self.assertIsNotNone(comm)
        self.assertEqual(comm.amount, Decimal('9.00'))
        self.assertEqual(comm.level, 1)

    @patch('apps.investments.services._get_profit_days')
    def test_prorated_roi(self, mock_profit_days):
        # Joined mid-week, got 3 profit days
        mock_profit_days.return_value = 3
        roi = distribute_roi_for_investment(self.investment)
        # Full week ROI = 12.00. 3 days = 12.00 * (3/5) = 7.20
        self.assertEqual(roi, Decimal('7.20'))

    def test_get_profit_days_helper(self):
        from apps.investments.services import _get_profit_days
        # Wed Oct 4 to Sat Oct 7
        d1 = date(2023, 10, 4)
        d2 = date(2023, 10, 7)
        self.assertEqual(_get_profit_days(d1, d2), 3) # Wed, Thu, Fri
        
        # Sun Oct 1 to Sat Oct 7
        d3 = date(2023, 10, 1)
        self.assertEqual(_get_profit_days(d3, d2), 5) # Mon-Fri


class ActiveLevelTests(TestCase):
    def setUp(self):
        self.plan = Plan.objects.create(
            name='Level Plan',
            cost=Decimal('120.00'),
            trading_capital=Decimal('5000.00'),
            max_return_factor=Decimal('350.00'),
            weekly_roi_rate=Decimal('1.5'),
        )
        self.sponsor = make_user('sponsor@test.com', 'sponsoruser')

    def test_active_level_one_with_no_directs(self):
        level = update_user_active_level(self.sponsor)
        self.assertEqual(level, 1)

    def test_active_level_two_with_two_active_directs(self):
        for i in range(2):
            child = make_user(f'child{i}@test.com', f'child{i}', parent=self.sponsor)
            make_active_investment(child, self.plan)
        level = update_user_active_level(self.sponsor)
        self.assertEqual(level, 2)


class InvestmentTaskTests(TestCase):
    def setUp(self):
        from apps.investments.models import Plan
        self.plan = Plan.objects.create(
            name='Task Plan',
            cost=Decimal('100.00'),
            trading_capital=Decimal('100.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('300.00'),
            weekly_roi_rate=Decimal('10.00'),
        )
        self.user = make_user('taskuser@test.com', 'taskuser')
        self.investment = make_active_investment(self.user, self.plan, '100.00')

    @patch('apps.investments.services._get_profit_days')
    def test_distribute_weekly_roi_task(self, mock_profit_days):
        mock_profit_days.return_value = 5
        from apps.investments.tasks import distribute_weekly_roi_task
        from apps.wallet.models import Wallet

        result = distribute_weekly_roi_task()
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['completed'], 0)
        self.assertEqual(result['errors'], 0)

        wallet = Wallet.objects.get(user=self.user)
        self.assertEqual(wallet.balance, Decimal('10.00'))


class InvestmentSerializerTests(TestCase):
    def setUp(self):
        from apps.investments.models import Plan
        self.plan = Plan.objects.create(
            name='Serializer Plan',
            cost=Decimal('100.00'),
            trading_capital=Decimal('100.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('300.00'),
            weekly_roi_rate=Decimal('10.00'),
            is_active=True
        )

    def test_investment_create_validation(self):
        from apps.investments.serializers import InvestmentCreateSerializer
        from rest_framework.test import APIRequestFactory
        
        user = make_user('seruser@test.com', 'seruser')
        user.kyc_status = user.KYCStatus.APPROVED
        user.save()
        
        request = APIRequestFactory().post('/')
        request.user = user

        # Test valid data
        data = {
            'plan': self.plan.id,
            'deposit_network': 'TRC20',
            'deposit_txn_hash': 'hash123'
        }
        serializer = InvestmentCreateSerializer(data=data, context={'request': request})
        self.assertTrue(serializer.is_valid())
        inv = serializer.save()
        self.assertEqual(inv.cost, Decimal('100.00'))
        self.assertEqual(inv.trading_capital, Decimal('100.00'))


from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

class InvestmentViewTests(APITestCase):
    def setUp(self):
        from apps.investments.models import Plan
        self.user = make_user('viewuser@test.com', 'viewuser')
        self.user.kyc_status = self.user.KYCStatus.APPROVED
        self.user.save()
        self.client.force_authenticate(user=self.user)
        
        self.plan = Plan.objects.create(
            name='View Plan',
            cost=Decimal('100.00'),
            trading_capital=Decimal('100.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('300.00'),
            weekly_roi_rate=Decimal('10.00'),
            is_active=True
        )

    def test_list_plans(self):
        url = reverse('plan_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)

    def test_create_investment(self):
        url = reverse('investment_list_create')
        data = {
            'plan': self.plan.id,
            'deposit_network': 'TRC20',
            'deposit_txn_hash': 'txnhash123'
        }
        response = self.client.post(url, data, format='json')
        if response.status_code != 201:
            print("Investment 400 error:", response.data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['cost'], '100.00')
        self.assertEqual(response.data['trading_capital'], '100.00')
        self.assertEqual(response.data['status'], 'DEPOSIT_PENDING')

    def test_admin_delete_plan(self):
        from apps.investments.models import Plan
        self.user.role = self.user.Role.ADMIN
        self.user.is_staff = True
        self.user.save()

        plan_to_del = Plan.objects.create(
            name='Temporary Plan',
            cost=Decimal('50.00'),
            trading_capital=Decimal('50.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('150.00'),
            weekly_roi_rate=Decimal('5.00'),
            is_active=True
        )
        url = reverse('admin_panel:plans_detail', kwargs={'pk': plan_to_del.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Plan.objects.filter(id=plan_to_del.id).exists())

    def test_admin_delete_plan_with_investments_protected(self):
        from apps.investments.models import Plan
        self.user.role = self.user.Role.ADMIN
        self.user.is_staff = True
        self.user.save()

        # self.plan has an investment created in test_create_investment or let's create one:
        make_active_investment(self.user, self.plan, Decimal('100.00'))
        url = reverse('admin_panel:plans_detail', kwargs={'pk': self.plan.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Plan.objects.filter(id=self.plan.id).exists())
