import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class PlatformSettings(models.Model):
    """
    Admin-configurable platform settings stored as key-value pairs.

    This model allows all business constants (fees, rates, limits, schedules)
    to be changed through the admin panel without code modifications — per SRS requirement.

    Typical keys:
      MIN_INVESTMENT              = "120.00"
      MAX_TOTAL_RETURN            = "350.00"
      PROFIT_WITHDRAWAL_FEE       = "1.00"
      MIN_PROFIT_WITHDRAWAL       = "10.00"
      CAPITAL_WITHDRAWAL_FEE      = "10.00"
      MIN_CAPITAL_WITHDRAWAL      = "100.00"
      DIRECT_INCOME_RATE          = "2.00"      # % per level
      ROI_INCOME_RATE             = "18.75"     # % per level
      # Direct Income Level Unlocks (0, 2, 4, 6, 8 directs)
      DIR_LEVEL1_UNLOCK_DIRECTS   = "0"
      DIR_LEVEL2_UNLOCK_DIRECTS   = "2"
      DIR_LEVEL3_UNLOCK_DIRECTS   = "4"
      DIR_LEVEL4_UNLOCK_DIRECTS   = "6"
      DIR_LEVEL5_UNLOCK_DIRECTS   = "8"
      # ROI Referral Income Level Unlocks (2, 4, 6, 8, 10 directs)
      ROI_LEVEL1_UNLOCK_DIRECTS   = "2"
      ROI_LEVEL2_UNLOCK_DIRECTS   = "4"
      ROI_LEVEL3_UNLOCK_DIRECTS   = "6"
      ROI_LEVEL4_UNLOCK_DIRECTS   = "8"
      ROI_LEVEL5_UNLOCK_DIRECTS   = "10"
      ROI_DISTRIBUTION_DAY        = "6"         # 6 = Saturday (weekday index)
    """

    key = models.CharField(
        max_length=100, unique=True, db_index=True, verbose_name=_('Key')
    )
    value = models.TextField(verbose_name=_('Value'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='setting_updates',
        verbose_name=_('Last Updated By'),
    )

    class Meta:
        verbose_name = _('Platform Setting')
        verbose_name_plural = _('Platform Settings')
        ordering = ['key']

    def __str__(self) -> str:
        return f"{self.key} = {self.value}"

    @classmethod
    def get(cls, key: str, default: str = '') -> str:
        """Retrieve a setting value by key, returning default if not found."""
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default


class AuditLog(models.Model):
    """
    Immutable audit trail for all important platform actions.

    Records who did what, from where, and what changed. Never update or delete rows.
    old_value / new_value store serialised JSON snapshots.
    """

    class Action(models.TextChoices):
        # Auth
        LOGIN = 'LOGIN', _('Login')
        LOGOUT = 'LOGOUT', _('Logout')
        LOGIN_FAILED = 'LOGIN_FAILED', _('Login Failed')
        PASSWORD_CHANGE = 'PASSWORD_CHANGE', _('Password Change')
        TWO_FA_ENABLED = '2FA_ENABLED', _('2FA Enabled')
        TWO_FA_DISABLED = '2FA_DISABLED', _('2FA Disabled')
        # KYC
        KYC_SUBMITTED = 'KYC_SUBMITTED', _('KYC Submitted')
        KYC_APPROVED = 'KYC_APPROVED', _('KYC Approved')
        KYC_REJECTED = 'KYC_REJECTED', _('KYC Rejected')
        # Investments
        INVESTMENT_CREATED = 'INVESTMENT_CREATED', _('Investment Created')
        INVESTMENT_APPROVED = 'INVESTMENT_APPROVED', _('Investment Approved')
        INVESTMENT_REJECTED = 'INVESTMENT_REJECTED', _('Investment Rejected')
        INVESTMENT_COMPLETED = 'INVESTMENT_COMPLETED', _('Investment Completed')
        # Deposits
        DEPOSIT_SUBMITTED = 'DEPOSIT_SUBMITTED', _('Deposit Submitted')
        DEPOSIT_APPROVED = 'DEPOSIT_APPROVED', _('Deposit Approved')
        DEPOSIT_REJECTED = 'DEPOSIT_REJECTED', _('Deposit Rejected')
        # Withdrawals
        WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED', _('Withdrawal Requested')
        WITHDRAWAL_APPROVED = 'WITHDRAWAL_APPROVED', _('Withdrawal Approved')
        WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED', _('Withdrawal Rejected')
        # Wallet
        WALLET_CREDITED = 'WALLET_CREDITED', _('Wallet Credited')
        WALLET_DEBITED = 'WALLET_DEBITED', _('Wallet Debited')
        # ROI
        ROI_DISTRIBUTED = 'ROI_DISTRIBUTED', _('ROI Distributed')
        # Admin
        ADMIN_ACTION = 'ADMIN_ACTION', _('Admin Action')
        SETTINGS_UPDATED = 'SETTINGS_UPDATED', _('Settings Updated')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name=_('User'),
    )
    action = models.CharField(
        max_length=50,
        choices=Action.choices,
        db_index=True,
        verbose_name=_('Action'),
    )
    ip_address = models.GenericIPAddressField(
        null=True, blank=True, verbose_name=_('IP Address')
    )
    user_agent = models.TextField(blank=True, verbose_name=_('User Agent'))
    old_value = models.JSONField(null=True, blank=True, verbose_name=_('Old Value'))
    new_value = models.JSONField(null=True, blank=True, verbose_name=_('New Value'))
    extra_data = models.JSONField(null=True, blank=True, verbose_name=_('Extra Data'))

    class Meta:
        verbose_name = _('Audit Log')
        verbose_name_plural = _('Audit Logs')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'action']),
            models.Index(fields=['action', 'created_at']),
        ]

    def __str__(self) -> str:
        return f"[{self.action}] {self.user} @ {self.created_at}"
