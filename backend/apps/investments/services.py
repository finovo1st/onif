"""
ROI Engine + Investment Activation Service Layer
=================================================
Pure Python business logic for:
  - activate_investment()         — called when admin approves a deposit
  - distribute_direct_income()    — 2% per level to upline's OLDEST active plan
  - distribute_roi_for_investment() — weekly ROI to investor wallet + upline plan credits
  - credit_oldest_active_plan()   — core helper: credits a user's oldest ACTIVE investment
  - update_user_active_level()    — recalculate sponsor tree level

All DB operations are atomic.
"""
from datetime import timedelta, date
from decimal import Decimal, ROUND_DOWN
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.core.models import PlatformSettings
from apps.investments.models import Investment
from apps.referrals.models import ReferralCommission
from apps.wallet.models import Wallet, WalletTransaction, CompanyWallet
from apps.wallet.services import credit_wallet

User = get_user_model()


def _get_setting(key: str, default: str) -> Decimal:
    return Decimal(PlatformSettings.get(key, default))


def _level_unlock_threshold(level: int) -> int:
    """Return the number of active directs needed to unlock income at this level."""
    mapping = {
        1: int(PlatformSettings.get('LEVEL1_UNLOCK_DIRECTS', '0')),
        2: int(PlatformSettings.get('LEVEL2_UNLOCK_DIRECTS', '2')),
        3: int(PlatformSettings.get('LEVEL3_UNLOCK_DIRECTS', '4')),
        4: int(PlatformSettings.get('LEVEL4_UNLOCK_DIRECTS', '6')),
        5: int(PlatformSettings.get('LEVEL5_UNLOCK_DIRECTS', '8')),
    }
    return mapping.get(level, 999)


def _count_active_directs(user) -> int:
    """Count direct children who have at least one ACTIVE investment."""
    return user.direct_children.filter(
        investments__status=Investment.Status.ACTIVE
    ).distinct().count()


def update_user_active_level(user) -> int:
    """
    Recalculate and persist the user's active_level.
    Returns the new level (0–5).
    """
    active_directs = _count_active_directs(user)
    new_level = 0
    for lvl in range(1, 6):
        if active_directs >= _level_unlock_threshold(lvl):
            new_level = lvl
        else:
            break
    if user.active_level != new_level:
        User.objects.filter(pk=user.pk).update(active_level=new_level)
        user.active_level = new_level
    return new_level


@transaction.atomic
def activate_investment(investment: Investment, admin_user) -> None:
    """
    Activate a DEPOSIT_PENDING (or PENDING) investment after admin verifies the deposit.

    Actions:
      1. Set investment status → ACTIVE, record approval metadata.
      2. Update wallet accumulators:
         - total_deposited += investment.cost (total crypto paid by user)
         - total_invested  += investment.trading_capital (trading capital credited to portfolio)
      3. Create an immutable WalletTransaction audit record (balance unchanged).
      4. Send in-app notification to the investor.
    """
    investment.status = Investment.Status.ACTIVE
    investment.approved_by = admin_user
    investment.approved_at = timezone.now()
    investment.start_date = timezone.now().date()
    investment.save(update_fields=['status', 'approved_by', 'approved_at', 'start_date', 'updated_at'])

    # Update wallet accumulators without changing spendable balance
    wallet = Wallet.objects.select_for_update().get_or_create(user=investment.user)[0]
    wallet.total_deposited += investment.trading_capital
    wallet.total_invested += investment.trading_capital
    wallet.save(update_fields=['total_deposited', 'total_invested', 'updated_at'])

    # Update 5-level ancestors team_total_investment
    if investment.user.parent:
        from django.db.models import F
        current_parent = investment.user.parent
        ancestor_ids = []
        for _ in range(5):
            if current_parent:
                ancestor_ids.append(current_parent.id)
                current_parent = current_parent.parent
            else:
                break
        
        if ancestor_ids:
            # Ensure wallets exist
            for aid in ancestor_ids:
                Wallet.objects.get_or_create(user_id=aid)
            
            Wallet.objects.filter(user_id__in=ancestor_ids).update(
                team_total_investment=F('team_total_investment') + investment.trading_capital
            )

    # Audit trail — balance_before == balance_after (no spendable change)
    WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
        category=WalletTransaction.Category.DEPOSIT,
        amount=investment.trading_capital,
        balance_before=wallet.balance,
        balance_after=wallet.balance,
        description=f'Investment deposit verified for {investment.plan.name} plan (${investment.trading_capital} Trading Capital)',
        reference_id=str(investment.id),
    )

    # In-app notification
    from apps.notifications.models import Notification
    Notification.objects.create(
        user=investment.user,
        title='Investment Approved',
        message=(
            f'Your deposit of ${investment.cost} has been verified. '
            f'Your {investment.plan.name} investment (${investment.trading_capital} Trading Capital) is now active and earning ROI.'
        ),
        notification_type=Notification.NotificationType.INVESTMENT,
        reference_id=str(investment.id),
    )


