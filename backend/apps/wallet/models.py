import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator


class Wallet(models.Model):
    """
    User wallet — single wallet per user.

    `balance` is the spendable/withdrawable balance.
    Separate accumulators track income by type for dashboard reporting.
    All balance mutations must use select_for_update() and database transactions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallet',
        verbose_name=_('User'),
    )

    # Current spendable balance
    balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name=_('Available Balance ($)'),
    )

    # Lifetime accumulators for dashboard
    total_deposited = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total Deposited ($)'),
    )
    total_withdrawn = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total Withdrawn ($)'),
    )
    total_roi_earned = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total ROI Earned ($)'),
    )
    total_direct_income = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total Direct Income ($)'),
    )
    total_referral_income = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total Referral Income ($)'),
    )
    total_invested = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('Total Invested ($)'),
    )
    team_total_members = models.IntegerField(
        default=0,
        verbose_name=_('5-Level Team Members'),
    )
    team_total_investment = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_('5-Level Team Investment ($)'),
    )

    class Meta:
        verbose_name = _('Wallet')
        verbose_name_plural = _('Wallets')

    def __str__(self) -> str:
        return f"Wallet({self.user}) — ${self.balance}"


class WalletTransaction(models.Model):
    """
    Immutable ledger entry for every wallet balance change.

    Records before/after balance for a complete audit trail.
    Never update or delete these records.
    """

    class TransactionType(models.TextChoices):
        CREDIT = 'CREDIT', _('Credit')
        DEBIT = 'DEBIT', _('Debit')

    class Category(models.TextChoices):
        DEPOSIT = 'DEPOSIT', _('Deposit')
        WITHDRAWAL = 'WITHDRAWAL', _('Withdrawal')
        ROI = 'ROI', _('ROI Income')
        DIRECT_INCOME = 'DIRECT_INCOME', _('Direct Income')
        REFERRAL_INCOME = 'REFERRAL_INCOME', _('Referral Income')
        CAPITAL_WITHDRAWAL = 'CAPITAL_WITHDRAWAL', _('Capital Withdrawal')
        FEE = 'FEE', _('Fee Deduction')
        ADJUSTMENT = 'ADJUSTMENT', _('Admin Adjustment')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name='transactions',
        verbose_name=_('Wallet'),
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        db_index=True,
        verbose_name=_('Transaction Type'),
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        db_index=True,
        verbose_name=_('Category'),
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Amount ($)'),
    )
    balance_before = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name=_('Balance Before ($)')
    )
    balance_after = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name=_('Balance After ($)')
    )
    description = models.TextField(blank=True, verbose_name=_('Description'))
    reference_id = models.CharField(
        max_length=100, blank=True, db_index=True,
        verbose_name=_('Reference ID'),
        help_text=_('UUID of the source object (Deposit, Withdrawal, Investment, etc.)'),
    )

    class Meta:
        verbose_name = _('Wallet Transaction')
        verbose_name_plural = _('Wallet Transactions')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', 'category']),
            models.Index(fields=['wallet', 'created_at']),
        ]

    def __str__(self) -> str:
        return f"{self.transaction_type} ${self.amount} ({self.category}) — {self.wallet.user}"


class CompanyWallet(models.Model):
    """
    Singleton wallet to track the company's balance.
    The balance represents the undistributed difference between an investment's cost and its trading capital, as well as withdrawal fees.
    """
    balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name=_('Company Wallet Balance ($)'),
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Company Wallet')
        verbose_name_plural = _('Company Wallets')

    def __str__(self) -> str:
        return f"Company Wallet — ${self.balance}"

    @classmethod
    def get_wallet(cls):
        wallet, _ = cls.objects.get_or_create(id=1)
        return wallet


class CompanyWalletTransaction(models.Model):
    """
    Immutable ledger entry for every company wallet balance change.
    """

    class TransactionType(models.TextChoices):
        CREDIT = 'CREDIT', _('Credit')
        DEBIT = 'DEBIT', _('Debit')

    class Category(models.TextChoices):
        INVESTMENT_REMAINDER = 'INVESTMENT_REMAINDER', _('Investment Remainder')
        WITHDRAWAL_FEE = 'WITHDRAWAL_FEE', _('Withdrawal Fee')
        ADJUSTMENT = 'ADJUSTMENT', _('Admin Adjustment')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    wallet = models.ForeignKey(
        CompanyWallet,
        on_delete=models.PROTECT,
        related_name='transactions',
        verbose_name=_('Company Wallet'),
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        db_index=True,
        verbose_name=_('Transaction Type'),
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        db_index=True,
        verbose_name=_('Category'),
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Amount ($)'),
    )
    balance_before = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name=_('Balance Before ($)')
    )
    balance_after = models.DecimalField(
        max_digits=18, decimal_places=2, verbose_name=_('Balance After ($)')
    )
    description = models.TextField(blank=True, verbose_name=_('Description'))
    reference_id = models.CharField(
        max_length=100, blank=True, db_index=True,
        verbose_name=_('Reference ID'),
        help_text=_('UUID of the source object'),
    )

    class Meta:
        verbose_name = _('Company Wallet Transaction')
        verbose_name_plural = _('Company Wallet Transactions')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', 'category']),
            models.Index(fields=['wallet', 'created_at']),
        ]

    def __str__(self) -> str:
        return f"{self.transaction_type} ${self.amount} ({self.category})"
