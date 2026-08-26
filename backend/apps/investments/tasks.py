"""
Investment Celery Tasks
========================
- distribute_direct_income_task: triggered when admin approves an investment
- distribute_weekly_roi_task: Celery beat task, runs every Saturday
"""
import logging
from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.investments.models import Investment
from apps.investments.services import (
    distribute_direct_income,
    distribute_roi_for_investment,
    update_user_active_level,
)
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def distribute_direct_income_task(self, investment_id: str):
    """
    Celery task: distribute 5-level direct income for a newly approved investment.
    Called by the admin action / API when an investment transitions to ACTIVE.
    """
    try:
        investment = Investment.objects.select_related('user', 'plan').get(
            id=investment_id,
            status=Investment.Status.ACTIVE,
        )
    except Investment.DoesNotExist:
        logger.warning(f"Investment {investment_id} not found or not active. Skipping direct income.")
        return

    try:
        commissions = distribute_direct_income(investment)

        # Update active_level for the investor's parent chain
        current = investment.user
        for _ in range(5):
            parent = current.parent
            if parent is None:
                break
            update_user_active_level(parent)
            current = parent

        logger.info(
            f"Direct income distributed for investment {investment_id}: "
            f"{len(commissions)} commissions created."
        )

        # Notify investor their investment is active
        Notification.objects.create(
            user=investment.user,
            title='Investment Approved',
            message=f'Your investment of ${investment.amount} has been approved and is now active.',
            notification_type=Notification.NotificationType.INVESTMENT,
            reference_id=str(investment.id),
        )

    except Exception as exc:
        logger.error(f"Error distributing direct income for {investment_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def distribute_weekly_roi_task(self):
    """
    Celery beat task: distribute weekly ROI for all ACTIVE investments.
    Scheduled every Saturday (configured in CELERY_BEAT_SCHEDULE).

    For each active investment:
    1. Calculate weekly ROI based on plan.weekly_roi_rate
    2. Credit investor's wallet (capped at remaining_return)
    3. Distribute 75% ROI commissions up 5 levels
    4. Mark investment COMPLETED if max_return is reached
    """
    logger.info(f"[ROI Engine] Starting weekly ROI distribution at {timezone.now()}")

    active_investments = Investment.objects.filter(
        status=Investment.Status.ACTIVE
    ).select_related('user', 'plan').order_by('id')

    total = 0
    completed = 0
    errors = 0

    for investment in active_investments:
        try:
            roi_credited = distribute_roi_for_investment(investment)

            if roi_credited > 0:
                total += 1

                # Send notification to user
                investment.refresh_from_db(fields=['status'])
                if investment.status == Investment.Status.COMPLETED:
                    completed += 1
                    Notification.objects.create(
                        user=investment.user,
                        title='Investment Completed',
                        message=(
                            f'Your investment of ${investment.amount} has reached its '
                            f'maximum return of ${investment.max_return}. '
                            f'Congratulations!'
                        ),
                        notification_type=Notification.NotificationType.INVESTMENT,
                        reference_id=str(investment.id),
                    )
                else:
                    Notification.objects.create(
                        user=investment.user,
                        title='Weekly ROI Credited',
                        message=f'${roi_credited} has been credited to your wallet as weekly ROI.',
                        notification_type=Notification.NotificationType.INVESTMENT,
                        reference_id=str(investment.id),
                    )

        except Exception as exc:
            errors += 1
            logger.error(
                f"[ROI Engine] Failed to process investment {investment.id}: {exc}",
                exc_info=True,
            )
            # Continue processing other investments even if one fails

    logger.info(
        f"[ROI Engine] Weekly ROI complete. "
        f"Processed: {total}, Completed: {completed}, Errors: {errors}"
    )
    return {
        'processed': total,
        'completed': completed,
        'errors': errors,
        'timestamp': timezone.now().isoformat(),
    }
