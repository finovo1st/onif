from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Deposit, Withdrawal
from .serializers import DepositSerializer, WithdrawalSerializer


class WithdrawalRequestOTPView(APIView):
    """
    POST /api/v1/withdrawals/request-otp/
    Dispatches a 6-digit withdrawal verification OTP to the authenticated user's email.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.services import send_withdrawal_otp_email
        try:
            send_withdrawal_otp_email(request.user)
            return Response({
                'detail': 'Withdrawal authorization code has been sent to your registered email.'
            }, status=status.HTTP_200_OK)
        except Exception:
            return Response({
                'detail': 'Failed to send withdrawal authorization OTP. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepositListView(generics.ListAPIView):
    """
    GET /api/v1/deposits/ — Admin-only: list all manual deposits.

    User-facing deposits are now embedded in the investment flow.
    Users create investments with deposit proof via POST /api/v1/investments/.
    """
    serializer_class = DepositSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['status', 'network']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        return Deposit.objects.all()


class DepositDetailView(generics.RetrieveAPIView):
    """GET /api/v1/deposits/{id}/ — Admin-only: single deposit detail."""
    serializer_class = DepositSerializer
    permission_classes = [IsAdminUser]
    queryset = Deposit.objects.all()


class WithdrawalListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/withdrawals/ — My withdrawal history.
    POST /api/v1/withdrawals/ — Request a withdrawal from earned wallet balance.
    """
    serializer_class = WithdrawalSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'withdrawal_type', 'network']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        return self.request.user.withdrawals.all()

    def perform_create(self, serializer):
        withdrawal = serializer.save(user=self.request.user)
        from apps.notifications.emails import notify_withdrawal_requested
        notify_withdrawal_requested(withdrawal)


class WithdrawalDetailView(generics.RetrieveAPIView):
    """GET /api/v1/withdrawals/{id}/ — Single withdrawal detail."""
    serializer_class = WithdrawalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.withdrawals.all()
