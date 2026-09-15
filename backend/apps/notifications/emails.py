import base64
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone

from apps.notifications.models import Notification

logger = logging.getLogger(__name__)

# Pre-load company logo as base64 for inline email embedding.
# Looks for logo-title.png in the frontend/img directory (relative to project root).
def _load_logo_base64() -> str:
    """Return base64-encoded company logo, or empty string if file not found."""
    try:
        # BASE_DIR is backend/, so go up one level to reach project root
        project_root = Path(settings.BASE_DIR).parent
        logo_path = project_root / 'frontend' / 'img' / 'logo-title.png'
        if logo_path.exists():
            return base64.b64encode(logo_path.read_bytes()).decode('utf-8')
    except Exception as exc:
        logger.warning(f"[Email] Could not load company logo for email: {exc}")
    return ''

_LOGO_BASE64: str = _load_logo_base64()


def send_notification_email(
    user,
    title: str,
    message: str,
    notification_type: str = Notification.NotificationType.SYSTEM,
    email_subject: Optional[str] = None,
    badge_text: Optional[str] = None,
    badge_type: str = 'gold',
    details: Optional[List[Dict[str, Any]]] = None,
    otp_code: Optional[str] = None,
    expiry_minutes: int = 10,
    security_notice: Optional[str] = None,
    reference_id: str = '',
    create_in_app: bool = True,
    send_email: bool = True,
) -> Optional[Notification]:
    """
    Central dispatcher to send a formatted email notification to the user
    and optionally create an in-app Notification record.
    Gracefully catches and logs email exceptions so caller transactions never fail.
    """
    notif = None
    if create_in_app and user and user.is_authenticated:
        try:
            notif = Notification.objects.create(
                user=user,
                title=title,
                message=message,
                notification_type=notification_type,
                reference_id=str(reference_id),
            )
        except Exception as exc:
            logger.error(f"[Notification] Failed to create in-app notification: {exc}")

    if send_email and user and getattr(user, 'email', None):
        subject = email_subject or f"[FINOVO] {title}"
        context = {
            'subject': subject,
            'title': title,
            'user_name': getattr(user, 'first_name', '') or getattr(user, 'username', '') or getattr(user, 'email', ''),
            'message': message,
            'badge_text': badge_text or notification_type,
            'badge_type': badge_type,
            'details': details or [],
            'otp_code': otp_code,
            'expiry_minutes': expiry_minutes,
            'security_notice': security_notice,
            'current_year': timezone.now().year,
            'logo_base64': _LOGO_BASE64,
        }

        try:
            html_content = render_to_string('emails/base_notification.html', context)
        except Exception as exc:
            logger.error(f"[Notification] Error rendering email template: {exc}")
            html_content = None

        # Build fallback plain text message
        text_lines = [f"FINOVO - {title}", "", message, ""]
        if otp_code:
            text_lines.extend([
                f"YOUR VERIFICATION CODE: {otp_code}",
                f"(Expires in {expiry_minutes} minutes. Never share this code with anyone.)",
                "",
            ])
        if details:
            text_lines.append("DETAILS:")
            for item in details:
                text_lines.append(f"- {item.get('label')}: {item.get('value')}")
            text_lines.append("")
        if security_notice:
            text_lines.extend([f"SECURITY NOTICE: {security_notice}", ""])
        text_lines.append("If you did not authorize this action, please contact FINOVO Support immediately.")
        plain_text = "\n".join(text_lines)

        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'FINOVO <noreply@finovo.com>')
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,
                from_email=from_email,
                to=[user.email],
            )
            if html_content:
                msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            logger.info(f"[Notification] Email sent to {user.email}: '{subject}'")
        except Exception as exc:
            logger.warning(f"[Notification] Failed to send email to {user.email}: {exc}")

    return notif


# ─── DEPOSIT NOTIFICATIONS ──────────────────────────────────────────────────

def notify_deposit_submitted(obj):
    """
    Called when a user submits an investment with deposit proof or manual deposit.
    Supports either Investment or Deposit instance.
    """
    user = obj.user
    amount = getattr(obj, 'cost', None) or getattr(obj, 'amount', Decimal('0.00'))
    network = getattr(obj, 'deposit_network', None) or getattr(obj, 'network', 'USDT')
    txn_hash = getattr(obj, 'deposit_txn_hash', None) or getattr(obj, 'txn_hash', '') or 'Pending on-chain verification'
    plan_name = getattr(getattr(obj, 'plan', None), 'name', 'Package Deposit')

    details = [
        {'label': 'Package / Type', 'value': plan_name},
        {'label': 'Deposit Amount', 'value': f"${amount} USDT", 'highlight': True},
        {'label': 'Network', 'value': str(network)},
        {'label': 'Transaction Hash', 'value': str(txn_hash)},
        {'label': 'Status', 'value': 'Awaiting Admin Verification'},
    ]

    send_notification_email(
        user=user,
        title='Deposit Submitted — Awaiting Verification',
        message=(
            f"Your deposit submission of ${amount} for {plan_name} has been received. "
            "Our compliance and finance team is reviewing your transaction proof. "
            "You will receive another update as soon as it is approved."
        ),
        notification_type=Notification.NotificationType.DEPOSIT,
        email_subject=f"[FINOVO] Deposit Received (${amount}) - Verification Pending",
        badge_text='Deposit Pending',
        badge_type='gold',
        details=details,
        reference_id=str(obj.id),
    )


