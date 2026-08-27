import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator


class ReferralRelationship(models.Model):
    """
    Represents a direct sponsor → referred-user relationship.

    One record per user (OneToOne). `level` is 1-based depth from the sponsor tree
    root used for level-unlock checks (2/4/6/8/10 active directs per SRS).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='referral_relationship',
        verbose_name=_('User'),
    )
    sponsor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='direct_referrals',
        verbose_name=_('Sponsor / Parent'),
    )

    class Meta:
        verbose_name = _('Referral Relationship')
        verbose_name_plural = _('Referral Relationships')
        indexes = [
            models.Index(fields=['sponsor']),
        ]

    def __str__(self) -> str:
        return f"{self.sponsor} → {self.user}"


class ReferralCommission(models.Model):
    """
    A single commission credit record for the referral/ROI income tree.

    Per SRS:
    - Direct Income: 2% up to 5 levels
    - ROI Income:    18.75% up to 5 levels

    is_paid tracks whether the commission has been moved to wallet balance.
    """

    class CommissionType(models.TextChoices):
        DIRECT = 'DIRECT', _('Direct Income')
        ROI = 'ROI', _('ROI Income')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='commissions',
        verbose_name=_('Recipient User'),
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='generated_commissions',
        verbose_name=_('Source User (Who Triggered It)'),
    )
    investment = models.ForeignKey(
        'investments.Investment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commissions',
        verbose_name=_('Source Investment'),
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name=_('Commission Amount ($)'),
    )
    level = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        db_index=True,
        verbose_name=_('Referral Level (1–5)'),
    )
    commission_type = models.CharField(
        max_length=20,
        choices=CommissionType.choices,
        db_index=True,
        verbose_name=_('Commission Type'),
    )
    is_paid = models.BooleanField(
        default=False, db_index=True, verbose_name=_('Is Paid to Wallet')
    )

    class Meta:
        verbose_name = _('Referral Commission')
        verbose_name_plural = _('Referral Commissions')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'commission_type']),
            models.Index(fields=['user', 'is_paid']),
        ]

    def __str__(self) -> str:
        return f"{self.commission_type} Level-{self.level} ${self.amount} → {self.user}"
