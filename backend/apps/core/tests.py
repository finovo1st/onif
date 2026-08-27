from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import PlatformSettings, AuditLog

User = get_user_model()


class CoreModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='coreuser@example.com', username='coreuser')

    def test_platform_settings_get(self):
        val = PlatformSettings.get('MIN_PROFIT_WITHDRAWAL', default='1.00')
        self.assertEqual(val, '10.00')  # from seeded migration

        non_existent = PlatformSettings.get('NON_EXISTENT', default='DEFAULT_VAL')
        self.assertEqual(non_existent, 'DEFAULT_VAL')

    def test_audit_log_creation(self):
        log = AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.LOGIN,
            ip_address='127.0.0.1',
            extra_data={'browser': 'Chrome'}
        )
        self.assertEqual(log.action, AuditLog.Action.LOGIN)
        self.assertEqual(log.ip_address, '127.0.0.1')
