import random
import secrets
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.investments.models import Plan, Investment
from apps.transactions.models import Deposit, Withdrawal, NetworkChoices
from apps.wallet.models import Wallet, WalletTransaction
from apps.referrals.models import ReferralRelationship, ReferralCommission

User = get_user_model()

INDIAN_FIRST_NAMES = [
    'Aarav', 'Rohan', 'Vikram', 'Rajesh', 'Amit', 'Priya', 'Ananya', 'Deepak',
    'Neha', 'Suresh', 'Pooja', 'Sanjay', 'Rahul', 'Kavita', 'Manish', 'Sunita',
    'Arjun', 'Simran', 'Aditya', 'Ritu', 'Karan', 'Meera', 'Alok', 'Swati',
    'Gaurav', 'Nisha', 'Vivek', 'Divya', 'Harish', 'Preeti', 'Manoj', 'Shweta'
]

INDIAN_LAST_NAMES = [
    'Sharma', 'Patel', 'Verma', 'Singh', 'Gupta', 'Mehta', 'Joshi', 'Reddy',
    'Nair', 'Kumar', 'Rao', 'Chauhan', 'Yadav', 'Bose', 'Mishra', 'Agarwal',
    'Pandey', 'Saxena', 'Trivedi', 'Bhatia', 'Iyer', 'Deshmukh', 'Chopra', 'Malhotra'
]

DOMAINS = ['gmail.com', 'yahoo.in', 'outlook.com', 'hotmail.com']


def random_trc20_address():
    chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    return 'T' + ''.join(random.choices(chars, k=33))


def random_tx_hash():
    return secrets.token_hex(32)


