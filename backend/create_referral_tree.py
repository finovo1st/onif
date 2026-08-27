import os
import sys
import random
from decimal import Decimal

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.getenv('DJANGO_SETTINGS_MODULE', 'config.settings.development'))
import django
django.setup()

from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from apps.accounts.models import User
from apps.investments.models import Plan, Investment, NetworkChoices
from apps.investments.services import (
    activate_investment,
    distribute_direct_income,
    distribute_roi_for_investment,
    update_user_active_level,
)
from apps.transactions.models import Withdrawal, Deposit
from apps.wallet.models import Wallet, WalletTransaction
from apps.support.models import Ticket, TicketReply

COUNTRIES = [
    'United States', 'United Kingdom', 'Germany', 'Singapore', 'United Arab Emirates',
    'Canada', 'Australia', 'Japan', 'Switzerland', 'France', 'Netherlands', 'Brazil',
    'South Korea', 'Hong Kong', 'Norway', 'Sweden', 'Italy', 'Spain'
]

# ─────────────────────────────────────────────────────────────────────────────
# 1. ADMIN USER SETUP
# ─────────────────────────────────────────────────────────────────────────────
def get_or_create_admin():
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.filter(email='admin@finovo.com').first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            email='admin@finovo.com',
            username='admin',
            password='password123',
            first_name='Platform',
            last_name='Admin',
            country='United States',
            kyc_status=User.KYCStatus.APPROVED,
            is_email_verified=True
        )
    else:
        admin_user.set_password('password123')
        admin_user.is_email_verified = True
        admin_user.kyc_status = User.KYCStatus.APPROVED
        admin_user.save()
    return admin_user