def notify_deposit_approved(obj):
    """
    Called when admin approves an investment or manual deposit.
    """
    user = obj.user
    amount = getattr(obj, 'cost', None) or getattr(obj, 'amount', Decimal('0.00'))
    trading_cap = getattr(obj, 'trading_capital', None) or amount
    network = getattr(obj, 'deposit_network', None) or getattr(obj, 'network', 'USDT')
    plan_name = getattr(getattr(obj, 'plan', None), 'name', 'Wallet Balance')

    details = [
        {'label': 'Plan / Product', 'value': plan_name},
        {'label': 'Verified Amount', 'value': f"${amount} USDT", 'highlight': True},
        {'label': 'Trading Capital Credited', 'value': f"${trading_cap} USDT"},
        {'label': 'Network', 'value': str(network)},
        {'label': 'Status', 'value': 'Approved & Active'},
    ]

    send_notification_email(
        user=user,
        title='Deposit Approved & Investment Active!',
        message=(
            f"Great news! Your deposit of ${amount} has been verified and confirmed. "
            f"Your {plan_name} portfolio is now active and generating returns."
        ),
        notification_type=Notification.NotificationType.DEPOSIT,
        email_subject=f"[FINOVO] Deposit Approved - ${amount} Credited Successfully",
        badge_text='Deposit Approved',
        badge_type='green',
        details=details,
        reference_id=str(obj.id),
    )


def notify_deposit_rejected(obj, reason: Optional[str] = None):
    """
    Called when admin rejects an investment deposit proof or manual deposit.
    """
    user = obj.user
    amount = getattr(obj, 'cost', None) or getattr(obj, 'amount', Decimal('0.00'))
    rejection_reason = reason or getattr(obj, 'rejection_reason', '') or getattr(obj, 'notes', '') or 'Transaction could not be verified on-chain.'

    details = [
        {'label': 'Amount', 'value': f"${amount} USDT"},
        {'label': 'Rejection Reason', 'value': rejection_reason, 'highlight': True},
        {'label': 'Status', 'value': 'Rejected'},
    ]

    send_notification_email(
        user=user,
        title='Deposit Verification Declined',
        message=(
            f"Your deposit submission of ${amount} could not be verified by our finance team. "
            "Please review the reason below or contact support with valid proof."
        ),
        notification_type=Notification.NotificationType.DEPOSIT,
        email_subject="[FINOVO] Action Required: Deposit Verification Declined",
        badge_text='Deposit Rejected',
        badge_type='red',
        details=details,
        security_notice='If you believe this was an error, please open a Support Ticket with your on-chain TXID.',
        reference_id=str(obj.id),
    )


# ─── WITHDRAWAL NOTIFICATIONS & OTP ─────────────────────────────────────────

def notify_withdrawal_otp(user, otp: str, expiry_minutes: int = 10):
    """
    Sends the 6-digit withdrawal authorization code to the user's email.
    """
    send_notification_email(
        user=user,
        title='Withdrawal Authorization Code',
        message=(
            "A withdrawal request was initiated from your FINOVO account. "
            "Use the one-time verification code below to authorize this withdrawal transaction."
        ),
        notification_type=Notification.NotificationType.WITHDRAWAL,
        email_subject="[FINOVO] Your Withdrawal Authorization Code",
        badge_text='Security OTP',
        badge_type='gold',
        otp_code=otp,
        expiry_minutes=expiry_minutes,
        security_notice=(
            "FINOVO personnel will NEVER ask for your OTP or password. "
            "If you did NOT request a withdrawal, your account may be compromised. "
            "Change your password immediately and contact support."
        ),
        create_in_app=False,  # OTP should strictly remain in private email
    )


