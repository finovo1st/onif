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
from apps.wallet.models import Wallet

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


if __name__ == '__main__':
    from django.test.runner import DiscoverRunner
    test_runner = DiscoverRunner(verbosity=2)
    failures = test_runner.run_tests(['tests_admin_panel'])
    if failures:
        exit(1)
    else:
        print("ALL ADMIN PANEL TESTS PASSED!")