# ─────────────────────────────────────────────────────────────────────────────
# 2. PRODUCTION INVESTMENT PACKAGES (Fixed-Tier Package Structure)
# ─────────────────────────────────────────────────────────────────────────────
def get_or_create_plans():
    packages = {
        'Package 1': {
            'description': 'Institutional starter tier. $120 Cost | $100 Trading Capital | Max Return $350.',
            'cost': Decimal('120.00'),
            'trading_capital': Decimal('100.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('350.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        'Package 2': {
            'description': 'Standard yield tier. $350 Cost | $300 Trading Capital | Max Return $1,000.',
            'cost': Decimal('350.00'),
            'trading_capital': Decimal('300.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('1000.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        'Package 3': {
            'description': 'Advanced trading tier. $575 Cost | $500 Trading Capital | Max Return $1,700.',
            'cost': Decimal('575.00'),
            'trading_capital': Decimal('500.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('1700.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        'Package 4': {
            'description': 'Premium corporate tier. $1,100 Cost | $1,000 Trading Capital | Max Return $3,300.',
            'cost': Decimal('1100.00'),
            'trading_capital': Decimal('1000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('3300.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        'Package 5': {
            'description': 'High-yield institutional package. $5,500 Cost | $5,000 Trading Capital | Max Return $16,500.',
            'cost': Decimal('5500.00'),
            'trading_capital': Decimal('5000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('16500.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        'Package 6': {
            'description': 'Ultra-tier institutional wealth allocation. $11,000 Cost | $10,000 Trading Capital | Max Return $33,000.',
            'cost': Decimal('11000.00'),
            'trading_capital': Decimal('10000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('33000.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
    }

    created_plans = {}
    for name, data in packages.items():
        plan, _ = Plan.objects.update_or_create(name=name, defaults=data)
        created_plans[name] = plan
    return created_plans


# ─────────────────────────────────────────────────────────────────────────────
# 3. USER CREATION HELPER
# ─────────────────────────────────────────────────────────────────────────────
def get_or_create_user(email, username, first_name='', last_name='', country=None, kyc_status=User.KYCStatus.APPROVED, parent=None):
    user = User.objects.filter(email=email).first()
    if user:
        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.kyc_status = kyc_status
        user.is_email_verified = True
        user.set_password('password123')
        if parent and user.parent != parent:
            user.parent = parent
        user.save()
        Wallet.objects.get_or_create(user=user)
        return user
    
    country = country or random.choice(COUNTRIES)
    user = User.objects.create_user(
        email=email,
        username=username,
        password='password123',
        first_name=first_name,
        last_name=last_name,
        country=country,
        kyc_status=kyc_status,
        parent=parent,
        is_email_verified=True
    )
    Wallet.objects.get_or_create(user=user)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# 4. INVESTMENT CREATION & ACTIVATION
# ─────────────────────────────────────────────────────────────────────────────
def create_investment(user, plan, admin_user, tx_suffix, status=Investment.Status.ACTIVE, simulated_weeks_roi=0):
    # Avoid duplicate active/pending investments in the same plan for idempotent runs
    existing = Investment.objects.filter(user=user, plan=plan, status=status).first()
    if existing:
        return existing

    cost = plan.cost
    trading_capital = plan.trading_capital
    max_return = plan.max_total_return if plan.max_total_return else (trading_capital * plan.max_return_factor)
    
    network = random.choice([NetworkChoices.BEP20, NetworkChoices.TRC20])
    tx_hash = f"0x{user.username[:5].lower()}{tx_suffix}{random.randint(10000000, 99999999)}abcdef"
    sender_addr = f"0x{user.username[:4].lower()}{random.randint(10000000, 99999999)}00000000"

    investment = Investment.objects.create(
        user=user,
        plan=plan,
        cost=cost,
        trading_capital=trading_capital,
        amount=cost,
        max_return=max_return,
        status=Investment.Status.DEPOSIT_PENDING,
        deposit_network=network,
        deposit_txn_hash=tx_hash,
        deposit_sender_address=sender_addr,
        deposit_submitted_at=timezone.now() - timedelta(days=random.randint(1, 30)),
    )

    if status == Investment.Status.ACTIVE or status == Investment.Status.COMPLETED:
        # 1. Admin verifies deposit & activates investment
        activate_investment(investment, admin_user)

        # 2. Distribute direct sponsor commissions up to 5 levels
        distribute_direct_income(investment)
        
        # 3. Simulate historical weekly ROI distributions if requested
        if simulated_weeks_roi > 0:
            for _ in range(simulated_weeks_roi):
                if investment.status == Investment.Status.ACTIVE:
                    distribute_roi_for_investment(investment)
                    investment.refresh_from_db()

        if status == Investment.Status.COMPLETED:
            investment.status = Investment.Status.COMPLETED
            investment.total_credited = investment.max_return
            investment.save(update_fields=['status', 'total_credited'])

        # 4. Update upline active ranks
        curr = user.parent
        while curr:
            update_user_active_level(curr)
            curr = curr.parent

    return investment


# ─────────────────────────────────────────────────────────────────────────────
# 5. WITHDRAWALS & SUPPORT TICKETS SEEDING
# ─────────────────────────────────────────────────────────────────────────────
def seed_activity_records(users_list, admin_user):
    print("\n--- 3. Seeding Realistic Withdrawals & Customer Support Activity ---")
    
    for u in users_list[:12]:
        wallet = Wallet.objects.get_or_create(user=u)[0]
        # Only create withdrawal if user has earned commissions / balance
        if wallet.balance >= Decimal('50.00'):
            w_amt = min(wallet.balance, Decimal(str(random.choice([50, 100, 250, 500]))))
            w_status = random.choice([Withdrawal.Status.APPROVED, Withdrawal.Status.PENDING])
            
            dest_addr = f"0x{u.username[:4].lower()}Withdrawal{random.randint(100000, 999999)}"
            w = Withdrawal.objects.create(
                user=u,
                amount=w_amt,
                fee=Decimal('1.00'),
                capital_charge=Decimal('0.00'),
                net_amount=w_amt - Decimal('1.00'),
                withdrawal_type=Withdrawal.WithdrawalType.PROFIT,
                network=NetworkChoices.BEP20,
                wallet_address=dest_addr,
                status=w_status,
                created_at=timezone.now() - timedelta(days=random.randint(1, 10))
            )
            if w_status == Withdrawal.Status.APPROVED:
                w.reviewed_by = admin_user
                w.reviewed_at = timezone.now()
                w.txn_hash = f"0xpayout{random.randint(10000000, 99999999)}"
                w.save()

    # Seed Support Tickets
    sample_tickets = [
        ("USDT BEP20 Deposit Verification", "I have transferred USDT via BEP20. Please confirm and activate my Package 4 investment.", Ticket.Status.RESOLVED, "Your deposit has been verified and your package is now active."),
        ("Withdrawal Address Update Request", "Requesting to whitelist my new TRON TRC20 wallet address for weekly ROI payouts.", Ticket.Status.RESOLVED, "Your payout address has been updated successfully in your account settings."),
        ("Referral Commission Tier Inquiry", "Could you clarify the direct commission percentage earned when my L2 downline purchases Package 6?", Ticket.Status.IN_PROGRESS, "Hello! L2 referrals generate a 3.0% direct commission when your account is Level 2 or higher."),
        ("KYC Document Re-upload", "I submitted my passport photo. Please check if the quality is sufficient for Level 5 unlock.", Ticket.Status.OPEN, None),
        ("Institutional API Integration", "Inquiring about institutional webhook callbacks for bulk account management.", Ticket.Status.OPEN, None)
    ]

    for idx, (subject, message, st, reply_msg) in enumerate(sample_tickets):
        t_user = users_list[idx % len(users_list)]
        ticket = Ticket.objects.create(
            user=t_user,
            subject=subject,
            status=st,
            created_at=timezone.now() - timedelta(days=random.randint(1, 5))
        )
        if reply_msg and st in [Ticket.Status.RESOLVED, Ticket.Status.IN_PROGRESS]:
            TicketReply.objects.create(
                ticket=ticket,
                user=admin_user,
                message=reply_msg
            )


# ─────────────────────────────────────────────────────────────────────────────
# 6. MAIN SEED PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def run_seed():
    print("=" * 70)
    print("🚀 FINOVO: PRODUCTION-GRADE REFERRAL NETWORK & DATA SEEDING")
    print("=" * 70)

    admin_user = get_or_create_admin()
    print(f"✔ Admin Superuser Configured: {admin_user.email} (Password: password123)")

    # 1. Package Tiers
    print("\n--- 1. Initializing Fixed-Tier Investment Packages ---")
    plans = get_or_create_plans()
    for name, p in plans.items():
        print(f"  • {p.name.ljust(11)} | Cost: ${str(p.cost).rjust(8)} | Trading Cap: ${str(p.trading_capital).rjust(8)} | Max Return: ${str(p.max_total_return).rjust(8)} | ROI: {p.weekly_roi_rate}%/wk")

    print("\n--- 2. Building Multi-Branch Referral Tree (Simulating Production Whales & Retail) ---")
    created_count = 0
    all_seeded_users = []

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 1: Global Ambassador Victor Vance (Whale / Level 5 Sponsor)
    # ─────────────────────────────────────────────────────────────────────────
    victor = get_or_create_user('whale.victor@finovo.com', 'victor_whale', 'Victor', 'Vance', 'United Kingdom')
    create_investment(victor, plans['Package 6'], admin_user, 'vic_p6', simulated_weeks_roi=4)
    created_count += 1
    all_seeded_users.append(victor)

    # Victor's 12 Direct L1 Referrals (Fulfills Level 5 rank requirement >= 10 directs)
    victor_directs_data = [
        ('david.ross@finovo.com', 'david_ross', 'David', 'Ross', 'United States', plans['Package 6'], 4),
        ('elena.rostova@finovo.com', 'elena_r', 'Elena', 'Rostova', 'Germany', plans['Package 5'], 3),
        ('marcus.aurelius@finovo.com', 'marcus_a', 'Marcus', 'Aurelius', 'Switzerland', plans['Package 5'], 3),
        ('sophia.martinez@finovo.com', 'sophia_m', 'Sophia', 'Martinez', 'Spain', plans['Package 4'], 2),
        ('james.wilson@finovo.com', 'james_w', 'James', 'Wilson', 'Canada', plans['Package 4'], 2),
        ('olivia.taylor@finovo.com', 'olivia_t', 'Olivia', 'Taylor', 'Australia', plans['Package 4'], 2),
        ('alex.turner@finovo.com', 'alex_t', 'Alex', 'Turner', 'Singapore', plans['Package 3'], 1),
        ('chloe.bennett@finovo.com', 'chloe_b', 'Chloe', 'Bennett', 'United States', plans['Package 3'], 1),
        ('ryan.cooper@finovo.com', 'ryan_c', 'Ryan', 'Cooper', 'United Kingdom', plans['Package 2'], 1),
        ('emma.watson@finovo.com', 'emma_w', 'Emma', 'Watson', 'France', plans['Package 2'], 1),
        ('daniel.craig@finovo.com', 'daniel_c', 'Daniel', 'Craig', 'United Arab Emirates', plans['Package 1'], 1),
        ('mia.khalil@finovo.com', 'mia_k', 'Mia', 'Khalil', 'United Arab Emirates', plans['Package 1'], 0),
    ]

    victor_l1_users = []
    for email, uname, fn, ln, ctry, plan, roi_weeks in victor_directs_data:
        u = get_or_create_user(email, uname, fn, ln, ctry, parent=victor)
        create_investment(u, plan, admin_user, 'v_l1', simulated_weeks_roi=roi_weeks)
        victor_l1_users.append(u)
        all_seeded_users.append(u)
        created_count += 1

    # David Ross Deep Downline Team (L2 -> L3 -> L4 -> L5 -> L6)
    david = victor_l1_users[0]
    david_sub_users = []
    for i in range(1, 6):
        u = get_or_create_user(f'david.team{i}@finovo.com', f'd_team{i}', f'DavidL2_{i}', 'Member', parent=david)
        pkg = plans['Package 4'] if i <= 2 else plans['Package 2']
        create_investment(u, pkg, admin_user, f'd_l2_{i}', simulated_weeks_roi=2)
        david_sub_users.append(u)
        all_seeded_users.append(u)
        created_count += 1

    # L3 under David's L2
    l3_david_users = []
    for parent_u in david_sub_users[:3]:
        for j in range(1, 3):
            u = get_or_create_user(f'{parent_u.username}.sub{j}@finovo.com', f'{parent_u.username}_s{j}', f'L3_{parent_u.username}', f'M{j}', parent=parent_u)
            create_investment(u, plans['Package 2'], admin_user, f'd_l3_{j}', simulated_weeks_roi=1)
            l3_david_users.append(u)
            all_seeded_users.append(u)
            created_count += 1

    # L4 under first L3
    l4_user = get_or_create_user('david.deep.l4@finovo.com', 'd_deep_l4', 'DavidL4', 'Node', parent=l3_david_users[0])
    create_investment(l4_user, plans['Package 1'], admin_user, 'd_l4', simulated_weeks_roi=1)
    all_seeded_users.append(l4_user)
    created_count += 1

    # L5 under L4
    l5_user = get_or_create_user('david.deep.l5@finovo.com', 'd_deep_l5', 'DavidL5', 'Node', parent=l4_user)
    create_investment(l5_user, plans['Package 1'], admin_user, 'd_l5', simulated_weeks_roi=1)
    all_seeded_users.append(l5_user)
    created_count += 1

    # L6 under L5
    l6_user = get_or_create_user('david.deep.l6@finovo.com', 'd_deep_l6', 'DavidL6', 'Node', parent=l5_user)
    create_investment(l6_user, plans['Package 1'], admin_user, 'd_l6', simulated_weeks_roi=1)
    all_seeded_users.append(l6_user)
    created_count += 1

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 2: VP Network Sarah Connor (Level 4 Sponsor Rank)
    # ─────────────────────────────────────────────────────────────────────────
    sarah = get_or_create_user('sarah.investor@finovo.com', 'sarah_c', 'Sarah', 'Connor', 'United States')
    create_investment(sarah, plans['Package 5'], admin_user, 'sarah_p5', simulated_weeks_roi=3)
    created_count += 1
    all_seeded_users.append(sarah)

    sarah_directs = [
        ('liam.neeson@finovo.com', 'liam_n', 'Liam', 'Neeson', 'Ireland', plans['Package 4'], 2),
        ('noah.centineo@finovo.com', 'noah_c', 'Noah', 'Centineo', 'Canada', plans['Package 4'], 2),
        ('ava.gardner@finovo.com', 'ava_g', 'Ava', 'Gardner', 'United States', plans['Package 3'], 1),
        ('isabella.ross@finovo.com', 'isabella_r', 'Isabella', 'Ross', 'Italy', plans['Package 3'], 1),
        ('lucas.scott@finovo.com', 'lucas_s', 'Lucas', 'Scott', 'Australia', plans['Package 2'], 1),
        ('mason.mount@finovo.com', 'mason_m', 'Mason', 'Mount', 'United Kingdom', plans['Package 2'], 1),
        ('harper.lee@finovo.com', 'harper_l', 'Harper', 'Lee', 'United States', plans['Package 1'], 0),
        ('evelyn.salt@finovo.com', 'evelyn_s', 'Evelyn', 'Salt', 'Germany', plans['Package 1'], 0),
    ]

    for email, uname, fn, ln, ctry, plan, roi_weeks in sarah_directs:
        u = get_or_create_user(email, uname, fn, ln, ctry, parent=sarah)
        create_investment(u, plan, admin_user, 's_l1', simulated_weeks_roi=roi_weeks)
        all_seeded_users.append(u)
        created_count += 1

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 3: Crypto Pioneer Arthur Pendelton (Level 3 Sponsor Rank)
    # ─────────────────────────────────────────────────────────────────────────
    arthur = get_or_create_user('crypto.king@finovo.com', 'crypto_arthur', 'Arthur', 'Pendelton', 'Switzerland')
    create_investment(arthur, plans['Package 5'], admin_user, 'art_p5', simulated_weeks_roi=4)
    created_count += 1
    all_seeded_users.append(arthur)

    crypto_directs = [
        ('satoshi.nak@finovo.com', 'satoshi_n', 'Satoshi', 'Nakamoto', 'Japan', plans['Package 6'], 5),
        ('vitalik.eth@finovo.com', 'vitalik_b', 'Vitalik', 'Buterin', 'Canada', plans['Package 5'], 4),
        ('charles.ada@finovo.com', 'charles_h', 'Charles', 'Hoskinson', 'United States', plans['Package 4'], 3),
        ('gavin.dot@finovo.com', 'gavin_w', 'Gavin', 'Wood', 'United Kingdom', plans['Package 3'], 2),
        ('anatoly.sol@finovo.com', 'anatoly_y', 'Anatoly', 'Yakovenko', 'United States', plans['Package 3'], 1),
        ('sergey.link@finovo.com', 'sergey_n', 'Sergey', 'Nazarov', 'United States', plans['Package 2'], 1),
    ]

    for email, uname, fn, ln, ctry, plan, roi_weeks in crypto_directs:
        u = get_or_create_user(email, uname, fn, ln, ctry, parent=arthur)
        create_investment(u, plan, admin_user, 'c_l1', simulated_weeks_roi=roi_weeks)
        all_seeded_users.append(u)
        created_count += 1

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 4: Pending Deposits Queue (Simulates Real Inflow in Admin Queue)
    # ─────────────────────────────────────────────────────────────────────────
    pending_investors = [
        ('pending.trader1@finovo.com', 'pend_trader1', 'Jordan', 'Belfort', 'United States', plans['Package 4']),
        ('pending.trader2@finovo.com', 'pend_trader2', 'Gordon', 'Gekko', 'United States', plans['Package 5']),
        ('pending.trader3@finovo.com', 'pend_trader3', 'Warren', 'Buffett', 'United States', plans['Package 6']),
    ]
    for email, uname, fn, ln, ctry, plan in pending_investors:
        u = get_or_create_user(email, uname, fn, ln, ctry, parent=victor)
        create_investment(u, plan, admin_user, 'pend', status=Investment.Status.DEPOSIT_PENDING)
        all_seeded_users.append(u)
        created_count += 1

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 5: Completed Cycle (Simulates Finished Max Return Cycle)
    # ─────────────────────────────────────────────────────────────────────────
    completed_user = get_or_create_user('completed.investor@finovo.com', 'cycle_complete', 'Felix', 'Dennis', 'United Kingdom', parent=sarah)
    create_investment(completed_user, plans['Package 1'], admin_user, 'comp', status=Investment.Status.COMPLETED)
    all_seeded_users.append(completed_user)
    created_count += 1

    # ─────────────────────────────────────────────────────────────────────────
    # BRANCH 6: Prospective Leads (KYC Pending & Unverified Funnel)
    # ─────────────────────────────────────────────────────────────────────────
    prospects = [
        ('prospect.kyc@finovo.com', 'prospect_kyc', 'Elena', 'Gilbert', 'United States', victor, User.KYCStatus.PENDING),
        ('prospect.new@finovo.com', 'prospect_new', 'Damon', 'Salvatore', 'Italy', sarah, User.KYCStatus.UNVERIFIED),
        ('prospect.rejected@finovo.com', 'prospect_rej', 'Klaus', 'Mikaelson', 'Germany', arthur, User.KYCStatus.REJECTED),
    ]
    for email, uname, fn, ln, ctry, prnt, kyc_st in prospects:
        u = get_or_create_user(email, uname, fn, ln, ctry, parent=prnt, kyc_status=kyc_st)
        all_seeded_users.append(u)
        created_count += 1

    # Final Rank Calculation Sweep
    print("\n--- Recalculating Sponsor Active Levels ---")
    for u in all_seeded_users:
        update_user_active_level(u)

    # 3. Seed Withdrawals & Support Activity
    seed_activity_records(all_seeded_users, admin_user)

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Summary Dashboard Statistics
    # ─────────────────────────────────────────────────────────────────────────
    total_users = User.objects.count()
    total_investments = Investment.objects.count()
    active_investments = Investment.objects.filter(status=Investment.Status.ACTIVE).count()
    pending_investments = Investment.objects.filter(status=Investment.Status.DEPOSIT_PENDING).count()
    completed_investments = Investment.objects.filter(status=Investment.Status.COMPLETED).count()

    from django.db.models import Sum
    total_deposited = Wallet.objects.aggregate(total=Sum('total_deposited'))['total'] or Decimal('0.00')
    total_trading_capital = Wallet.objects.aggregate(total=Sum('total_invested'))['total'] or Decimal('0.00')
    total_commissions = Wallet.objects.aggregate(total=Sum('total_direct_income'))['total'] or Decimal('0.00')
    total_roi_paid = Wallet.objects.aggregate(total=Sum('total_roi_earned'))['total'] or Decimal('0.00')

    print("\n" + "=" * 70)
    print("📊 SEEDING COMPLETE — PRODUCTION PLATFORM METRICS")
    print("=" * 70)
    print(f"  • Total Registered Accounts:   {total_users}")
    print(f"  • Active Package Holdings:     {active_investments}")
    print(f"  • Pending Deposits Queue:      {pending_investments} (Awaiting Admin Review)")
    print(f"  • Completed Investment Cycles: {completed_investments}")
    print(f"  • Total Crypto Deposited:      ${total_deposited:,.2f} USDT")
    print(f"  • Active Trading Capital:      ${total_trading_capital:,.2f}")
    print(f"  • Direct Commissions Paid:     ${total_commissions:,.2f}")
    print(f"  • Weekly ROI Distributed:      ${total_roi_paid:,.2f}")
    print("=" * 70)

    print("\n👑 NETWORK LEADERS & SPONSOR RANKS:")
    leaders = [victor, sarah, arthur, david]
    for leader in leaders:
        leader.refresh_from_db()
        wallet = Wallet.objects.get(user=leader)
        directs_count = leader.direct_children.count()
        active_directs = leader.direct_children.filter(investments__status=Investment.Status.ACTIVE).distinct().count()
        print(f"\n  👤 {leader.full_name} ({leader.email})")
        print(f"     Rank: Direct Lvl {leader.active_level} / ROI Lvl {getattr(leader, 'active_roi_level', 0)} Sponsor | Directs: {active_directs} Active / {directs_count} Total")
        print(f"     Direct Earnings: ${wallet.total_direct_income:,.2f} | Available Balance: ${wallet.balance:,.2f}")
        print(f"     Own Capital: ${wallet.total_invested:,.2f} | Downline Team Volume: ${wallet.team_total_investment:,.2f}")

    print("\n" + "=" * 70)
    print("🔑 KEY TEST CREDENTIALS (All passwords: 'password123')")
    print("=" * 70)
    print("  • Admin Portal:       admin@finovo.com (Superuser Access)")
    print("  • Global Ambassador:  whale.victor@finovo.com (Level 5 Rank, Package 6 Holder)")
    print("  • VP Network Leader:  sarah.investor@finovo.com (Level 4 Rank, Package 5 Holder)")
    print("  • Crypto Founder:     crypto.king@finovo.com (Level 3 Rank, Package 5 Holder)")
    print("  • Branch Downline:    david.ross@finovo.com (Deep 6-Level Downline Network)")
    print("  • Pending Depositor:  pending.trader1@finovo.com (Visible in Admin Review Queue)")
    print("=" * 70 + "\n")


if __name__ == '__main__':
    run_seed()