def notify_withdrawal_requested(withdrawal):
    """
    Called when user successfully submits a withdrawal request after OTP verification.
    """
    details = [
        {'label': 'Requested Amount', 'value': f"${withdrawal.amount} USDT"},
        {'label': 'Fee', 'value': f"${withdrawal.fee} USDT"},
        {'label': 'Net Payout', 'value': f"${withdrawal.net_amount} USDT", 'highlight': True},
        {'label': 'Network', 'value': withdrawal.network},
        {'label': 'Destination Address', 'value': withdrawal.wallet_address},
        {'label': 'Status', 'value': 'Queued for Admin Approval'},
    ]

    send_notification_email(
        user=withdrawal.user,
        title='Withdrawal Request Received',
        message=(
            f"Your withdrawal request for ${withdrawal.amount} USDT (Net: ${withdrawal.net_amount} USDT) "
            f"to address {withdrawal.wallet_address[:8]}...{withdrawal.wallet_address[-6:]} has been received. "
            "It is currently queued for security audit and payout processing."
        ),
        notification_type=Notification.NotificationType.WITHDRAWAL,
        email_subject=f"[FINOVO] Withdrawal Request Received (${withdrawal.net_amount} USDT)",
        badge_text='Withdrawal Queued',
        badge_type='gold',
        details=details,
        reference_id=str(withdrawal.id),
    )


def notify_withdrawal_approved(withdrawal):
    """
    Called when admin approves withdrawal and sends payout.
    """
    txn_hash = withdrawal.txn_hash or 'Completed via Internal Treasury'
    details = [
        {'label': 'Net Amount Sent', 'value': f"${withdrawal.net_amount} USDT", 'highlight': True},
        {'label': 'Network', 'value': withdrawal.network},
        {'label': 'Destination Address', 'value': withdrawal.wallet_address},
        {'label': 'Payout Txn Hash', 'value': txn_hash},
        {'label': 'Status', 'value': 'Processed & Paid Out'},
    ]

    send_notification_email(
        user=withdrawal.user,
        title='Withdrawal Processed & Paid Out',
        message=(
            f"Your payout of ${withdrawal.net_amount} USDT has been approved and processed on the {withdrawal.network} network. "
            "The funds have been transferred to your destination wallet."
        ),
        notification_type=Notification.NotificationType.WITHDRAWAL,
        email_subject=f"[FINOVO] Payout Sent: ${withdrawal.net_amount} USDT Processed",
        badge_text='Withdrawal Paid',
        badge_type='green',
        details=details,
        reference_id=str(withdrawal.id),
    )


def notify_withdrawal_rejected(withdrawal, reason: Optional[str] = None):
    """
    Called when admin rejects a withdrawal request.
    """
    rejection_reason = reason or withdrawal.notes or 'Withdrawal request rejected by compliance team.'
    details = [
        {'label': 'Requested Amount', 'value': f"${withdrawal.amount} USDT"},
        {'label': 'Reason', 'value': rejection_reason, 'highlight': True},
        {'label': 'Status', 'value': 'Rejected (Balance Retained)'},
    ]

    send_notification_email(
        user=withdrawal.user,
        title='Withdrawal Request Declined',
        message=(
            f"Your withdrawal request of ${withdrawal.amount} USDT has been declined by administrators. "
            f"Reason: {rejection_reason}. Your funds remain safe in your wallet."
        ),
        notification_type=Notification.NotificationType.WITHDRAWAL,
        email_subject="[FINOVO] Withdrawal Request Declined",
        badge_text='Withdrawal Rejected',
        badge_type='red',
        details=details,
        reference_id=str(withdrawal.id),
    )


# ─── OTHER IMPORTANT UPDATES ────────────────────────────────────────────────

def notify_kyc_status_changed(user, status: str, reason: Optional[str] = None):
    """
    Called when admin updates KYC status (APPROVED or REJECTED).
    """
    status_upper = status.upper()
    is_approved = status_upper == 'APPROVED'

    details = [
        {'label': 'KYC Status', 'value': status_upper, 'highlight': True},
    ]
    if not is_approved and reason:
        details.append({'label': 'Notes / Reason', 'value': reason})

    if is_approved:
        title = 'KYC Verification Approved'
        message = (
            "Congratulations! Your identity documents have been verified and approved by our compliance team. "
            "All account restrictions have been lifted."
        )
        badge_type = 'green'
        email_subject = "[FINOVO] KYC Verification Successful"
    else:
        title = 'KYC Verification Declined'
        message = (
            "Your submitted KYC identity documents were not approved. "
            f"Reason: {reason or 'Document details could not be verified'}. "
            "Please re-submit clear, valid government-issued identification in your profile."
        )
        badge_type = 'red'
        email_subject = "[FINOVO] KYC Verification Update: Resubmission Required"

    send_notification_email(
        user=user,
        title=title,
        message=message,
        notification_type=Notification.NotificationType.KYC,
        email_subject=email_subject,
        badge_text=f"KYC {status_upper}",
        badge_type=badge_type,
        details=details,
        reference_id=str(user.id),
    )


