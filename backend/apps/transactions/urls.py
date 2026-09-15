from django.urls import path
from .views import (
    DepositListView, DepositDetailView,
    WithdrawalListCreateView, WithdrawalDetailView,
    WithdrawalRequestOTPView,
)

urlpatterns = [
    path('deposits/', DepositListView.as_view(), name='deposit_list'),
    path('deposits/<uuid:pk>/', DepositDetailView.as_view(), name='deposit_detail'),
    path('withdrawals/', WithdrawalListCreateView.as_view(), name='withdrawal_list_create'),
    path('withdrawals/request-otp/', WithdrawalRequestOTPView.as_view(), name='withdrawal_request_otp'),
    path('withdrawals/<uuid:pk>/', WithdrawalDetailView.as_view(), name='withdrawal_detail'),
]
