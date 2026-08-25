from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Subquery, OuterRef
from apps.investments.models import Investment
from apps.investments.services import _level_unlock_threshold
from .models import ReferralCommission
from .serializers import DirectMemberSerializer, ReferralCommissionSerializer

User = get_user_model()


class MyTeamView(generics.ListAPIView):
    """GET /api/v1/referrals/team/ — My direct downline members."""
    serializer_class = DirectMemberSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['email', 'username']
    ordering_fields = ['date_joined']
    ordering = ['-date_joined']

    def get_queryset(self):
        # 1. Total Refers
        refers_sq = User.objects.filter(parent=OuterRef('pk')).values('parent').annotate(total=Count('pk')).values('total')
        
        # 2. Investment Sum
        inv_sq = Investment.objects.filter(
            user=OuterRef('pk'),
            status__in=[Investment.Status.ACTIVE, Investment.Status.COMPLETED]
        ).values('user').annotate(total=Sum('amount')).values('total')
        
        # 3. Direct Income Sum
        dir_sq = ReferralCommission.objects.filter(
            from_user=OuterRef('pk'), 
            user=self.request.user, 
            commission_type=ReferralCommission.CommissionType.DIRECT,
            is_paid=True
        ).values('from_user').annotate(total=Sum('amount')).values('total')
        
        # 4. ROI Income Sum
        roi_sq = ReferralCommission.objects.filter(
            from_user=OuterRef('pk'), 
            user=self.request.user, 
            commission_type=ReferralCommission.CommissionType.ROI,
            is_paid=True
        ).values('from_user').annotate(total=Sum('amount')).values('total')

        return self.request.user.direct_children.annotate(
            total_refers=Subquery(refers_sq),
            investment_sum=Subquery(inv_sq),
            direct_income_sum=Subquery(dir_sq),
            roi_income_sum=Subquery(roi_sq)
        )


class MyCommissionsView(generics.ListAPIView):
    """GET /api/v1/referrals/commissions/ — My earned commissions."""
    serializer_class = ReferralCommissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['commission_type', 'is_paid', 'level']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']

    def get_queryset(self):
        return self.request.user.commissions.select_related('from_user').all()


class LevelStatsView(APIView):
    """GET /api/v1/referrals/levels/ — Aggregate stats for each of the 5 referral levels."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        stats = []
        
        for level in range(1, 6):
            # 1. Find descendants at exactly this depth
            if level == 1:
                descendants = User.objects.filter(parent=user)
            elif level == 2:
                descendants = User.objects.filter(parent__parent=user)
            elif level == 3:
                descendants = User.objects.filter(parent__parent__parent=user)
            elif level == 4:
                descendants = User.objects.filter(parent__parent__parent__parent=user)
            elif level == 5:
                descendants = User.objects.filter(parent__parent__parent__parent__parent=user)
            else:
                descendants = User.objects.none()

            total_refers = descendants.count()

            # 2. Sum of investments for these descendants
            investments = Investment.objects.filter(
                user__in=descendants,
                status__in=[Investment.Status.ACTIVE, Investment.Status.COMPLETED]
            )
            total_investment = investments.aggregate(total=Sum('amount'))['total'] or 0.0

            # 3. Direct and ROI income earned BY THE CURRENT USER from this specific level
            level_commissions = ReferralCommission.objects.filter(user=user, level=level, is_paid=True)
            
            direct_income = level_commissions.filter(
                commission_type=ReferralCommission.CommissionType.DIRECT
            ).aggregate(total=Sum('amount'))['total'] or 0.0
            
            roi_income = level_commissions.filter(
                commission_type=ReferralCommission.CommissionType.ROI
            ).aggregate(total=Sum('amount'))['total'] or 0.0

            stats.append({
                'level': level,
                'req': _level_unlock_threshold(level),
                'total_refers': total_refers,
                'total_investment': float(total_investment),
                'direct_income': float(direct_income),
                'roi_income': float(roi_income),
            })

        return Response(stats)
