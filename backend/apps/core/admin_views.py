import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction
from django.db import models
from django.db.models import Sum, Q, Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.investments.models import Investment, Plan
from apps.investments.services import (
    activate_investment,
    distribute_direct_income,
    distribute_roi_for_investment,
    update_user_active_level,
)
from apps.transactions.models import Withdrawal, Deposit
from apps.wallet.models import Wallet, WalletTransaction, CompanyWallet, CompanyWalletTransaction
from apps.wallet.services import credit_wallet, debit_wallet, credit_company_wallet, debit_company_wallet
from apps.support.models import Ticket, TicketReply
from apps.referrals.models import ReferralCommission
from apps.core.models import PlatformSettings, AuditLog
from apps.core.permissions import IsAdminRoleOrStaff, IsSuperAdminOnly
from apps.core.admin_serializers import (
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    AdminBalanceAdjustmentSerializer,
    AdminInvestmentSerializer,
    AdminWithdrawalSerializer,
    AdminTicketSerializer,
    AdminTicketReplySerializer,
    AdminPlatformSettingSerializer,
    AdminPlanSerializer,
    AdminCompanyWalletTransactionSerializer,
    AdminCompanyFundsAdjustmentSerializer,
)

User = get_user_model()


class AdminOverviewView(APIView):
    """
    GET /api/v1/admin-panel/overview/
    Returns platform-wide metrics, counts, liabilities, and pending action queues.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def get(self, request):
        # Users
        total_users = User.objects.count()
        verified_users = User.objects.filter(is_email_verified=True).count()
        pending_kyc_count = User.objects.filter(kyc_status=User.KYCStatus.PENDING).count()
        active_users_count = User.objects.filter(
            investments__status=Investment.Status.ACTIVE
        ).distinct().count()

        # Investments
        active_investments_qs = Investment.objects.filter(status=Investment.Status.ACTIVE)
        active_investments_count = active_investments_qs.count()
        active_investments_total = active_investments_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        pending_investments_qs = Investment.objects.filter(
            status__in=[Investment.Status.DEPOSIT_PENDING, Investment.Status.PENDING]
        )
        pending_investments_count = pending_investments_qs.count()
        pending_investments_total = pending_investments_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_investments_total = Investment.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Withdrawals
        pending_withdrawals_qs = Withdrawal.objects.filter(status=Withdrawal.Status.PENDING)
        pending_withdrawals_count = pending_withdrawals_qs.count()
        pending_withdrawals_total = pending_withdrawals_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        approved_withdrawals_qs = Withdrawal.objects.filter(status=Withdrawal.Status.APPROVED)
        approved_withdrawals_count = approved_withdrawals_qs.count()
        approved_withdrawals_total = approved_withdrawals_qs.aggregate(total=Sum('net_amount'))['total'] or Decimal('0.00')

        # Wallets & Liabilities
        total_system_balance = Wallet.objects.aggregate(total=Sum('balance'))['total'] or Decimal('0.00')
        total_system_deposited = Wallet.objects.aggregate(total=Sum('total_deposited'))['total'] or Decimal('0.00')
        total_roi_earned = Wallet.objects.aggregate(total=Sum('total_roi_earned'))['total'] or Decimal('0.00')
        total_direct_income = Wallet.objects.aggregate(total=Sum('total_direct_income'))['total'] or Decimal('0.00')
        company_wallet_balance = CompanyWallet.get_wallet().balance

        # Support Tickets
        open_tickets_count = Ticket.objects.filter(status=Ticket.Status.OPEN).count()
        in_progress_tickets_count = Ticket.objects.filter(status=Ticket.Status.IN_PROGRESS).count()

        # Action Queues
        recent_pending_investments = AdminInvestmentSerializer(
            pending_investments_qs.select_related('user', 'plan')[:6],
            many=True,
            context={'request': request},
        ).data

        recent_pending_withdrawals = AdminWithdrawalSerializer(
            pending_withdrawals_qs.select_related('user')[:6],
            many=True,
            context={'request': request},
        ).data

        recent_tickets = AdminTicketSerializer(
            Ticket.objects.select_related('user').prefetch_related('replies')[:6],
            many=True,
        ).data

        return Response({
            'users': {
                'total': total_users,
                'verified': verified_users,
                'active': active_users_count,
                'pending_kyc': pending_kyc_count,
            },
            'investments': {
                'active_count': active_investments_count,
                'active_total': float(active_investments_total),
                'pending_count': pending_investments_count,
                'pending_total': float(pending_investments_total),
                'all_time_total': float(total_investments_total),
            },
            'withdrawals': {
                'pending_count': pending_withdrawals_count,
                'pending_total': float(pending_withdrawals_total),
                'approved_count': approved_withdrawals_count,
                'approved_total': float(approved_withdrawals_total),
            },
            'finances': {
                'total_system_balance': float(total_system_balance),
                'total_system_deposited': float(total_system_deposited),
                'total_roi_earned': float(total_roi_earned),
                'total_direct_income': float(total_direct_income),
                'company_wallet_balance': float(company_wallet_balance),
            },
            'support': {
                'open_tickets': open_tickets_count,
                'in_progress_tickets': in_progress_tickets_count,
            },
            'queues': {
                'pending_investments': recent_pending_investments,
                'pending_withdrawals': recent_pending_withdrawals,
                'recent_tickets': recent_tickets,
            },
        })


class AdminInvestmentListView(generics.ListAPIView):
    """
    GET /api/v1/admin-panel/investments/
    Query parameters:
      - ?status=DEPOSIT_PENDING (or ACTIVE, REJECTED, COMPLETED, all)
      - ?search=... (email, username, txn hash)
    """
    serializer_class = AdminInvestmentSerializer
    permission_classes = [IsAdminRoleOrStaff]

    def get_queryset(self):
        qs = Investment.objects.select_related('user', 'plan', 'approved_by').order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param.upper())
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(user__email__icontains=search) |
                Q(user__username__icontains=search) |
                Q(deposit_txn_hash__icontains=search) |
                Q(id__icontains=search)
            )
        return qs


class AdminInvestmentDetailView(generics.RetrieveAPIView):
    """GET /api/v1/admin-panel/investments/{id}/"""
    serializer_class = AdminInvestmentSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = Investment.objects.select_related('user', 'plan', 'approved_by').all()


class AdminInvestmentApproveView(APIView):
    """
    POST /api/v1/admin-panel/investments/{id}/approve/
    Approves deposit and activates investment.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def post(self, request, pk):
        investment = get_object_or_404(
            Investment.objects.select_related('user', 'plan'),
            pk=pk
        )

        if investment.status not in [Investment.Status.DEPOSIT_PENDING, Investment.Status.PENDING]:
            return Response(
                {'detail': f"Investment cannot be approved from status '{investment.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with db_transaction.atomic():
            # 1. Activate investment
            activate_investment(investment, request.user)

            # 2. Distribute direct commission to upline
            commissions = distribute_direct_income(investment)

            # 3. Update sponsor active levels
            curr = investment.user.parent
            while curr:
                update_user_active_level(curr)
                curr = curr.parent

            # 4. Audit Log
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.INVESTMENT_APPROVED,
                ip_address=request.META.get('REMOTE_ADDR'),
                new_value={
                    'investment_id': str(investment.id),
                    'user': investment.user.email,
                    'amount': str(investment.amount),
                    'plan': investment.plan.name,
                    'commissions_count': len(commissions),
                }
            )

        return Response({
            'detail': f"Investment #{str(investment.id)[:8]} approved and activated successfully.",
            'investment': AdminInvestmentSerializer(investment, context={'request': request}).data,
        }, status=status.HTTP_200_OK)


class AdminInvestmentRejectView(APIView):
    """
    POST /api/v1/admin-panel/investments/{id}/reject/
    Rejects deposit proof and marks investment REJECTED.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def post(self, request, pk):
        investment = get_object_or_404(Investment, pk=pk)
        if investment.status not in [Investment.Status.DEPOSIT_PENDING, Investment.Status.PENDING]:
            return Response(
                {'detail': f"Investment cannot be rejected from status '{investment.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'Deposit verification rejected by administrator.')
        investment.status = Investment.Status.REJECTED
        investment.rejection_reason = reason
        investment.approved_by = request.user
        investment.approved_at = timezone.now()
        investment.save(update_fields=['status', 'rejection_reason', 'approved_by', 'approved_at', 'updated_at'])

        # Audit Log
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.INVESTMENT_REJECTED,
            ip_address=request.META.get('REMOTE_ADDR'),
            new_value={'investment_id': str(investment.id), 'reason': reason}
        )

        return Response({
            'detail': f"Investment #{str(investment.id)[:8]} rejected.",
            'investment': AdminInvestmentSerializer(investment, context={'request': request}).data,
        })


class AdminWithdrawalListView(generics.ListAPIView):
    """
    GET /api/v1/admin-panel/withdrawals/
    Query parameters:
      - ?status=PENDING (or APPROVED, REJECTED, all)
      - ?search=... (email, username, wallet address, tx hash)
    """
    serializer_class = AdminWithdrawalSerializer
    permission_classes = [IsAdminRoleOrStaff]

    def get_queryset(self):
        qs = Withdrawal.objects.select_related('user', 'reviewed_by').order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param.upper())
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(user__email__icontains=search) |
                Q(user__username__icontains=search) |
                Q(wallet_address__icontains=search) |
                Q(txn_hash__icontains=search) |
                Q(id__icontains=search)
            )
        return qs


class AdminWithdrawalDetailView(generics.RetrieveAPIView):
    """GET /api/v1/admin-panel/withdrawals/{id}/"""
    serializer_class = AdminWithdrawalSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = Withdrawal.objects.select_related('user', 'reviewed_by').all()


class AdminWithdrawalApproveView(APIView):
    """
    POST /api/v1/admin-panel/withdrawals/{id}/approve/
    Approves withdrawal and debits user wallet.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def post(self, request, pk):
        withdrawal = get_object_or_404(Withdrawal.objects.select_related('user'), pk=pk)
        if withdrawal.status != Withdrawal.Status.PENDING:
            return Response(
                {'detail': f"Withdrawal is already in '{withdrawal.status}' status."},
                status=status.HTTP_400_BAD_REQUEST
            )

        txn_hash = request.data.get('txn_hash', '')

        with db_transaction.atomic():
            category = (
                WalletTransaction.Category.CAPITAL_WITHDRAWAL
                if withdrawal.withdrawal_type == Withdrawal.WithdrawalType.CAPITAL
                else WalletTransaction.Category.WITHDRAWAL
            )

            # Debit wallet balance
            debit_wallet(
                user=withdrawal.user,
                amount=withdrawal.amount,
                category=category,
                description=f"{withdrawal.withdrawal_type} withdrawal to {withdrawal.wallet_address[:12]}...",
                reference_id=str(withdrawal.id),
            )

            # Credit fee to Company Wallet if applicable
            fee_amount = withdrawal.amount - withdrawal.net_amount
            if fee_amount > Decimal('0.00'):
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
            if txn_hash:
                withdrawal.txn_hash = txn_hash
            withdrawal.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'txn_hash', 'updated_at'])

            # Audit Log
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.WITHDRAWAL_APPROVED,
                ip_address=request.META.get('REMOTE_ADDR'),
                new_value={
                    'withdrawal_id': str(withdrawal.id),
                    'user': withdrawal.user.email,
                    'amount': str(withdrawal.amount),
                    'net_amount': str(withdrawal.net_amount),
                    'txn_hash': txn_hash,
                }
            )

        return Response({
            'detail': f"Withdrawal #{str(withdrawal.id)[:8]} approved and wallet debited.",
            'withdrawal': AdminWithdrawalSerializer(withdrawal).data,
        })


