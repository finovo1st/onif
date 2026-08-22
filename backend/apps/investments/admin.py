from django.contrib import admin
from django.utils import timezone
from django.db import transaction as db_transaction

from .models import Plan, Investment


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'cost', 'trading_capital', 'max_return_factor', 'max_total_return', 'weekly_roi_rate', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    ordering = ('cost',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'plan', 'cost', 'trading_capital', 'status',
        'total_credited', 'max_return',
        'deposit_network', 'deposit_txn_hash',
        'start_date', 'end_date',
    )
    list_filter = ('status', 'plan', 'deposit_network', 'created_at')
    search_fields = ('user__email', 'user__username', 'id', 'deposit_txn_hash')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'approved_by', 'approved_at')

    fieldsets = (
        ('Investment Info', {
            'fields': ('id', 'user', 'plan', 'cost', 'trading_capital', 'amount', 'max_return', 'total_credited', 'status')
        }),
        ('Approval', {
            'fields': ('approved_by', 'approved_at', 'rejection_reason')
        }),
        ('Timeline', {
            'fields': ('start_date', 'end_date', 'last_roi_date')
        }),
        ('Deposit Proof', {
            'fields': (
                'deposit_network', 'deposit_txn_hash',
                'deposit_sender_address', 'deposit_proof',
                'deposit_submitted_at',
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    actions = ['approve_investments', 'reject_investments', 'cancel_investments']

    @admin.action(description='✅ Approve deposit & activate selected investments')
    def approve_investments(self, request, queryset):
        from apps.investments.services import activate_investment
        from apps.investments.tasks import distribute_direct_income_task

        eligible = queryset.filter(
            status__in=[Investment.Status.DEPOSIT_PENDING, Investment.Status.PENDING]
        )
        count = 0
        for investment in eligible:
            try:
                with db_transaction.atomic():
                    activate_investment(investment, request.user)
                distribute_direct_income_task.delay(str(investment.id))
                count += 1
            except Exception as exc:
                self.message_user(
                    request,
                    f"Failed to activate investment {str(investment.id)[:8]}: {exc}",
                    level='ERROR',
                )

        self.message_user(
            request,
            f"{count} investment(s) approved, activated, and direct income distribution queued.",
        )

    @admin.action(description='❌ Reject selected investments (deposit rejected)')
    def reject_investments(self, request, queryset):
        updated = queryset.filter(
            status=Investment.Status.DEPOSIT_PENDING
        ).update(status=Investment.Status.REJECTED)
        self.message_user(request, f"{updated} investment(s) rejected.")

    @admin.action(description='🚫 Cancel selected investments')
    def cancel_investments(self, request, queryset):
        updated = queryset.filter(
            status__in=[Investment.Status.DEPOSIT_PENDING, Investment.Status.PENDING]
        ).update(status=Investment.Status.CANCELLED)
        self.message_user(request, f"{updated} investment(s) cancelled.")
