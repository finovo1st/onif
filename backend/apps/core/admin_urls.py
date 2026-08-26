from django.urls import path
from .admin_views import (
    AdminOverviewView,
    AdminInvestmentListView,
    AdminInvestmentDetailView,
    AdminInvestmentApproveView,
    AdminInvestmentRejectView,
    AdminWithdrawalListView,
    AdminWithdrawalDetailView,
    AdminWithdrawalApproveView,
    AdminWithdrawalRejectView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserBalanceAdjustView,
    AdminUserTeamStatsView,
    AdminTicketListView,
    AdminTicketDetailView,
    AdminTicketReplyView,
    AdminTicketStatusView,
    AdminPlatformSettingsListView,
    AdminPlatformSettingUpdateView,
    AdminPlanListCreateView,
    AdminPlanDetailView,
    AdminTriggerROIEngineView,
    AdminCompanyFundsLedgerView,
    AdminCompanyFundsSummaryView,
    AdminCompanyFundsAdjustView,
)

app_name = 'admin_panel'

urlpatterns = [
    # Overview
    path('overview/', AdminOverviewView.as_view(), name='overview'),

    # Company Funds & Treasury Ledger
    path('funds/', AdminCompanyFundsLedgerView.as_view(), name='funds_ledger'),
    path('funds/summary/', AdminCompanyFundsSummaryView.as_view(), name='funds_summary'),
    path('funds/adjust/', AdminCompanyFundsAdjustView.as_view(), name='funds_adjust'),

    # Investments & Deposit Approvals
    path('investments/', AdminInvestmentListView.as_view(), name='investments_list'),
    path('investments/<uuid:pk>/', AdminInvestmentDetailView.as_view(), name='investments_detail'),
    path('investments/<uuid:pk>/approve/', AdminInvestmentApproveView.as_view(), name='investments_approve'),
    path('investments/<uuid:pk>/reject/', AdminInvestmentRejectView.as_view(), name='investments_reject'),

    # Withdrawals
    path('withdrawals/', AdminWithdrawalListView.as_view(), name='withdrawals_list'),
    path('withdrawals/<uuid:pk>/', AdminWithdrawalDetailView.as_view(), name='withdrawals_detail'),
    path('withdrawals/<uuid:pk>/approve/', AdminWithdrawalApproveView.as_view(), name='withdrawals_approve'),
    path('withdrawals/<uuid:pk>/reject/', AdminWithdrawalRejectView.as_view(), name='withdrawals_reject'),

    # Users & Balance Adjustments & Team Network
    path('users/', AdminUserListView.as_view(), name='users_list'),
    path('users/<uuid:pk>/', AdminUserDetailView.as_view(), name='users_detail'),
    path('users/<uuid:pk>/team/', AdminUserTeamStatsView.as_view(), name='users_team'),
    path('users/<uuid:pk>/adjust-balance/', AdminUserBalanceAdjustView.as_view(), name='users_adjust_balance'),

    # Support Tickets
    path('tickets/', AdminTicketListView.as_view(), name='tickets_list'),
    path('tickets/<uuid:pk>/', AdminTicketDetailView.as_view(), name='tickets_detail'),
    path('tickets/<uuid:pk>/reply/', AdminTicketReplyView.as_view(), name='tickets_reply'),
    path('tickets/<uuid:pk>/status/', AdminTicketStatusView.as_view(), name='tickets_status'),

    # Platform Settings
    path('settings/', AdminPlatformSettingsListView.as_view(), name='settings_list'),
    path('settings/<str:key>/', AdminPlatformSettingUpdateView.as_view(), name='settings_update'),

    # Plans
    path('plans/', AdminPlanListCreateView.as_view(), name='plans_list'),
    path('plans/<uuid:pk>/', AdminPlanDetailView.as_view(), name='plans_detail'),

    # Actions
    path('actions/trigger-roi/', AdminTriggerROIEngineView.as_view(), name='trigger_roi'),
]
