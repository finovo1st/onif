import uuid
import string
import random
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Custom manager using email as the unique identifier."""

    def create_user(self, email: str, password: str = None, **extra_fields):
        """Create and return a regular user with the given email and password."""
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        """Create and return a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        extra_fields.setdefault('is_email_verified', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        return self.create_user(email, password, **extra_fields)


def generate_referral_code(length: int = 8) -> str:
    """Generate a unique alphanumeric referral code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class User(AbstractUser):
    """
    Custom User model for FINOVO.

    Uses email as the primary login identifier. Stores referral, KYC,
    2FA, and role information inline for efficient querying.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', _('Admin')
        SUPPORT = 'SUPPORT', _('Support')
        FINANCE = 'FINANCE', _('Finance')
        USER = 'USER', _('User')

    class KYCStatus(models.TextChoices):
        UNVERIFIED = 'UNVERIFIED', _('Unverified')
        PENDING = 'PENDING', _('Pending')
        APPROVED = 'APPROVED', _('Approved')
        REJECTED = 'REJECTED', _('Rejected')

    # Primary Key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Authentication
    email = models.EmailField(_('email address'), unique=True)
    is_email_verified = models.BooleanField(default=False, verbose_name=_('Is Email Verified'))
    email_otp = models.CharField(max_length=6, blank=True, null=True, verbose_name=_('Email OTP'))
    email_otp_expiry = models.DateTimeField(blank=True, null=True, verbose_name=_('Email OTP Expiry'))

    # Profile
    phone_number = models.CharField(
        max_length=20, blank=True, null=True, verbose_name=_('Phone Number')
    )
    date_of_birth = models.DateField(blank=True, null=True, verbose_name=_('Date of Birth'))
    country = models.CharField(max_length=100, blank=True, verbose_name=_('Country'))
    profile_picture = models.ImageField(
        upload_to='profile_pictures/', blank=True, null=True, verbose_name=_('Profile Picture')
    )

    # Role
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.USER,
        db_index=True,
        verbose_name=_('Role'),
    )

    # KYC
    kyc_status = models.CharField(
        max_length=20,
        choices=KYCStatus.choices,
        default=KYCStatus.UNVERIFIED,
        db_index=True,
        verbose_name=_('KYC Status'),
    )
    kyc_document_type = models.CharField(
        max_length=50, blank=True, null=True, verbose_name=_('KYC Document Type')
    )
    kyc_document_number = models.CharField(
        max_length=100, blank=True, null=True, verbose_name=_('KYC Document Number')
    )
    kyc_document_front = models.FileField(
        upload_to='kyc_documents/front/', blank=True, null=True, verbose_name=_('KYC Document Front')
    )
    kyc_document_back = models.FileField(
        upload_to='kyc_documents/back/', blank=True, null=True, verbose_name=_('KYC Document Back')
    )
    kyc_submitted_at = models.DateTimeField(blank=True, null=True, verbose_name=_('KYC Submitted At'))
    kyc_reviewed_at = models.DateTimeField(blank=True, null=True, verbose_name=_('KYC Reviewed At'))
    kyc_rejection_reason = models.TextField(blank=True, null=True, verbose_name=_('KYC Rejection Reason'))

    # 2FA
    is_2fa_enabled = models.BooleanField(default=False, verbose_name=_('Is 2FA Enabled'))
    otp_secret = models.CharField(
        max_length=64, blank=True, null=True, verbose_name=_('OTP Secret (TOTP)')
    )

    # Referral
    referral_code = models.CharField(
        max_length=20, unique=True, db_index=True, blank=True, verbose_name=_('Referral Code')
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_children',
        verbose_name=_('Parent / Sponsor'),
    )

    # Level tracking (denormalised for performance)
    active_level = models.PositiveIntegerField(
        default=0, verbose_name=_('Active Direct Level')
    )
    active_roi_level = models.PositiveIntegerField(
        default=0, verbose_name=_('Active ROI Level')
    )

    # Special Earning Privileges (Plan & Level Bypass for Unlimited Earning)
    bypass_plan_and_level_requirements = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name=_('Bypass Plan & Level Limits / Unlimited Earning'),
        help_text=_('Allows this user to earn unlimited direct & ROI commissions without an active plan and with all levels unlocked.')
    )

    @property
    def active_direct_level(self) -> int:
        return self.active_level

    @property
    def is_commission_bypassed(self) -> bool:
        """
        Whether this user can earn direct & ROI commission without needing an active plan
        and without requiring level unlocks or max return caps.
        True for ADMIN role, superusers, staff, or any account with bypass_plan_and_level_requirements enabled.
        """
        return bool(
            self.role == self.Role.ADMIN
            or self.is_superuser
            or self.is_staff
            or self.bypass_plan_and_level_requirements
        )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        """Auto-generate referral code on first save."""
        if not self.referral_code:
            code = generate_referral_code()
            while User.objects.filter(referral_code=code).exists():
                code = generate_referral_code()
            self.referral_code = code
        super().save(*args, **kwargs)

    @property
    def full_name(self) -> str:
        """Return full name or email if name not set."""
        name = f"{self.first_name} {self.last_name}".strip()
        return name if name else self.email
