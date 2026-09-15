import random
import string
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

User = get_user_model()

OTP_EXPIRY_MINUTES = 10


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP string."""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(user: User, subject: str = 'Your FINOVO Verification Code') -> str:
    """
    Generate and store a new OTP for the user, then send it via email.
    Uses the branded FINOVO email notification system.
    Returns the generated OTP (useful for testing).
    """
    otp = generate_otp()
    user.email_otp = otp
    user.email_otp_expiry = timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    user.save(update_fields=['email_otp', 'email_otp_expiry'])

    from apps.notifications.emails import send_notification_email

    is_password_reset = 'password' in subject.lower()
    title = 'Password Reset Code' if is_password_reset else 'Account Verification Code'
    message = (
        'A request was made to reset your FINOVO account password. Use the verification code below to proceed.'
        if is_password_reset
        else 'Thank you for choosing FINOVO. Please use the one-time verification code below to verify your email address.'
    )
    security_notice = (
        'If you did not request a password reset, someone may have entered your email by mistake. Your account credentials remain secure, but please contact support if you suspect unauthorized activity.'
        if is_password_reset
        else 'If you did not create an account on FINOVO, please disregard this email.'
    )

    send_notification_email(
        user=user,
        title=title,
        message=message,
        email_subject=subject,
        badge_text='Password Reset' if is_password_reset else 'Verify Account',
        badge_type='blue' if is_password_reset else 'gold',
        otp_code=otp,
        expiry_minutes=OTP_EXPIRY_MINUTES,
        security_notice=security_notice,
        create_in_app=False,
    )
    return otp


def verify_otp(user: User, otp: str) -> bool:
    """
    Verify the given OTP against the stored value.
    Returns True if valid and not expired, False otherwise.
    Clears the OTP on successful verification.
    """
    if not user.email_otp or not user.email_otp_expiry:
        return False
    if user.email_otp != otp:
        return False
    if timezone.now() > user.email_otp_expiry:
        return False

    # Clear OTP after successful use
    user.email_otp = None
    user.email_otp_expiry = None
    user.save(update_fields=['email_otp', 'email_otp_expiry'])
    return True


def send_withdrawal_otp_email(user: User) -> str:
    """
    Generate and store a new withdrawal OTP for the user, then send it via email.
    Returns the generated OTP.
    """
    from apps.notifications.emails import notify_withdrawal_otp

    otp = generate_otp()
    user.withdrawal_otp = otp
    user.withdrawal_otp_expiry = timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    user.save(update_fields=['withdrawal_otp', 'withdrawal_otp_expiry'])

    notify_withdrawal_otp(user, otp, expiry_minutes=OTP_EXPIRY_MINUTES)
    return otp


def verify_withdrawal_otp(user: User, otp: str) -> bool:
    """
    Verify the given withdrawal OTP against the stored value.
    Returns True if valid and not expired, False otherwise.
    Clears the OTP on successful verification.
    """
    if not user.withdrawal_otp or not user.withdrawal_otp_expiry:
        return False
    if str(user.withdrawal_otp).strip() != str(otp).strip():
        return False
    if timezone.now() > user.withdrawal_otp_expiry:
        return False

    # Clear OTP after successful use
    user.withdrawal_otp = None
    user.withdrawal_otp_expiry = None
    user.save(update_fields=['withdrawal_otp', 'withdrawal_otp_expiry'])
    return True