@transaction.atomic
def credit_oldest_active_plan(
    user,
    amount: Decimal,
    category: str,
    description: str = '',
    reference_id: str = '',
) -> Decimal:
    """
    Credit `amount` toward the OLDEST active investment plan of `user` AND to their wallet balance.

    This is used for referral/direct income so that sponsor income
    accelerates the fill-up of their earliest investment plan toward its
    max_return cap.

    - If the oldest plan is filled, the remaining amount spills over to the NEXT oldest active plan.
    - Any amount that cannot fit into an active plan is discarded, because income requires an active plan.
    - Credits the exact amount to the user's wallet balance via `credit_wallet`.
    """
    amount_remaining_to_distribute = amount
    total_credited_across_plans = Decimal('0.00')

    active_investments = Investment.objects.select_for_update().filter(
        user=user, status=Investment.Status.ACTIVE
    ).order_by('start_date', 'created_at')

    for inv in active_investments:
        if amount_remaining_to_distribute <= Decimal('0.00'):
            break

        remaining_capacity = inv.remaining_return
        if remaining_capacity <= Decimal('0.00'):
            continue

        credited = min(amount_remaining_to_distribute, remaining_capacity).quantize(Decimal('0.01'), rounding=ROUND_DOWN)

        if credited > Decimal('0.00'):
            # Apply credit to this investment
            inv.total_credited += credited
            inv.last_roi_date = timezone.now().date()
            
            completed = inv.total_credited >= inv.max_return
            if completed:
                inv.status = Investment.Status.COMPLETED
                inv.end_date = timezone.now().date()
                
            inv.save(update_fields=['total_credited', 'last_roi_date', 'status', 'end_date', 'updated_at'])
            
            # Credit the actual wallet balance
            credit_wallet(
                user=user,
                amount=credited,
                category=category,
                description=f"{description} → plan #{str(inv.id)[:8]}",
                reference_id=reference_id,
            )
            
            amount_remaining_to_distribute -= credited
            total_credited_across_plans += credited

            if completed:
                # Notify on plan completion
                from apps.notifications.models import Notification
                Notification.objects.create(
                    user=user,
                    title='Investment Completed',
                    message=(
                        f'Your investment of ${inv.amount} in {inv.plan.name} '
                        f'has reached its maximum return of ${inv.max_return}. '
                        f'Congratulations!'
                    ),
                    notification_type=Notification.NotificationType.INVESTMENT,
                    reference_id=str(inv.id),
                )

    return total_credited_across_plans


@transaction.atomic
def distribute_direct_income(investment: Investment) -> list:
    """
    Distribute direct income (2% per level, up to 5 levels) upline
    when a new investment is APPROVED.

    Each level's commission is credited to the sponsor's OLDEST active
    investment plan (via credit_oldest_active_plan), not to free wallet balance.

    Returns a list of ReferralCommission objects created.
    """
    rate = _get_setting('DIRECT_INCOME_RATE', '2.00') / Decimal('100')
    max_levels = int(PlatformSettings.get('MAX_REFERRAL_LEVELS', '5'))
    commissions_created = []

    overhead_pool = investment.cost - investment.trading_capital
    total_distributed = Decimal('0.00')

    current_user = investment.user
    for level in range(1, max_levels + 1):
        sponsor = current_user.parent
        if sponsor is None:
            break

        # Check level unlock
        active_directs = _count_active_directs(sponsor)
        required = _level_unlock_threshold(level)
        if active_directs < required:
            current_user = sponsor
            continue

        commission_amount = (investment.trading_capital * rate).quantize(
            Decimal('0.01'), rounding=ROUND_DOWN
        )
        if commission_amount <= Decimal('0.00'):
            current_user = sponsor
            continue

        # Credit sponsor's OLDEST active plan
        credited_amount = credit_oldest_active_plan(
            user=sponsor,
            amount=commission_amount,
            category=WalletTransaction.Category.DIRECT_INCOME,
            description=f'Level-{level} direct income from {investment.user.email}',
            reference_id=str(investment.id),
        )

        # Record commission
        if credited_amount > Decimal('0.00'):
            total_distributed += credited_amount
            comm = ReferralCommission.objects.create(
                user=sponsor,
                from_user=investment.user,
                investment=investment,
                amount=credited_amount,
                level=level,
                commission_type=ReferralCommission.CommissionType.DIRECT,
                is_paid=True,
            )
            commissions_created.append(comm)
        current_user = sponsor

    company_remainder = overhead_pool - total_distributed
    if company_remainder > Decimal('0.00'):
        from apps.wallet.services import credit_company_wallet
        from apps.wallet.models import CompanyWalletTransaction
        user_account_info = f"{investment.user.email} (Account ID: #{str(investment.user.id)[:8]})"
        credit_company_wallet(
            amount=company_remainder,
            category=CompanyWalletTransaction.Category.INVESTMENT_REMAINDER,
            description=f"Overhead remainder from {investment.plan.name} (${investment.amount}) activated by {user_account_info}",
            reference_id=str(investment.id),
        )

    return commissions_created


