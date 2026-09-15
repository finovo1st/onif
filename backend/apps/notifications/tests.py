from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core import mail

from apps.notifications.models import Notification
from apps.notifications.emails import (
    send_notification_email,
    notify_deposit_submitted,
    notify_deposit_approved,
    notify_deposit_rejected,
    notify_withdrawal_otp,
    notify_withdrawal_requested,
    notify_withdrawal_approved,
    notify_withdrawal_rejected,
    notify_kyc_status_changed,
    notify_security_alert,
    notify_balance_adjusted,
    notify_ticket_reply,
    notify_referral_bonus,
    notify_weekly_roi,
)
from apps.transactions.models import Deposit, Withdrawal, NetworkChoices

User = get_user_model()


class NotificationModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='notifuser@example.com', username='notifuser')

    def test_user_notification(self):
        notif = Notification.objects.create(
            user=self.user,
            title='Deposit Approved',
            message='Your deposit of $500 has been approved.',
            notification_type=Notification.NotificationType.DEPOSIT
        )
        self.assertFalse(notif.is_read)
        self.assertFalse(notif.is_broadcast)

    def test_broadcast_notification(self):
        notif = Notification.objects.create(
            title='System Maintenance',
            message='Scheduled maintenance on Saturday.',
            notification_type=Notification.NotificationType.ANNOUNCEMENT,
            is_broadcast=True
        )
        self.assertTrue(notif.is_broadcast)
        self.assertIsNone(notif.user)


class NotificationEmailEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='investor@example.com',
            username='investor',
            first_name='Alex',
            last_name='Morgan'
        )
        mail.outbox.clear()

    def test_send_notification_email_creates_record_and_dispatches_email(self):
        notif = send_notification_email(
            user=self.user,
            title='Test Title',
            message='Test body message.',
            notification_type=Notification.NotificationType.SYSTEM,
            details=[{'label': 'Amount', 'value': '$100.00', 'highlight': True}],
        )

        self.assertIsNotNone(notif)
        self.assertEqual(notif.title, 'Test Title')
        self.assertEqual(len(mail.outbox), 1)
        sent_mail = mail.outbox[0]
        self.assertIn('investor@example.com', sent_mail.to)
        self.assertIn('Test Title', sent_mail.subject)
        self.assertIn('Test body message', sent_mail.body)

    def test_deposit_lifecycle_notifications(self):
        deposit = Deposit.objects.create(
            user=self.user,
            amount=Decimal('250.00'),
            network=NetworkChoices.BEP20,
            txn_hash='0x123abc456def',
            status=Deposit.Status.PENDING,
        )

        # 1. Submitted
        mail.outbox.clear()
        notify_deposit_submitted(deposit)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Deposit Received', mail.outbox[0].subject)
        self.assertTrue(Notification.objects.filter(user=self.user, notification_type=Notification.NotificationType.DEPOSIT).exists())

        # 2. Approved
        mail.outbox.clear()
        deposit.status = Deposit.Status.APPROVED
        deposit.save()
        notify_deposit_approved(deposit)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Deposit Approved', mail.outbox[0].subject)

        # 3. Rejected
        mail.outbox.clear()
        notify_deposit_rejected(deposit, reason='Invalid blockchain proof')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Deposit Verification Declined', mail.outbox[0].subject)

    def test_withdrawal_lifecycle_notifications_and_otp(self):
        withdrawal = Withdrawal.objects.create(
            user=self.user,
            amount=Decimal('100.00'),
            withdrawal_type=Withdrawal.WithdrawalType.PROFIT,
            fee=Decimal('1.00'),
            capital_charge=Decimal('0.00'),
            net_amount=Decimal('99.00'),
            network=NetworkChoices.TRC20,
            wallet_address='TX998877665544',
            status=Withdrawal.Status.PENDING,
        )

        # 1. OTP Email (does not create in-app notification for privacy)
        mail.outbox.clear()
        notify_withdrawal_otp(self.user, '654321', expiry_minutes=10)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Withdrawal Authorization Code', mail.outbox[0].subject)
        self.assertIn('654321', mail.outbox[0].body)

        # 2. Withdrawal Requested
        mail.outbox.clear()
        notify_withdrawal_requested(withdrawal)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Withdrawal Request Received', mail.outbox[0].subject)

        # 3. Withdrawal Approved
        mail.outbox.clear()
        withdrawal.status = Withdrawal.Status.APPROVED
        withdrawal.txn_hash = '0x9876543210'
        withdrawal.save()
        notify_withdrawal_approved(withdrawal)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Payout Sent', mail.outbox[0].subject)

        # 4. Withdrawal Rejected
        mail.outbox.clear()
        notify_withdrawal_rejected(withdrawal, reason='Security compliance hold')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Withdrawal Request Declined', mail.outbox[0].subject)

    def test_other_important_updates_notifications(self):
        # 1. KYC Approved & Rejected
        mail.outbox.clear()
        notify_kyc_status_changed(self.user, 'APPROVED')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('KYC Verification Successful', mail.outbox[0].subject)

        mail.outbox.clear()
        notify_kyc_status_changed(self.user, 'REJECTED', reason='Blurred photo ID')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('KYC Verification Update', mail.outbox[0].subject)

        # 2. Security Alert
        mail.outbox.clear()
        notify_security_alert(self.user, 'Password Changed', 'Updated via web portal')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Security Alert', mail.outbox[0].subject)

        # 3. Balance Adjusted
        mail.outbox.clear()
        notify_balance_adjusted(self.user, 'CREDIT', Decimal('50.00'), 'Promotional bonus', Decimal('150.00'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Wallet Balance Credited', mail.outbox[0].subject)

        # 4. Referral Bonus
        sponsor = User.objects.create_user(email='sponsor@example.com', username='sponsor')
        mail.outbox.clear()
        notify_referral_bonus(sponsor, self.user, Decimal('10.00'), level=1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Referral Bonus Received', mail.outbox[0].subject)

        # 5. Weekly ROI
        mail.outbox.clear()
        notify_weekly_roi(self.user, Decimal('24.00'), 'Gold Starter')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Weekly ROI Payout', mail.outbox[0].subject)

    def test_registration_and_forgot_password_otp_emails(self):
        from apps.accounts.services import send_otp_email

        # 1. Registration OTP
        mail.outbox.clear()
        otp = send_otp_email(self.user, subject='Verify your FINOVO account')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Verify your FINOVO account', mail.outbox[0].subject)
        self.assertIn(otp, mail.outbox[0].body)
        self.assertEqual(self.user.email_otp, otp)

        # 2. Forgot Password OTP
        mail.outbox.clear()
        pw_otp = send_otp_email(self.user, subject='FINOVO Password Reset Code')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('FINOVO Password Reset Code', mail.outbox[0].subject)
        self.assertIn(pw_otp, mail.outbox[0].body)
        self.assertEqual(self.user.email_otp, pw_otp)