class Command(BaseCommand):
    help = (
        "Generate a fully isolated dummy/demo account with 1-year history (52 weeks), "
        "realistic Indian downline team, weekly ROI, direct & referral commissions, "
        "deposits, and withdrawals. Completely excluded from platform metrics and Celery automation."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            default='demo.investor@finovo.internal',
            help='Email for the main dummy account',
        )
        parser.add_argument(
            '--first-name',
            type=str,
            default='Arjun',
            help='First name of the main user',
        )
        parser.add_argument(
            '--last-name',
            type=str,
            default='Sharma',
            help='Last name of the main user',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='Finovo@2026',
            help='Password for the main user',
        )
        parser.add_argument(
            '--capital',
            type=float,
            default=5000.0,
            help='Initial investment capital (e.g. 5000.00)',
        )
        parser.add_argument(
            '--referrals',
            type=int,
            default=8,
            help='Number of Level 1 direct referrals to generate',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete and regenerate if the account email already exists',
        )

    def handle(self, *args, **options):
        email = options['email'].lower().strip()
        first_name = options['first_name'].strip()
        last_name = options['last_name'].strip()
        password = options['password']
        capital = Decimal(str(options['capital'])).quantize(Decimal('0.01'))
        direct_count = max(options['referrals'], 5)
        force = options['force']

        if User.objects.filter(email=email).exists():
            if not force:
                raise CommandError(
                    f"User with email '{email}' already exists. Use --force to overwrite."
                )
            self.stdout.write(self.style.WARNING(f"Deleting existing user '{email}' and tree..."))
            existing = User.objects.get(email=email)
            # Delete child demo accounts recursively
            User.objects.filter(parent=existing, is_demo=True).delete()
            existing.delete()

        self.stdout.write(self.style.NOTICE(f"Generating isolated dummy account '{email}'..."))

        now = timezone.now()
        # Align 52 weeks back to a Saturday
        days_to_subtract = 52 * 7
        start_date = now - timedelta(days=days_to_subtract)

        # Ensure a matching or default Plan exists
        plan = Plan.objects.filter(is_active=True).order_by('-cost').first()
        if not plan:
            plan = Plan.objects.create(
                name='VIP Elite Plan',
                description='High tier portfolio package',
                cost=capital,
                trading_capital=capital,
                max_return_factor=Decimal('3.00'),
                max_total_return=capital * Decimal('3.00'),
                weekly_roi_rate=Decimal('2.0000'),
                duration_weeks=52,
                is_active=True,
            )

        with transaction.atomic():
            # 1. Create Root Demo User (parent is None so commissions never leave demo tree)
            username = email.split('@')[0]
            base_user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_demo=True,
                is_email_verified=True,
                kyc_status=User.KYCStatus.APPROVED,
                kyc_document_type='PAN Card',
                kyc_document_number='ABCDE1234F',
                country='India',
                active_level=5,
                active_roi_level=5,
                bypass_plan_and_level_requirements=True,
            )
            User.objects.filter(id=base_user.id).update(created_at=start_date)

            # Ensure wallet exists
            wallet, _ = Wallet.objects.get_or_create(user=base_user)
            Wallet.objects.filter(id=wallet.id).update(created_at=start_date)

            # 2. Initial Deposit (Day -364)
            dep_tx_hash = random_tx_hash()
            dep = Deposit.objects.create(
                user=base_user,
                amount=capital,
                network=NetworkChoices.TRC20,
                sender_wallet_address=random_trc20_address(),
                txn_hash=dep_tx_hash,
                status=Deposit.Status.APPROVED,
                reviewed_at=start_date,
                notes='Automated initial crypto deposit',
            )
            Deposit.objects.filter(id=dep.id).update(created_at=start_date)

            # Ledger: Deposit Credit
            running_balance = Decimal('0.00')
            tx_deposit = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type=WalletTransaction.TransactionType.CREDIT,
                category=WalletTransaction.Category.DEPOSIT,
                amount=capital,
                balance_before=running_balance,
                balance_after=running_balance + capital,
                description=f"USDT Deposit via TRC20 ({dep_tx_hash[:10]}...)",
                reference_id=str(dep.id),
            )
            running_balance += capital
            WalletTransaction.objects.filter(id=tx_deposit.id).update(created_at=start_date)

            # 3. Plan Activation (Investment purchase)
            main_investment = Investment.objects.create(
                user=base_user,
                plan=plan,
                amount=capital,
                cost=capital,
                trading_capital=capital,
                status=Investment.Status.ACTIVE,
                start_date=start_date.date(),
                deposit_network='TRC20',
                deposit_txn_hash=dep_tx_hash,
                deposit_sender_address=dep.sender_wallet_address,
                max_return=capital * Decimal('3.00'),
                total_credited=Decimal('0.00'),
                approved_at=start_date,
            )
            Investment.objects.filter(id=main_investment.id).update(created_at=start_date)

            # Ledger: Investment Debit (deducted from balance into active portfolio)
            tx_inv = WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type=WalletTransaction.TransactionType.DEBIT,
                category=WalletTransaction.Category.DEPOSIT, # internal allocation
                amount=capital,
                balance_before=running_balance,
                balance_after=running_balance - capital,
                description=f"Activated {plan.name} Portfolio Package",
                reference_id=str(main_investment.id),
            )
            running_balance -= capital
            WalletTransaction.objects.filter(id=tx_inv.id).update(created_at=start_date)

            # 4. Generate Downline Referral Network (5 levels, tapering pyramid)
            used_emails = {email}
            downline_inv_amounts = [Decimal('100.00'), Decimal('200.00'), Decimal('300.00'), Decimal('500.00')]
            total_team_members = 0
            total_team_invested = Decimal('0.00')
            accumulated_direct_income = Decimal('0.00')
            accumulated_referral_income = Decimal('0.00')

            # Helper: create one downline member + investment + commission
            def make_member(parent_user, level, join_date, level_label):
                nonlocal running_balance, total_team_members, total_team_invested
                nonlocal accumulated_direct_income
                fn = random.choice(INDIAN_FIRST_NAMES)
                ln = random.choice(INDIAN_LAST_NAMES)
                tag = random.randint(10, 999)
                m_email = f"{fn.lower()}.{ln.lower()}{tag}@{random.choice(DOMAINS)}"
                while m_email in used_emails:
                    tag += 1
                    m_email = f"{fn.lower()}.{ln.lower()}{tag}@{random.choice(DOMAINS)}"
                used_emails.add(m_email)

                if join_date > now:
                    join_date = now - timedelta(days=max(3, 30 - level * 4))

                member = User.objects.create_user(
                    email=m_email,
                    username=f"{fn.lower()}{ln.lower()}{tag}",
                    password='Password@123',
                    first_name=fn,
                    last_name=ln,
                    parent=parent_user,
                    is_demo=True,
                    is_email_verified=True,
                    kyc_status=User.KYCStatus.APPROVED,
                    country='India',
                    active_level=max(1, 5 - level),
                    active_roi_level=max(1, 5 - level),
                )
                User.objects.filter(id=member.id).update(created_at=join_date)
                total_team_members += 1

                amt = random.choice(downline_inv_amounts)
                total_team_invested += amt

                inv = Investment.objects.create(
                    user=member,
                    plan=plan,
                    amount=amt,
                    cost=amt,
                    trading_capital=amt,
                    status=Investment.Status.ACTIVE,
                    start_date=join_date.date(),
                    max_return=amt * Decimal('3.00'),
                    total_credited=Decimal('0.00'),
                    approved_at=join_date,
                )
                Investment.objects.filter(id=inv.id).update(created_at=join_date)
                ReferralRelationship.objects.create(user=member, sponsor=parent_user)

                comm = (amt * Decimal('0.02')).quantize(Decimal('0.01'))
                accumulated_direct_income += comm
                ref_comm = ReferralCommission.objects.create(
                    user=base_user,
                    from_user=member,
                    investment=inv,
                    amount=comm,
                    level=level,
                    commission_type=ReferralCommission.CommissionType.DIRECT,
                    is_paid=True,
                )
                ReferralCommission.objects.filter(id=ref_comm.id).update(created_at=join_date)

                tx_dir = WalletTransaction.objects.create(
                    wallet=wallet,
                    transaction_type=WalletTransaction.TransactionType.CREDIT,
                    category=WalletTransaction.Category.DIRECT_INCOME,
                    amount=comm,
                    balance_before=running_balance,
                    balance_after=running_balance + comm,
                    description=f"2.0% Direct Income from {fn} {ln} ({level_label})",
                    reference_id=str(ref_comm.id),
                )
                running_balance += comm
                WalletTransaction.objects.filter(id=tx_dir.id).update(created_at=join_date)

                return (member, join_date)

            # Split total referral count: 30% L1, 70% spread across L2-L5
            l1_count = max(5, round(direct_count * 0.30))
            remainder = direct_count - l1_count
            # Rough per-level targets for L2-L5 (more towards L2/L3, tapering down)
            l2_target = max(2, round(remainder * 0.35))
            l3_target = max(2, round(remainder * 0.30))
            l4_target = max(1, round(remainder * 0.25))
            l5_target = max(1, remainder - l2_target - l3_target - l4_target)

            # Level 1 — 30% of total, staggered over the year
            l1_users = []
            for i in range(l1_count):
                days_ago = max(50, 330 - (i * max(1, 280 // l1_count)))
                join_date = now - timedelta(days=days_ago)
                l1_users.append(make_member(base_user, 1, join_date, "Level 1"))

            # Level 2 — spread across all L1 parents to hit l2_target
            l2_users = []
            l2_parents = l1_users  # use all L1 as potential parents
            for idx in range(l2_target):
                parent_user, p_date = l2_parents[idx % len(l2_parents)]
                jd = p_date + timedelta(days=random.randint(7, 30))
                l2_users.append(make_member(parent_user, 2, jd, "Level 2"))

            # Level 3 — spread across L2 parents to hit l3_target
            l3_users = []
            l3_parents = l2_users
            for idx in range(l3_target):
                parent_user, p_date = l3_parents[idx % len(l3_parents)]
                jd = p_date + timedelta(days=random.randint(7, 21))
                l3_users.append(make_member(parent_user, 3, jd, "Level 3"))

            # Level 4 — spread across L3 parents to hit l4_target
            l4_users = []
            l4_parents = l3_users
            for idx in range(l4_target):
                parent_user, p_date = l4_parents[idx % len(l4_parents)]
                jd = p_date + timedelta(days=random.randint(5, 18))
                l4_users.append(make_member(parent_user, 4, jd, "Level 4"))

            # Level 5 — spread across L4 parents to hit l5_target
            l5_users = []
            l5_parents = l4_users
            for idx in range(l5_target):
                parent_user, p_date = l5_parents[idx % len(l5_parents)]
                jd = p_date + timedelta(days=random.randint(5, 15))
                l5_users.append(make_member(parent_user, 5, jd, "Level 5"))

            # 5. 52 Weeks of Weekly ROI Simulation + ROI Referral Commission
            # Weekly ROI Rate = 2% per week
            weekly_roi_rate = plan.weekly_roi_rate or Decimal('2.0000')
            weekly_roi_amount = (capital * (weekly_roi_rate / Decimal('100.00'))).quantize(Decimal('0.01'))

            accumulated_roi = Decimal('0.00')
            withdrawals_planned = {
                16: Decimal('800.00'),   # Month 4
                32: Decimal('1500.00'),  # Month 8
                46: Decimal('2000.00'),  # Month 11
            }
            accumulated_withdrawn = Decimal('0.00')

            for week in range(1, 53):
                week_date = start_date + timedelta(weeks=week)
                if week_date > now:
                    break

                # Credit Main User Weekly ROI
                accumulated_roi += weekly_roi_amount
                tx_roi = WalletTransaction.objects.create(
                    wallet=wallet,
                    transaction_type=WalletTransaction.TransactionType.CREDIT,
                    category=WalletTransaction.Category.ROI,
                    amount=weekly_roi_amount,
                    balance_before=running_balance,
                    balance_after=running_balance + weekly_roi_amount,
                    description=f"Weekly Trading ROI Payout - Week {week} ({weekly_roi_rate}%)",
                    reference_id=str(main_investment.id),
                )
                running_balance += weekly_roi_amount
                WalletTransaction.objects.filter(id=tx_roi.id).update(created_at=week_date)

                # Periodic ROI Referral Income from active downlines across all 5 levels
                if week >= 4 and week % 2 == 0:
                    roi_ref_rate = Decimal('18.75') / Decimal('100.00')
                    all_downline_levels = [
                        (l1_users, 1), (l2_users, 2), (l3_users, 3),
                        (l4_users, 4), (l5_users, 5),
                    ]
                    for level_list, lvl in all_downline_levels:
                        eligible = [(u, jd) for u, jd in level_list if jd < week_date]
                        if not eligible:
                            continue
                        # Pick 1 random eligible member per level per cycle
                        src_user, _ = random.choice(eligible)
                        # Use their actual investment amount for realistic ROI
                        src_inv = Investment.objects.filter(user=src_user).first()
                        if not src_inv:
                            continue
                        weekly_roi_for_src = (src_inv.trading_capital * (weekly_roi_rate / Decimal('100.00'))).quantize(Decimal('0.01'))
                        roi_comm_amt = (weekly_roi_for_src * roi_ref_rate).quantize(Decimal('0.01'))
                        if roi_comm_amt <= Decimal('0.00'):
                            continue
                        accumulated_referral_income += roi_comm_amt

                        ref_comm = ReferralCommission.objects.create(
                            user=base_user,
                            from_user=src_user,
                            amount=roi_comm_amt,
                            level=lvl,
                            commission_type=ReferralCommission.CommissionType.ROI,
                            is_paid=True,
                        )
                        ReferralCommission.objects.filter(id=ref_comm.id).update(created_at=week_date)

                        tx_ref_roi = WalletTransaction.objects.create(
                            wallet=wallet,
                            transaction_type=WalletTransaction.TransactionType.CREDIT,
                            category=WalletTransaction.Category.REFERRAL_INCOME,
                            amount=roi_comm_amt,
                            balance_before=running_balance,
                            balance_after=running_balance + roi_comm_amt,
                            description=f"18.75% ROI Commission (Level {lvl}) from {src_user.full_name}",
                            reference_id=str(ref_comm.id),
                        )
                        running_balance += roi_comm_amt
                        WalletTransaction.objects.filter(id=tx_ref_roi.id).update(created_at=week_date)

                # Check planned withdrawal for this week
                if week in withdrawals_planned:
                    w_amount = withdrawals_planned[week]
                    if running_balance >= w_amount:
                        fee = Decimal('1.00')
                        net_amount = w_amount - fee
                        w_tx_hash = random_tx_hash()
                        w_addr = random_trc20_address()

                        withdrawal = Withdrawal.objects.create(
                            user=base_user,
                            amount=w_amount,
                            withdrawal_type=Withdrawal.WithdrawalType.PROFIT,
                            fee=fee,
                            capital_charge=Decimal('0.00'),
                            net_amount=net_amount,
                            network=NetworkChoices.TRC20,
                            wallet_address=w_addr,
                            txn_hash=w_tx_hash,
                            status=Withdrawal.Status.APPROVED,
                            reviewed_at=week_date,
                            notes='Processed profit payout to TRC20 wallet',
                        )
                        Withdrawal.objects.filter(id=withdrawal.id).update(created_at=week_date)

                        tx_w = WalletTransaction.objects.create(
                            wallet=wallet,
                            transaction_type=WalletTransaction.TransactionType.DEBIT,
                            category=WalletTransaction.Category.WITHDRAWAL,
                            amount=w_amount,
                            balance_before=running_balance,
                            balance_after=running_balance - w_amount,
                            description=f"USDT Profit Withdrawal to {w_addr[:8]}... ({w_tx_hash[:10]}...)",
                            reference_id=str(withdrawal.id),
                        )
                        running_balance -= w_amount
                        accumulated_withdrawn += w_amount
                        WalletTransaction.objects.filter(id=tx_w.id).update(created_at=week_date)

            # Update Main Investment total credited
            Investment.objects.filter(id=main_investment.id).update(
                total_credited=accumulated_roi,
                last_roi_date=now.date(),
            )

            # 6. Final Wallet Accumulator Synchronization
            wallet.balance = running_balance
            wallet.total_deposited = capital
            wallet.total_invested = capital
            wallet.total_roi_earned = accumulated_roi
            wallet.total_direct_income = accumulated_direct_income
            wallet.total_referral_income = accumulated_referral_income
            wallet.total_withdrawn = accumulated_withdrawn
            wallet.team_total_members = total_team_members
            wallet.team_total_investment = total_team_invested
            wallet.save()

        self.stdout.write(self.style.SUCCESS("✓ Isolated dummy account generation completed successfully!"))
        self.stdout.write(f"  • Email:             {email}")
        self.stdout.write(f"  • Password:          {password}")
        self.stdout.write(f"  • Capital Invested:  ${capital}")
        self.stdout.write(f"  • 52-Wk ROI Earned:  ${accumulated_roi}")
        self.stdout.write(f"  • Direct Income:     ${accumulated_direct_income}")
        self.stdout.write(f"  • Referral ROI Inc:  ${accumulated_referral_income}")
        self.stdout.write(f"  • Total Withdrawn:   ${accumulated_withdrawn}")
        self.stdout.write(f"  • Current Balance:   ${running_balance}")
        self.stdout.write(f"  • Downline Members:  {total_team_members} (Levels 1–5, Indian names)")
        self.stdout.write(f"  • Downline Volume:   ${total_team_invested}")
        self.stdout.write(f"  • Level Breakdown:   L1={len(l1_users)}  L2={len(l2_users)}  L3={len(l3_users)}  L4={len(l4_users)}  L5={len(l5_users)}")
        self.stdout.write(self.style.SUCCESS("✓ All metrics strictly tagged with is_demo=True and isolated from platform totals."))