def _get_profit_days(start_date: date, end_date: date) -> int:
    """Return the number of weekdays (Mon-Fri) between start_date and end_date (inclusive)."""
    days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:  # 0=Mon, ..., 4=Fri
            days += 1
        current += timedelta(days=1)
    return days


@transaction.atomic
def distribute_roi_for_investment(investment: Investment) -> Decimal:
    """
    Calculate and credit the prorated weekly ROI for a single ACTIVE investment.

    - The investor's ROI is calculated based on trading_capital.
    - ROI is prorated based on profit days (Monday to Friday).
    - ROI is credited to investor's spendable wallet balance (withdrawable).
    - investment.total_credited tracks cumulative ROI paid out toward max_return.
    - Marks the investment COMPLETED if max_return is reached.
    - Distributes ROI-level commissions (75% up to 5 levels) to upline sponsors'
      OLDEST active investment plans (not their wallet balance).

    Returns the actual ROI amount credited to the investor (may be less if capped).
    """
    if investment.status != Investment.Status.ACTIVE:
        return Decimal('0.00')

    # Determine date range for ROI calculation
    current_date = timezone.now().date()
    if investment.last_roi_date:
        calc_start = investment.last_roi_date + timedelta(days=1)
    else:
        calc_start = investment.start_date
        
    profit_days = _get_profit_days(calc_start, current_date)
    
    if profit_days <= 0:
        return Decimal('0.00')

    # Daily ROI rate = Weekly ROI rate / 5 (profit days)
    daily_roi_rate = (investment.plan.weekly_roi_rate / Decimal('5')) / Decimal('100')
    
    # Calculate prorated ROI based on trading capital
    calculated_roi = (investment.trading_capital * daily_roi_rate * Decimal(profit_days)).quantize(
        Decimal('0.01'), rounding=ROUND_DOWN
    )

    # Cap at remaining_return
    remaining = investment.remaining_return
    roi_amount = min(calculated_roi, remaining)

    if roi_amount <= Decimal('0.00'):
        return Decimal('0.00')

    # Credit investor's spendable wallet balance
    credit_wallet(
        user=investment.user,
        amount=roi_amount,
        category=WalletTransaction.Category.ROI,
        description=f'Weekly ROI from investment #{str(investment.id)[:8]}',
        reference_id=str(investment.id),
    )

    # Update investment progress
    investment.total_credited += roi_amount
    investment.last_roi_date = timezone.now().date()

    if investment.total_credited >= investment.max_return:
        investment.status = Investment.Status.COMPLETED
        investment.end_date = timezone.now().date()

    investment.save(update_fields=['total_credited', 'last_roi_date', 'status', 'end_date', 'updated_at'])

    # Distribute ROI-level commissions to upline's oldest active plans
    _distribute_roi_commissions(investment, roi_amount)

    return roi_amount


def _distribute_roi_commissions(investment: Investment, roi_amount: Decimal) -> None:
    """
    Distribute ROI income commissions up the sponsor chain (5 levels, 75%).

    Each sponsor's commission fills their OLDEST active investment plan.
    """
    rate = _get_setting('ROI_INCOME_RATE', '75.00') / Decimal('100')
    max_levels = int(PlatformSettings.get('MAX_REFERRAL_LEVELS', '5'))

    current_user = investment.user
    for level in range(1, max_levels + 1):
        sponsor = current_user.parent
        if sponsor is None:
            break

        # Level unlock check
        active_directs = _count_active_directs(sponsor)
        required = _level_unlock_threshold(level)
        if active_directs < required:
            current_user = sponsor
            continue

        commission_amount = (roi_amount * rate).quantize(
            Decimal('0.01'), rounding=ROUND_DOWN
        )
        if commission_amount <= Decimal('0.00'):
            current_user = sponsor
            continue

        # Credit sponsor's OLDEST active plan
        credited_amount = credit_oldest_active_plan(
            user=sponsor,
            amount=commission_amount,
            category=WalletTransaction.Category.REFERRAL_INCOME,
            description=f'Level-{level} ROI commission from {investment.user.email}',
            reference_id=str(investment.id),
        )

        if credited_amount > Decimal('0.00'):
            ReferralCommission.objects.create(
                user=sponsor,
                from_user=investment.user,
                investment=investment,
                amount=credited_amount,
                level=level,
                commission_type=ReferralCommission.CommissionType.ROI,
                is_paid=True,
            )
        current_user = sponsor