class AdminWithdrawalRejectView(APIView):
    """
    POST /api/v1/admin-panel/withdrawals/{id}/reject/
    Rejects withdrawal request.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def post(self, request, pk):
        withdrawal = get_object_or_404(Withdrawal, pk=pk)
        if withdrawal.status != Withdrawal.Status.PENDING:
            return Response(
                {'detail': f"Withdrawal is already in '{withdrawal.status}' status."},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', 'Withdrawal rejected by administrator.')
        withdrawal.status = Withdrawal.Status.REJECTED
        withdrawal.notes = reason
        withdrawal.reviewed_by = request.user
        withdrawal.reviewed_at = timezone.now()
        withdrawal.save(update_fields=['status', 'notes', 'reviewed_by', 'reviewed_at', 'updated_at'])

        # Audit Log
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.WITHDRAWAL_REJECTED,
            ip_address=request.META.get('REMOTE_ADDR'),
            new_value={'withdrawal_id': str(withdrawal.id), 'reason': reason}
        )

        return Response({
            'detail': f"Withdrawal #{str(withdrawal.id)[:8]} rejected.",
            'withdrawal': AdminWithdrawalSerializer(withdrawal).data,
        })


class AdminUserListView(generics.ListAPIView):
    """
    GET /api/v1/admin-panel/users/
    Query parameters:
      - ?search=... (email, username, referral code)
      - ?role=... (ADMIN, USER, SUPPORT, FINANCE)
      - ?kyc_status=... (APPROVED, PENDING, UNVERIFIED, REJECTED)
    """
    serializer_class = AdminUserListSerializer
    permission_classes = [IsAdminRoleOrStaff]

    def get_queryset(self):
        qs = User.objects.select_related('parent', 'wallet').prefetch_related('investments').order_by('-created_at')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(username__icontains=search) |
                Q(referral_code__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role.upper())
        kyc = self.request.query_params.get('kyc_status')
        if kyc:
            qs = qs.filter(kyc_status=kyc.upper())
        return qs


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/v1/admin-panel/users/{id}/
    PATCH /api/v1/admin-panel/users/{id}/ (Update role, kyc_status, is_staff, is_active)
    """
    permission_classes = [IsAdminRoleOrStaff]
    queryset = User.objects.select_related('parent', 'wallet').prefetch_related('investments').all()

    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return AdminUserUpdateSerializer
        return AdminUserListSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        if 'kyc_status' in serializer.validated_data:
            instance.kyc_reviewed_at = timezone.now()
            instance.save(update_fields=['kyc_reviewed_at'])



