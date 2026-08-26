from django.contrib import admin
from django.utils import timezone
from django.db import transaction as db_transaction

from .models import Deposit, Withdrawal


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    """
    Standalone Deposit is now admin-only for manual top-ups / adjustments.
    Users no longer submit deposits directly — deposits are embedded in
    the Investment creation flow and approved via InvestmentAdmin.
    """
    list_display = ('id', 'user', 'amount', 'network', 'status', 'txn_hash', 'created_at')
    list_filter = ('status', 'network', 'created_at')
    search_fields = ('user__email', 'txn_hash', 'id')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')

    actions = ['approve_deposits', 'reject_deposits']

    @admin.action(description='✅ Approve selected manual deposits & credit wallets')
    def approve_deposits(self, request, queryset):
        from apps.wallet.services import credit_wallet
        from apps.wallet.models import WalletTransaction

        count = 0
        for deposit in queryset.filter(status=Deposit.Status.PENDING):
            try:
                with db_transaction.atomic():
                    credit_wallet(
                        user=deposit.user,
                        amount=deposit.amount,
                        category=WalletTransaction.Category.DEPOSIT,
                        description=f'Manual deposit approved #{str(deposit.id)[:8]}',
                        reference_id=str(deposit.id),
                    )
                    deposit.status = Deposit.Status.APPROVED
                    deposit.reviewed_by = request.user
                    deposit.reviewed_at = timezone.now()
                    deposit.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
                    count += 1
            except Exception as exc:
                self.message_user(request, f"Failed for {deposit.user}: {exc}", level='ERROR')

        self.message_user(request, f"{count} deposit(s) approved and wallets credited.")

    @admin.action(description='❌ Reject selected deposits')
    def reject_deposits(self, request, queryset):
        updated = queryset.filter(status=Deposit.Status.PENDING).update(
            status=Deposit.Status.REJECTED
        )
        self.message_user(request, f"{updated} deposit(s) rejected.")


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'withdrawal_type', 'amount', 'net_amount',
        'network', 'status', 'created_at',
    )
    list_filter = ('status', 'withdrawal_type', 'network', 'created_at')
    search_fields = ('user__email', 'wallet_address', 'txn_hash', 'id')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'net_amount')

    actions = ['approve_withdrawals', 'reject_withdrawals']

    @admin.action(description='✅ Approve selected withdrawals & debit wallets')
    def approve_withdrawals(self, request, queryset):
        from apps.wallet.services import debit_wallet
        from apps.wallet.models import WalletTransaction, CompanyWallet

        count = 0
        for withdrawal in queryset.filter(status=Withdrawal.Status.PENDING):
            try:
                with db_transaction.atomic():
                    category = (
                        WalletTransaction.Category.CAPITAL_WITHDRAWAL
                        if withdrawal.withdrawal_type == Withdrawal.WithdrawalType.CAPITAL
                        else WalletTransaction.Category.WITHDRAWAL
                    )
                    debit_wallet(
                        user=withdrawal.user,
                        amount=withdrawal.amount,
                        category=category,
                        description=f'{withdrawal.withdrawal_type} withdrawal to {withdrawal.wallet_address[:12]}…',
                        reference_id=str(withdrawal.id),
                    )

                    fee_amount = withdrawal.amount - withdrawal.net_amount
                    if fee_amount > 0:
                        from apps.wallet.services import credit_company_wallet
                        from apps.wallet.models import CompanyWalletTransaction
                        user_account_info = f"{withdrawal.user.email} (Account ID: #{str(withdrawal.user.id)[:8]})"
                        credit_company_wallet(
                            amount=fee_amount,
                            category=CompanyWalletTransaction.Category.WITHDRAWAL_FEE,
                            description=f"Fee collected from {withdrawal.withdrawal_type} withdrawal #{str(withdrawal.id)[:8]} by {user_account_info}",
                            reference_id=str(withdrawal.id),
                        )

                    withdrawal.status = Withdrawal.Status.APPROVED
                    withdrawal.reviewed_by = request.user
                    withdrawal.reviewed_at = timezone.now()
                    withdrawal.save(
                        update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at']
                    )
                    count += 1
            except ValueError as exc:
                self.message_user(
                    request,
                    f"Insufficient balance for {withdrawal.user}: {exc}",
                    level='ERROR',
                )
            except Exception as exc:
                self.message_user(request, f"Error for {withdrawal.user}: {exc}", level='ERROR')

        self.message_user(request, f"{count} withdrawal(s) approved and wallets debited.")

    @admin.action(description='❌ Reject selected withdrawals')
    def reject_withdrawals(self, request, queryset):
        updated = queryset.filter(status=Withdrawal.Status.PENDING).update(
            status=Withdrawal.Status.REJECTED
        )
        self.message_user(request, f"{updated} withdrawal(s) rejected.")