def notify_security_alert(user, event_name: str, details_text: Optional[str] = None):
    """
    Called on security events (password changed, password reset, login changes).
    """
    details = [
        {'label': 'Security Event', 'value': event_name, 'highlight': True},
        {'label': 'Timestamp', 'value': timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')},
    ]
    if details_text:
        details.append({'label': 'Details', 'value': details_text})

    send_notification_email(
        user=user,
        title=f"Security Alert: {event_name}",
        message=(
            f"This is a security notification to confirm that '{event_name}' was executed on your FINOVO account. "
            "If this was you, no further action is necessary."
        ),
        notification_type=Notification.NotificationType.SYSTEM,
        email_subject=f"[FINOVO Security Alert] {event_name}",
        badge_text='Security Notice',
        badge_type='blue',
        details=details,
        security_notice=(
            "If you did NOT make this change, your account may be compromised. "
            "Reset your password immediately and contact FINOVO Security."
        ),
        reference_id=str(user.id),
    )


def notify_balance_adjusted(user, action: str, amount: Decimal, reason: str, new_balance: Decimal):
    """
    Called when admin manually credits or debits user wallet balance.
    """
    action_label = "Credited" if action.upper() == 'CREDIT' else "Debited"
    badge_type = 'green' if action.upper() == 'CREDIT' else 'gold'

    details = [
        {'label': 'Adjustment Type', 'value': f"Admin Manual {action.upper()}"},
        {'label': 'Amount', 'value': f"${amount} USDT", 'highlight': True},
        {'label': 'Reason', 'value': reason},
        {'label': 'Updated Wallet Balance', 'value': f"${new_balance} USDT"},
    ]

    send_notification_email(
        user=user,
        title=f"Wallet Balance {action_label}",
        message=(
            f"An administrative adjustment of ${amount} USDT has been {action_label.lower()} to your wallet. "
            f"Reason: {reason}."
        ),
        notification_type=Notification.NotificationType.SYSTEM,
        email_subject=f"[FINOVO] Wallet Balance {action_label}: ${amount} USDT",
        badge_text=f"Wallet {action_label}",
        badge_type=badge_type,
        details=details,
        reference_id=str(user.id),
    )


def notify_ticket_reply(ticket, reply):
    """
    Called when admin/support responds to a user ticket.
    """
    user = ticket.user
    details = [
        {'label': 'Ticket ID', 'value': f"#{str(ticket.id)[:8]}"},
        {'label': 'Subject', 'value': ticket.subject},
        {'label': 'Category', 'value': ticket.get_category_display() if hasattr(ticket, 'get_category_display') else ticket.category},
        {'label': 'Status', 'value': ticket.status},
    ]

    send_notification_email(
        user=user,
        title='Support Ticket Update',
        message=(
            f"Support team has replied to your ticket #{str(ticket.id)[:8]} '{ticket.subject}':\n\n"
            f"\"{reply.message}\""
        ),
        notification_type=Notification.NotificationType.SYSTEM,
        email_subject=f"[FINOVO Support] Reply to Ticket #{str(ticket.id)[:8]}: {ticket.subject}",
        badge_text='Ticket Reply',
        badge_type='blue',
        details=details,
        reference_id=str(ticket.id),
    )


def notify_referral_bonus(user, from_user, amount: Decimal, level: int):
    """
    Called when direct referral or ROI commission bonus is credited.
    """
    from_name = getattr(from_user, 'full_name', '') or getattr(from_user, 'email', 'Team Member')
    details = [
        {'label': 'Commission Amount', 'value': f"${amount} USDT", 'highlight': True},
        {'label': 'Referral Level', 'value': f"Level {level}"},
        {'label': 'Source Member', 'value': str(from_name)},
    ]

    send_notification_email(
        user=user,
        title='Referral Bonus Received!',
        message=(
            f"Congratulations! You received a Level {level} referral bonus of ${amount} USDT "
            f"from activity by {from_name}."
        ),
        notification_type=Notification.NotificationType.REFERRAL,
        email_subject=f"[FINOVO] Referral Bonus Received: +${amount} USDT",
        badge_text='Commission Earned',
        badge_type='green',
        details=details,
        reference_id=str(user.id),
    )


def notify_weekly_roi(user, amount: Decimal, plan_name: str):
    """
    Called on weekly Saturday ROI distribution.
    """
    details = [
        {'label': 'Plan', 'value': plan_name},
        {'label': 'Weekly ROI Credited', 'value': f"${amount} USDT", 'highlight': True},
    ]

    send_notification_email(
        user=user,
        title='Weekly ROI Credited to Wallet',
        message=(
            f"Your weekly Saturday ROI payout of ${amount} USDT for your {plan_name} investment "
            "has been successfully credited to your wallet balance."
        ),
        notification_type=Notification.NotificationType.INVESTMENT,
        email_subject=f"[FINOVO] Weekly ROI Payout: +${amount} USDT",
        badge_text='ROI Credited',
        badge_type='green',
        details=details,
        reference_id=str(user.id),
    )
