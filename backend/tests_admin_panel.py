import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from apps.investments.models import Plan, Investment, NetworkChoices
from apps.transactions.models import Withdrawal
from apps.support.models import Ticket
from apps.wallet.models import Wallet, CompanyWalletTransaction

User = get_user_model()


class AdminPanelTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        # Create Admin
        self.admin = User.objects.create_superuser(
            email='admin_test@finovo.com',
            username='admintest',
            password='testpassword123',
            role=User.Role.ADMIN
        )
        # Create Regular User
        self.regular_user = User.objects.create_user(
            email='user_test@finovo.com',
            username='usertest',
            password='testpassword123',
            role=User.Role.USER
        )
        # Create Plan
        self.plan = Plan.objects.create(
            name='Test Starter Plan',
            cost=Decimal('100.00'),
            trading_capital=Decimal('100.00'),
            max_return_factor=Decimal('3.00'),
            max_total_return=Decimal('300.00'),
            weekly_roi_rate=Decimal('2.50'),
            duration_weeks=120,
            is_active=True
        )

        # Obtain JWT tokens
        # Admin Token
        res_admin = self.client.post('/api/v1/auth/login/', {
            'email': 'admin_test@finovo.com',
            'password': 'testpassword123'
        }, content_type='application/json')
        self.assertEqual(res_admin.status_code, 200)
        self.admin_token = res_admin.json()['access']

        # User Token
        res_user = self.client.post('/api/v1/auth/login/', {
            'email': 'user_test@finovo.com',
            'password': 'testpassword123'
        }, content_type='application/json')
        self.assertEqual(res_user.status_code, 200)
        self.user_token = res_user.json()['access']

    def test_admin_permissions(self):
        # Regular user trying to access admin overview should get 403
        res = self.client.get(
            '/api/v1/admin-panel/overview/',
            HTTP_AUTHORIZATION=f'Bearer {self.user_token}'
        )
        self.assertEqual(res.status_code, 403)

        # Admin user accessing admin overview should get 200
        res = self.client.get(
            '/api/v1/admin-panel/overview/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('users', data)
        self.assertIn('investments', data)
        self.assertIn('withdrawals', data)
        self.assertIn('finances', data)

    def test_approve_investment_flow(self):
        # Create pending investment for regular user
        inv = Investment.objects.create(
            user=self.regular_user,
            plan=self.plan,
            cost=Decimal('200.00'),
            trading_capital=Decimal('200.00'),
            amount=Decimal('200.00'),
            max_return=Decimal('600.00'),
            status=Investment.Status.DEPOSIT_PENDING,
            deposit_network=NetworkChoices.BEP20,
            deposit_txn_hash='0x1234567890abcdef'
        )

        # Admin approves
        res = self.client.post(
            f'/api/v1/admin-panel/investments/{inv.id}/approve/',
            {},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.status, Investment.Status.ACTIVE)
        self.assertEqual(inv.approved_by, self.admin)

        # Verify investment activation updated user wallet accumulators
        user_wallet = Wallet.objects.get(user=inv.user)
        self.assertEqual(user_wallet.total_invested, Decimal('200.00'))

    def test_approve_withdrawal_flow(self):
        # Fund user wallet
        wallet = Wallet.objects.get_or_create(user=self.regular_user)[0]
        wallet.balance = Decimal('500.00')
        wallet.save()

        # Create pending withdrawal
        wdr = Withdrawal.objects.create(
            user=self.regular_user,
            amount=Decimal('150.00'),
            net_amount=Decimal('149.00'),
            fee=Decimal('1.00'),
            withdrawal_type=Withdrawal.WithdrawalType.PROFIT,
            network=NetworkChoices.BEP20,
            wallet_address='0xabcdef1234567890',
            status=Withdrawal.Status.PENDING,
        )

        # Admin approves
        res = self.client.post(
            f'/api/v1/admin-panel/withdrawals/{wdr.id}/approve/',
            {'txn_hash': '0xhash123'},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)

        # Verify company ledger recorded WITHDRAWAL_FEE retained profit
        self.assertTrue(
            CompanyWalletTransaction.objects.filter(
                category=CompanyWalletTransaction.Category.WITHDRAWAL_FEE,
                amount=Decimal('1.00'),
                reference_id=str(wdr.id),
            ).exists()
        )

    def test_user_balance_adjustment(self):
        # Admin adjusts user balance
        res = self.client.post(
            f'/api/v1/admin-panel/users/{self.regular_user.id}/adjust-balance/',
            {
                'action': 'CREDIT',
                'amount': '150.00',
                'reason': 'Bonus reward'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)
        wallet = Wallet.objects.get(user=self.regular_user)
        self.assertEqual(wallet.balance, Decimal('150.00'))

    def test_ticket_reply_flow(self):
        ticket = Ticket.objects.create(
            user=self.regular_user,
            subject='Need help with deposit'
        )

        # Admin replies
        res = self.client.post(
            f'/api/v1/admin-panel/tickets/{ticket.id}/reply/',
            {
                'message': 'We have reviewed and approved your deposit.',
                'status': 'RESOLVED'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 201)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, Ticket.Status.RESOLVED)
        self.assertEqual(ticket.replies.count(), 1)
        self.assertTrue(ticket.replies.first().user.is_staff)

    def test_settings_and_roi_trigger(self):
        # Update setting
        res = self.client.patch(
            '/api/v1/admin-panel/settings/MIN_WITHDRAWAL/',
            {'value': '25.00'},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)

        # Trigger ROI engine
        res = self.client.post(
            '/api/v1/admin-panel/actions/trigger-roi/',
            {},
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('investments_processed', res.json())

    def test_funds_summary_and_generation_adjustment(self):
        # 1. Create an active investment of $500
        Investment.objects.create(
            user=self.regular_user,
            plan=self.plan,
            cost=Decimal('500.00'),
            trading_capital=Decimal('500.00'),
            amount=Decimal('500.00'),
            max_return=Decimal('1500.00'),
            status=Investment.Status.ACTIVE,
        )

        # 2. Create an approved withdrawal of $100
        Withdrawal.objects.create(
            user=self.regular_user,
            amount=Decimal('100.00'),
            net_amount=Decimal('99.00'),
            fee=Decimal('1.00'),
            withdrawal_type=Withdrawal.WithdrawalType.PROFIT,
            network=NetworkChoices.BEP20,
            wallet_address='0xabc123',
            status=Withdrawal.Status.APPROVED,
        )

        # 3. Fetch summary initially (generation = 0)
        res = self.client.get(
            '/api/v1/admin-panel/funds/summary/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['total_plan_amounts'], 500.0)
        self.assertEqual(data['total_trading_capital'], 500.0)
        self.assertEqual(data['total_withdrawals'], 100.0)
        self.assertEqual(data['total_generation'], 0.0)
        # Total Cash = 500 + 0 - 100 = 400
        self.assertEqual(data['total_cash'], 400.0)
        # Remaining Funds = Total Cash - Trading Capital = 400 - 500 = -100
        self.assertEqual(data['remaining_funds'], -100.0)

        # 4. Add $250 to generation
        res_gen = self.client.post(
            '/api/v1/admin-panel/funds/generation/',
            {
                'action': 'ADD',
                'amount': '250.00',
                'reason': 'Initial manual investment generation'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_gen.status_code, 200)
        gen_data = res_gen.json()
        self.assertEqual(gen_data['total_generation'], 250.0)
        self.assertEqual(gen_data['total_trading_capital'], 500.0)
        # Total Cash = 500 + 250 - 100 = 650
        self.assertEqual(gen_data['total_cash'], 650.0)
        # Remaining Funds = 650 - 500 = 150
        self.assertEqual(gen_data['remaining_funds'], 150.0)

        # 5. Add another $50
        res_gen2 = self.client.post(
            '/api/v1/admin-panel/funds/generation/',
            {
                'action': 'ADD',
                'amount': '50.00',
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_gen2.status_code, 200)
        self.assertEqual(res_gen2.json()['total_generation'], 300.0)
        self.assertEqual(res_gen2.json()['total_trading_capital'], 500.0)
        # Total Cash = 500 + 300 - 100 = 700
        self.assertEqual(res_gen2.json()['total_cash'], 700.0)
        self.assertEqual(res_gen2.json()['remaining_funds'], 200.0)

        # 6. Verify summary endpoint reflects changes
        res_final = self.client.get(
            '/api/v1/admin-panel/funds/summary/',
            HTTP_AUTHORIZATION=f'Bearer {self.admin_token}'
        )
        self.assertEqual(res_final.status_code, 200)
        final_data = res_final.json()
        self.assertEqual(final_data['total_generation'], 300.0)
        self.assertEqual(final_data['total_trading_capital'], 500.0)
        self.assertEqual(final_data['total_cash'], 700.0)
        self.assertEqual(final_data['remaining_funds'], 200.0)
        self.assertEqual(final_data['balance'], 0.0)

        # 7. Verify ledger entries created for generation
        self.assertTrue(
            CompanyWalletTransaction.objects.filter(
                category=CompanyWalletTransaction.Category.GENERATION,
                amount=Decimal('250.00'),
            ).exists()
        )
        self.assertTrue(
            CompanyWalletTransaction.objects.filter(
                category=CompanyWalletTransaction.Category.GENERATION,
                amount=Decimal('50.00'),
            ).exists()
        )



if __name__ == '__main__':
    from django.test.runner import DiscoverRunner
    test_runner = DiscoverRunner(verbosity=2)
    failures = test_runner.run_tests(['tests_admin_panel'])
    if failures:
        exit(1)
    else:
        print("ALL ADMIN PANEL TESTS PASSED!")
