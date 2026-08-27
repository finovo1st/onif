import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator


class NetworkChoices(models.TextChoices):
    """Supported crypto deposit networks."""
    BEP20 = 'BEP20', _('BEP20 (BSC)')
    TRC20 = 'TRC20', _('TRC20 (TRON)')


class Plan(models.Model):
    """
    Investment plan created by admin.

    Defines the structure, limits, and return parameters for an investment product.
    All monetary limits are admin-configurable via PlatformSettings.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    name = models.CharField(max_length=100, verbose_name=_('Plan Name'))
    description = models.TextField(blank=True, verbose_name=_('Description'))

    cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('120.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Plan Cost ($)'),
        help_text=_('Fixed purchase amount the user pays for this package.'),
    )
    trading_capital = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('100.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Trading Capital ($)'),
        help_text=_('Amount credited to the user total invested portfolio for trading & ROI.'),
    )
    max_return_factor = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('3.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Max Return Factor'),
        help_text=_('Max return multiplier factor (e.g., 3.00 for 3x).'),
    )
    max_total_return = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('350.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Maximum Total Return ($) (Capital Included)'),
        help_text=_('Investment stops crediting once this amount is reached. Default: $350'),
    )
    weekly_roi_rate = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        default=Decimal('2.0000'),
        verbose_name=_('Weekly ROI Rate (%)'),
        help_text=_('Percentage credited to wallet each Saturday'),
    )
    duration_weeks = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Duration (Weeks)'),
        help_text=_('0 means open-ended / flexible until max return is reached'),
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name=_('Is Active'))

    class Meta:
        verbose_name = _('Investment Plan')
        verbose_name_plural = _('Investment Plans')
        ordering = ['cost']

    def __str__(self) -> str:
        return f"{self.name} (${self.cost} - Trading Capital: ${self.trading_capital})"


class Investment(models.Model):
    """
    A user's investment in a Plan.

    Lifecycle:
      DEPOSIT_PENDING → user submits investment + crypto deposit proof
      ACTIVE          → admin verifies deposit; ROI engine starts
      COMPLETED       → total_credited >= max_return

    Deposit proof fields are stored directly on the investment to tie the
    on-chain payment to the specific plan purchase.

    ROI returns fill total_credited on THIS investment until max_return is
    reached, at which point the investment is marked COMPLETED.

    Referral/direct commissions received by a user fill the credited amount
    of their OLDEST active investment (handled in services.py).
    """

    class Status(models.TextChoices):
        DEPOSIT_PENDING = 'DEPOSIT_PENDING', _('Deposit Pending')
        PENDING = 'PENDING', _('Pending')          # kept for admin-created investments
        ACTIVE = 'ACTIVE', _('Active')
        COMPLETED = 'COMPLETED', _('Completed')
        REJECTED = 'REJECTED', _('Rejected')
        CANCELLED = 'CANCELLED', _('Cancelled')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='investments',
        verbose_name=_('Investor'),
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name='investments',
        verbose_name=_('Plan'),
    )

    # Financial fields — stored at time of investment, not re-calculated from Plan
    cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('120.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Package Cost ($)'),
        help_text=_('Amount paid by user for the investment package.'),
    )
    trading_capital = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('120.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Trading Capital ($)'),
        help_text=_('Amount credited to user total invested balance.'),
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('120.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Principal Amount ($)'),
        help_text=_('Legacy field / synced with cost.'),
    )
    max_return = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name=_('Maximum Total Return ($)'),
        help_text=_('Copied from plan at the time of investment'),
    )
    total_credited = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name=_('Total Credited ($)'),
        help_text=_(
            'Running sum of all ROI payments + referral income credited to this plan. '
            'Investment closes when this reaches max_return.'
        ),
    )

    # Status & Approval
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DEPOSIT_PENDING,
        db_index=True,
        verbose_name=_('Status'),
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_investments',
        verbose_name=_('Approved By'),
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Approved At'))
    rejection_reason = models.TextField(blank=True, verbose_name=_('Rejection Reason'))

    # Timeline
    start_date = models.DateField(null=True, blank=True, verbose_name=_('Start Date'))
    end_date = models.DateField(null=True, blank=True, verbose_name=_('End Date'))
    last_roi_date = models.DateField(
        null=True, blank=True, verbose_name=_('Last ROI Date'),
        help_text=_('Date of the last weekly ROI distribution'),
    )

    # Deposit proof — crypto payment linked to this specific investment
    deposit_network = models.CharField(
        max_length=10,
        choices=NetworkChoices.choices,
        blank=True,
        verbose_name=_('Deposit Network'),
    )
    deposit_txn_hash = models.CharField(
        max_length=200, blank=True, db_index=True,
        verbose_name=_('Deposit Transaction Hash'),
    )
    deposit_sender_address = models.CharField(
        max_length=200, blank=True,
        verbose_name=_('Sender Wallet Address'),
    )
    deposit_proof = models.FileField(
        upload_to='investment_deposits/', blank=True, null=True,
        verbose_name=_('Deposit Proof Screenshot'),
    )
    deposit_submitted_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name=_('Deposit Submitted At'),
    )

    class Meta:
        verbose_name = _('Investment')
        verbose_name_plural = _('Investments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['user', 'start_date']),      # for oldest-active-plan queries
        ]

    def __str__(self) -> str:
        return f"{self.user} — ${self.amount} ({self.status})"

    @property
    def remaining_return(self) -> Decimal:
        """How much more can be credited before the investment completes."""
        return max(Decimal('0.00'), self.max_return - self.total_credited)

    @property
    def profit(self) -> Decimal:
        """Net profit (total credited minus principal)."""
        return max(Decimal('0.00'), self.total_credited - self.amount)
