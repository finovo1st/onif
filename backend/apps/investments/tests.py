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

    def test_single_referral_earns_direct_income_but_roi_is_blocked_until_two_directs(self):
        # Sponsor has 1 active investment
        sponsor = make_user('single_sponsor@test.com', 'single_sponsor')
        sponsor_inv = make_active_investment(sponsor, self.plan)

        # 1. Sponsor refers 1 user (investor)
        self.investor.parent = sponsor
        self.investor.save(update_fields=['parent'])

        # Direct income IS earned on 1 referral (Level 1 requires 0 directs)
        dir_commissions = distribute_direct_income(self.investment)
        self.assertEqual(len(dir_commissions), 1)
        self.assertEqual(dir_commissions[0].commission_type, ReferralCommission.CommissionType.DIRECT)
        self.assertEqual(dir_commissions[0].user, sponsor)

        # Weekly ROI commission is BLOCKED because sponsor has only 1 direct (Level 1 ROI requires 2 directs)
        distribute_roi_for_investment(self.investment, mode='full_week')
        roi_comm = ReferralCommission.objects.filter(user=sponsor, commission_type=ReferralCommission.CommissionType.ROI).first()
        self.assertIsNone(roi_comm)  # Blocked!

        # 2. Sponsor refers a 2nd user with active investment
        child2 = make_user('single_child2@test.com', 'single_child2', parent=sponsor)
        make_active_investment(child2, self.plan)

        # Sponsor now has 2 active directs -> Level 1 ROI is now UNLOCKED!
        # Reset investment total_credited so it can earn ROI again
        self.investment.total_credited = Decimal('0.00')
        self.investment.status = Investment.Status.ACTIVE
        self.investment.save()

        distribute_roi_for_investment(self.investment, mode='full_week')
        roi_comm_unlocked = ReferralCommission.objects.filter(user=sponsor, commission_type=ReferralCommission.CommissionType.ROI).first()
        self.assertIsNotNone(roi_comm_unlocked)  # Unlocked!
        self.assertEqual(roi_comm_unlocked.amount, Decimal('2.25'))  # 18.75% of $12.00 ROI

    @patch('apps.investments.services._get_profit_days')
    def test_roi_commission_distributed_to_eligible_sponsor_at_default_rate(self, mock_profit_days):
        mock_profit_days.return_value = 5
        # Create sponsor with an active plan and 2 active directs (meeting Level 1)
        sponsor = make_user('roisponsor@test.com', 'roisponsor')
        sponsor_inv = make_active_investment(sponsor, self.plan)

        # Set investor's parent to sponsor
        self.investor.parent = sponsor
        self.investor.save(update_fields=['parent'])

        # Add second child to sponsor to fulfill Level 1 unlock (>= 2 active directs)
        child2 = make_user('child2@test.com', 'child2', parent=sponsor)
        make_active_investment(child2, self.plan)

        # Distribute ROI for investor ($12.00 ROI)
        roi = distribute_roi_for_investment(self.investment)
        self.assertEqual(roi, Decimal('12.00'))

        # Sponsor should receive 18.75% of $12.00 = $2.25
        comm = ReferralCommission.objects.filter(user=sponsor, commission_type=ReferralCommission.CommissionType.ROI).first()
        self.assertIsNotNone(comm)
        self.assertEqual(comm.amount, Decimal('2.25'))
        self.assertEqual(comm.level, 1)

        # Verify sponsor's oldest active investment plan progress (total_credited) was updated
        sponsor_inv.refresh_from_db()
        self.assertEqual(sponsor_inv.total_credited, Decimal('2.25'))
        # Ensure last_roi_date on sponsor's investment was NOT modified by downline commission
        self.assertIsNone(sponsor_inv.last_roi_date)

    def test_downline_roi_commission_full_week_updates_sponsor_plan_progress(self):
        # Create sponsor with an active plan and 2 active directs
        sponsor = make_user('fw_sponsor@test.com', 'fw_sponsor')
        sponsor_inv = make_active_investment(sponsor, self.plan)

        self.investor.parent = sponsor
        self.investor.save(update_fields=['parent'])

        child2 = make_user('fw_child2@test.com', 'fw_child2', parent=sponsor)
        make_active_investment(child2, self.plan)

        # Distribute full week ROI (10% of 120 = $12.00)
        roi = distribute_roi_for_investment(self.investment, mode='full_week')
        self.assertEqual(roi, Decimal('12.00'))

        # Sponsor gets 18.75% = $2.25 added to their oldest investment plan progress
        sponsor_inv.refresh_from_db()
        self.assertEqual(sponsor_inv.total_credited, Decimal('2.25'))
        sponsor.wallet.refresh_from_db()
        self.assertEqual(sponsor.wallet.balance, Decimal('2.25'))

    def test_downline_roi_commission_spills_over_and_completes_plan(self):
        # Create sponsor with an investment close to max_return ($350)
        sponsor = make_user('spill_sponsor@test.com', 'spill_sponsor')
        sponsor_inv1 = make_active_investment(sponsor, self.plan)
        sponsor_inv1.total_credited = Decimal('348.00')  # Remaining capacity = $2.00
        sponsor_inv1.save()

        sponsor_inv2 = make_active_investment(sponsor, self.plan)

        self.investor.parent = sponsor
        self.investor.save(update_fields=['parent'])

        child2 = make_user('spill_child2@test.com', 'spill_child2', parent=sponsor)
        make_active_investment(child2, self.plan)

        # Downline ROI of $12.00 -> 18.75% commission = $2.25
        # $2.00 should fill and complete sponsor_inv1, $0.25 spills over into sponsor_inv2
        roi = distribute_roi_for_investment(self.investment, mode='full_week')
        self.assertEqual(roi, Decimal('12.00'))

        sponsor_inv1.refresh_from_db()
        self.assertEqual(sponsor_inv1.total_credited, Decimal('350.00'))
        self.assertEqual(sponsor_inv1.status, Investment.Status.COMPLETED)
        sponsor_inv2.refresh_from_db()
        self.assertEqual(sponsor_inv2.total_credited, Decimal('0.25'))
        self.assertEqual(sponsor_inv2.status, Investment.Status.ACTIVE)

        sponsor.wallet.refresh_from_db()
        self.assertEqual(sponsor.wallet.balance, Decimal('2.25'))

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
        self.assertEqual(self.sponsor.active_level, 1)
        self.assertEqual(self.sponsor.active_roi_level, 0)

    def test_active_level_two_with_two_active_directs(self):
        for i in range(2):
            child = make_user(f'child{i}@test.com', f'child{i}', parent=self.sponsor)
            make_active_investment(child, self.plan)
        level = update_user_active_level(self.sponsor)
        self.assertEqual(level, 2)
        self.assertEqual(self.sponsor.active_level, 2)
        self.assertEqual(self.sponsor.active_roi_level, 1)


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

    @patch('apps.investments.services._get_profit_days')
    def test_distribute_weekly_roi_task_partial_days(self, mock_profit_days):
        # 3 profit days: 3 * (10.00 / 5) = $6.00
        mock_profit_days.return_value = 3
        from apps.investments.tasks import distribute_weekly_roi_task
        from apps.wallet.models import Wallet

        result = distribute_weekly_roi_task()
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['completed'], 0)
        self.assertEqual(result['errors'], 0)

        wallet = Wallet.objects.get(user=self.user)
        self.assertEqual(wallet.balance, Decimal('6.00'))



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

    def test_admin_trigger_roi_full_week(self):
        self.user.role = self.user.Role.ADMIN
        self.user.is_staff = True
        self.user.save()

        inv = make_active_investment(self.user, self.plan, Decimal('100.00'))
        url = reverse('admin_panel:trigger_roi')
        response = self.client.post(url, {'mode': 'full_week'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mode'], 'full_week')
        self.assertEqual(response.data['total_roi_distributed'], 10.0)

    @patch('apps.investments.services._get_profit_days')
    def test_admin_trigger_roi_by_day(self, mock_profit_days):
        mock_profit_days.return_value = 2 # 2 days = 2 * (10% / 5) * 100 = $4.00
        self.user.role = self.user.Role.ADMIN
        self.user.is_staff = True
        self.user.save()

        inv = make_active_investment(self.user, self.plan, Decimal('100.00'))
        url = reverse('admin_panel:trigger_roi')
        response = self.client.post(url, {'mode': 'by_day'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mode'], 'by_day')
        self.assertEqual(response.data['total_roi_distributed'], 4.0)

    def test_undistributed_roi_commissions_credited_to_company_wallet(self):
        from apps.wallet.models import CompanyWallet, CompanyWalletTransaction
        # User has no sponsor -> all 5 levels (5 * 18.75% of $10 ROI = 5 * $1.87 = $9.35) go to company wallet
        company_wallet = CompanyWallet.get_wallet()
        initial_balance = company_wallet.balance

        inv = make_active_investment(self.user, self.plan, Decimal('100.00'))
        distribute_roi_for_investment(inv, mode='full_week')

        company_wallet.refresh_from_db()
        expected_roi_remainder = Decimal('9.35') # 5 * (10.00 * 0.1875 rounded down to 1.87)
        self.assertEqual(company_wallet.balance, initial_balance + expected_roi_remainder)
        self.assertTrue(
            CompanyWalletTransaction.objects.filter(
                wallet=company_wallet,
                category=CompanyWalletTransaction.Category.INVESTMENT_REMAINDER,
                amount=expected_roi_remainder
            ).exists()
        )