class AdminUserTeamStatsView(APIView):
    """
    GET /api/v1/admin-panel/users/{id}/team/
    Returns 5-level team hierarchy details for an admin.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        levels_data = []
        
        current_parents = [user.id]
        total_members_all = 0
        total_inv_all = Decimal('0.00')
        total_dir_inc_all = Decimal('0.00')
        total_roi_inc_all = Decimal('0.00')

        for level in range(1, 6):
            if current_parents:
                level_users = list(User.objects.filter(parent_id__in=current_parents).values('id', 'email', 'first_name', 'last_name', 'username', 'created_at', 'active_level'))
                level_user_ids = [u['id'] for u in level_users]
            else:
                level_users = []
                level_user_ids = []

            count = len(level_user_ids)
            total_members_all += count

            if level_user_ids:
                total_inv = Investment.objects.filter(
                    user_id__in=level_user_ids,
                    status__in=[Investment.Status.ACTIVE, Investment.Status.COMPLETED]
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            else:
                total_inv = Decimal('0.00')

            total_inv_all += total_inv

            # Direct and ROI commission user earned from this level
            level_commissions = ReferralCommission.objects.filter(user=user, level=level, is_paid=True)
            
            # Combine DIRECT and ROI aggregations into a single query
            totals = level_commissions.aggregate(
                dir_total=Sum('amount', filter=models.Q(commission_type=ReferralCommission.CommissionType.DIRECT)),
                roi_total=Sum('amount', filter=models.Q(commission_type=ReferralCommission.CommissionType.ROI))
            )
            
            dir_inc = totals['dir_total'] or Decimal('0.00')
            roi_inc = totals['roi_total'] or Decimal('0.00')

            total_dir_inc_all += dir_inc
            total_roi_inc_all += roi_inc

            levels_data.append({
                'level': level,
                'total_refers': count,
                'total_investment': float(total_inv),
                'direct_income': float(dir_inc),
                'roi_income': float(roi_inc),
                'members': [{
                    'id': str(u['id']),
                    'email': u['email'],
                    'full_name': f"{u['first_name']} {u['last_name']}".strip() or u['email'],
                    'created_at': u['created_at'].isoformat() if u['created_at'] else None,
                    'active_level': u['active_level'],
                } for u in level_users[:25]]
            })

            current_parents = level_user_ids

        return Response({
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': user.full_name,
                'active_level': user.active_level,
                'referral_code': user.referral_code,
            },
            'summary': {
                'total_team_members': total_members_all,
                'total_team_investment': float(total_inv_all),
                'total_direct_income': float(total_dir_inc_all),
                'total_referral_roi_income': float(total_roi_inc_all),
            },
            'levels': levels_data
        })



class AdminUserBalanceAdjustView(APIView):
    """
    POST /api/v1/admin-panel/users/{id}/adjust-balance/
    Body:
      {
        "action": "CREDIT" | "DEBIT",
        "amount": 100.00,
        "reason": "Administrative adjustment / promotion"
      }
    """
    permission_classes = [IsSuperAdminOnly]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        serializer = AdminBalanceAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']

        with db_transaction.atomic():
            ref_id = f"ADM-{uuid.uuid4().hex[:8].upper()}"
            if action == 'CREDIT':
                txn = credit_wallet(
                    user=user,
                    amount=amount,
                    category=WalletTransaction.Category.ADJUSTMENT,
                    description=f"Admin Manual Credit: {reason}",
                    reference_id=ref_id,
                )
            else:
                txn = debit_wallet(
                    user=user,
                    amount=amount,
                    category=WalletTransaction.Category.ADJUSTMENT,
                    description=f"Admin Manual Debit: {reason}",
                    reference_id=ref_id,
                )

            # Audit Log
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.WALLET_CREDITED if action == 'CREDIT' else AuditLog.Action.WALLET_DEBITED,
                ip_address=request.META.get('REMOTE_ADDR'),
                new_value={
                    'target_user': user.email,
                    'action': action,
                    'amount': str(amount),
                    'reason': reason,
                    'balance_after': str(txn.balance_after),
                }
            )

        return Response({
            'detail': f"Successfully {action.lower()}ed ${amount} to {user.email}.",
            'balance_after': float(txn.balance_after),
            'reference_id': ref_id,
        })


class AdminTicketListView(generics.ListAPIView):
    """
    GET /api/v1/admin-panel/tickets/
    Query parameters:
      - ?status=OPEN (or IN_PROGRESS, RESOLVED, CLOSED, all)
      - ?search=... (subject, user email)
    """
    serializer_class = AdminTicketSerializer
    permission_classes = [IsAdminRoleOrStaff]

    def get_queryset(self):
        qs = Ticket.objects.select_related('user').prefetch_related('replies__user').order_by('-updated_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param.upper())
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(subject__icontains=search) |
                Q(user__email__icontains=search) |
                Q(user__username__icontains=search)
            )
        return qs


class AdminTicketDetailView(generics.RetrieveAPIView):
    """GET /api/v1/admin-panel/tickets/{id}/"""
    serializer_class = AdminTicketSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = Ticket.objects.select_related('user').prefetch_related('replies__user').all()


class AdminTicketReplyView(APIView):
    """
    POST /api/v1/admin-panel/tickets/{id}/reply/
    Body:
      {
        "message": "Hello, your deposit has been verified!",
        "status": "IN_PROGRESS" | "RESOLVED" | "CLOSED" (optional)
      }
    """
    permission_classes = [IsAdminRoleOrStaff]

    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        message = request.data.get('message', '').strip()
        if not message:
            return Response({'message': 'Reply message cannot be blank.'}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            reply = TicketReply.objects.create(
                ticket=ticket,
                user=request.user,
                message=message,
            )

            new_status = request.data.get('status')
            if new_status and new_status.upper() in Ticket.Status.values:
                ticket.status = new_status.upper()
            elif ticket.status == Ticket.Status.OPEN:
                ticket.status = Ticket.Status.IN_PROGRESS
            ticket.save(update_fields=['status', 'updated_at'])

        return Response({
            'detail': 'Reply posted successfully.',
            'reply': AdminTicketReplySerializer(reply).data,
            'ticket_status': ticket.status,
        }, status=status.HTTP_201_CREATED)


class AdminTicketStatusView(APIView):
    """
    PATCH /api/v1/admin-panel/tickets/{id}/status/
    Body: { "status": "RESOLVED" }
    """
    permission_classes = [IsAdminRoleOrStaff]

    def patch(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        new_status = request.data.get('status', '').upper()
        if new_status not in Ticket.Status.values:
            return Response({'status': f"Invalid status. Must be one of {Ticket.Status.values}."}, status=status.HTTP_400_BAD_REQUEST)

        ticket.status = new_status
        ticket.save(update_fields=['status', 'updated_at'])
        return Response({'detail': f"Ticket status updated to {ticket.status}."})


class AdminPlatformSettingsListView(generics.ListAPIView):
    """GET /api/v1/admin-panel/settings/"""
    serializer_class = AdminPlatformSettingSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = PlatformSettings.objects.select_related('updated_by').all()


class AdminPlatformSettingUpdateView(APIView):
    """
    PATCH /api/v1/admin-panel/settings/{key}/
    Body: { "value": "150.00" }
    """
    permission_classes = [IsSuperAdminOnly]

    def patch(self, request, key):
        setting, _ = PlatformSettings.objects.get_or_create(key=key)
        new_value = request.data.get('value')
        if new_value is None:
            return Response({'value': 'Setting value is required.'}, status=status.HTTP_400_BAD_REQUEST)

        old_val = setting.value
        setting.value = str(new_value)
        setting.updated_by = request.user
        setting.save(update_fields=['value', 'updated_by', 'updated_at'])

        # Recalculate user active levels if unlock thresholds are changed
        if key.startswith('LEVEL') and key.endswith('UNLOCK_DIRECTS'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for user in User.objects.all():
                update_user_active_level(user)

        return Response({
            'detail': f"Setting '{key}' updated from '{old_val}' to '{setting.value}'.",
            'setting': AdminPlatformSettingSerializer(setting).data,
        })


class AdminPlanListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/admin-panel/plans/
    POST /api/v1/admin-panel/plans/
    """
    serializer_class = AdminPlanSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = Plan.objects.all().order_by('cost')


class AdminPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/admin-panel/plans/{id}/
    PATCH  /api/v1/admin-panel/plans/{id}/
    DELETE /api/v1/admin-panel/plans/{id}/
    """
    serializer_class = AdminPlanSerializer
    permission_classes = [IsAdminRoleOrStaff]
    queryset = Plan.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            name = instance.name
            instance.delete()
            return Response({'detail': f"Plan '{name}' deleted successfully."}, status=status.HTTP_200_OK)
        except models.ProtectedError:
            return Response(
                {'detail': f"Cannot delete plan '{instance.name}' because existing investments are linked to it. You can set it to INACTIVE instead."},
                status=status.HTTP_400_BAD_REQUEST
            )


class AdminTriggerROIEngineView(APIView):
    """
    POST /api/v1/admin-panel/actions/trigger-roi/
    Manually calculates and distributes weekly ROI to all ACTIVE investments.
    """
    permission_classes = [IsSuperAdminOnly]

    def post(self, request):
        active_investments = Investment.objects.filter(status=Investment.Status.ACTIVE).select_related('user', 'plan')
        total_investments_processed = 0
        total_roi_distributed = Decimal('0.00')

        with db_transaction.atomic():
            for inv in active_investments:
                roi_paid = distribute_roi_for_investment(inv)
                if roi_paid > Decimal('0.00'):
                    total_roi_distributed += roi_paid
                    total_investments_processed += 1

            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.ROI_DISTRIBUTED,
                ip_address=request.META.get('REMOTE_ADDR'),
                new_value={
                    'investments_processed': total_investments_processed,
                    'total_roi_distributed': str(total_roi_distributed),
                }
            )

        return Response({
            'detail': f"Weekly ROI distribution executed successfully.",
            'investments_processed': total_investments_processed,
            'total_roi_distributed': float(total_roi_distributed),
        })


class AdminCompanyFundsLedgerView(generics.ListAPIView):
    """
    GET /api/v1/admin-panel/funds/
    Returns paginated list of company wallet ledger transactions.
    Supports filtering by ?category=, ?transaction_type=, and ?search=
    """
    permission_classes = [IsAdminRoleOrStaff]
    serializer_class = AdminCompanyWalletTransactionSerializer

    def get_queryset(self):
        qs = CompanyWalletTransaction.objects.all().order_by('-created_at')

        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category.upper())

        txn_type = self.request.query_params.get('transaction_type')
        if txn_type and txn_type != 'all':
            qs = qs.filter(transaction_type=txn_type.upper())

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(reference_id__icontains=search) |
                Q(description__icontains=search) |
                Q(id__icontains=search)
            )

        return qs


class AdminCompanyFundsSummaryView(APIView):
    """
    GET /api/v1/admin-panel/funds/summary/
    Returns high-level KPI telemetry for the company funds treasury.
    """
    permission_classes = [IsAdminRoleOrStaff]

    def get(self, request):
        wallet = CompanyWallet.get_wallet()
        qs = CompanyWalletTransaction.objects.all()

        total_credits = qs.filter(
            transaction_type=CompanyWalletTransaction.TransactionType.CREDIT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_debits = qs.filter(
            transaction_type=CompanyWalletTransaction.TransactionType.DEBIT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_investment_remainders = qs.filter(
            category=CompanyWalletTransaction.Category.INVESTMENT_REMAINDER
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_withdrawal_fees = qs.filter(
            category=CompanyWalletTransaction.Category.WITHDRAWAL_FEE
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_adjustments = qs.filter(
            category=CompanyWalletTransaction.Category.ADJUSTMENT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        total_count = qs.count()

        return Response({
            'balance': float(wallet.balance),
            'total_credits': float(total_credits),
            'total_debits': float(total_debits),
            'total_investment_remainders': float(total_investment_remainders),
            'total_withdrawal_fees': float(total_withdrawal_fees),
            'total_adjustments': float(total_adjustments),
            'total_count': total_count,
            'updated_at': wallet.updated_at,
        })


class AdminCompanyFundsAdjustView(APIView):
    """
    POST /api/v1/admin-panel/funds/adjust/
    Allows admin to perform audited credit or debit adjustments to company funds.
    """
    permission_classes = [IsSuperAdminOnly]

    def post(self, request):
        serializer = AdminCompanyFundsAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']

        with db_transaction.atomic():
            wallet = CompanyWallet.get_wallet()
            balance_before = wallet.balance

            admin_info = f"{request.user.email} (Admin ID: #{str(request.user.id)[:8]})"
            if action == 'CREDIT':
                txn = credit_company_wallet(
                    amount=amount,
                    category=CompanyWalletTransaction.Category.ADJUSTMENT,
                    description=f"Admin Manual Credit by {admin_info}: {reason}",
                    reference_id=f"ADM-ADJ-{uuid.uuid4().hex[:8].upper()}",
                )
            else:
                if wallet.balance < amount:
                    return Response(
                        {'detail': f"Insufficient company funds: available ${wallet.balance}, requested debit ${amount}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                txn = debit_company_wallet(
                    amount=amount,
                    category=CompanyWalletTransaction.Category.ADJUSTMENT,
                    description=f"Admin Manual Debit by {admin_info}: {reason}",
                    reference_id=f"ADM-ADJ-{uuid.uuid4().hex[:8].upper()}",
                )

            # Audit Log
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.WALLET_ADJUSTED,
                ip_address=request.META.get('REMOTE_ADDR'),
                new_value={
                    'company_wallet': True,
                    'action': action,
                    'amount': str(amount),
                    'balance_before': str(balance_before),
                    'balance_after': str(txn.balance_after),
                    'reason': reason,
                    'transaction_id': str(txn.id),
                }
            )

        return Response({
            'detail': f"Company wallet {action.lower()} of ${amount} applied successfully.",
            'balance': float(txn.balance_after),
            'transaction': AdminCompanyWalletTransactionSerializer(txn).data,
        }, status=status.HTTP_200_OK)

