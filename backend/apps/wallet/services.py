"""
Wallet Service Layer
====================
All wallet balance mutations live here. Every function runs inside
an atomic DB transaction and uses select_for_update() to prevent
race conditions. Never mutate Wallet.balance directly — always call
one of these functions.
"""
from decimal import Decimal
from django.db import transaction
from django.contrib.auth import get_user_model

from apps.wallet.models import Wallet, WalletTransaction, CompanyWallet, CompanyWalletTransaction

User = get_user_model()


def _get_or_create_wallet(user) -> Wallet:
    """Return the wallet for user, creating it if it does not yet exist."""
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


@transaction.atomic
def credit_wallet(
    user,
    amount: Decimal,
    category: str,
    description: str = '',
    reference_id: str = '',
) -> WalletTransaction:
    """
    Credit `amount` to the user's wallet.

    Updates balance and the relevant accumulator field.
    Creates an immutable WalletTransaction ledger entry.
    Returns the WalletTransaction created.
    """
    wallet = Wallet.objects.select_for_update().get_or_create(user=user)[0]

    balance_before = wallet.balance
    wallet.balance += amount

    # Update the appropriate lifetime accumulator
    cat = WalletTransaction.Category
    if category == cat.DEPOSIT:
        wallet.total_deposited += amount
    elif category == cat.ROI:
        wallet.total_roi_earned += amount
    elif category == cat.DIRECT_INCOME:
        wallet.total_direct_income += amount
    elif category in (cat.REFERRAL_INCOME,):
        wallet.total_referral_income += amount

    wallet.save(update_fields=[
        'balance', 'updated_at',
        'total_deposited', 'total_roi_earned',
        'total_direct_income', 'total_referral_income',
    ])

    return WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
        category=category,
        amount=amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=description,
        reference_id=reference_id,
    )


@transaction.atomic
def debit_wallet(
    user,
    amount: Decimal,
    category: str,
    description: str = '',
    reference_id: str = '',
) -> WalletTransaction:
    """
    Debit `amount` from the user's wallet.

    Raises ValueError if balance is insufficient.
    """
    wallet = Wallet.objects.select_for_update().get_or_create(user=user)[0]

    if wallet.balance < amount:
        raise ValueError(
            f"Insufficient balance: has ${wallet.balance}, needs ${amount}"
        )

    balance_before = wallet.balance
    wallet.balance -= amount

    cat = WalletTransaction.Category
    if category == cat.WITHDRAWAL:
        wallet.total_withdrawn += amount
    elif category == cat.CAPITAL_WITHDRAWAL:
        wallet.total_withdrawn += amount

    wallet.save(update_fields=['balance', 'updated_at', 'total_withdrawn'])

    return WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=WalletTransaction.TransactionType.DEBIT,
        category=category,
        amount=amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=description,
        reference_id=reference_id,
    )


@transaction.atomic
def credit_company_wallet(
    amount: Decimal,
    category: str,
    description: str = '',
    reference_id: str = '',
) -> CompanyWalletTransaction:
    """
    Credit `amount` to the singleton CompanyWallet.
    Creates an immutable CompanyWalletTransaction ledger entry.
    """
    wallet = CompanyWallet.objects.select_for_update().get_or_create(id=1)[0]

    balance_before = wallet.balance
    wallet.balance += amount
    wallet.save(update_fields=['balance', 'updated_at'])

    return CompanyWalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=CompanyWalletTransaction.TransactionType.CREDIT,
        category=category,
        amount=amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=description,
        reference_id=reference_id,
    )


@transaction.atomic
def debit_company_wallet(
    amount: Decimal,
    category: str,
    description: str = '',
    reference_id: str = '',
    allow_negative: bool = True,
) -> CompanyWalletTransaction:
    """
    Debit `amount` from the singleton CompanyWallet.
    Creates an immutable CompanyWalletTransaction ledger entry.

    allow_negative: if False, raises ValueError when balance < amount.
                    Defaults to True for bookkeeping entries (e.g. generation
                    adjustments) that can legitimately take the balance negative.
    """
    wallet = CompanyWallet.objects.select_for_update().get_or_create(id=1)[0]

    if not allow_negative and wallet.balance < amount:
        raise ValueError(
            f"Insufficient company wallet balance: has ${wallet.balance}, needs ${amount}"
        )

    balance_before = wallet.balance
    wallet.balance -= amount
    wallet.save(update_fields=['balance', 'updated_at'])

    return CompanyWalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=CompanyWalletTransaction.TransactionType.DEBIT,
        category=category,
        amount=amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=description,
        reference_id=reference_id,
    )

