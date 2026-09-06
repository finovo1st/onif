from django.urls import path
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, Q

from apps.wallet.models import Wallet
from apps.investments.models import Investment
from apps.referrals.models import ReferralCommission
from apps.core.models import PlatformSettings


class AppVersionView(APIView):
    """
    GET /api/v1/dashboard/app-version/
    Public endpoint returning latest version, minimum required version,
    download URL, force update flag, and release notes for client apps.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        latest_version = PlatformSettings.get('APP_LATEST_VERSION', '1.0.0')
        min_version = PlatformSettings.get('APP_MIN_REQUIRED_VERSION', '1.0.0')
        download_url = PlatformSettings.get('APP_DOWNLOAD_URL', 'https://finovo1.com')
        release_notes = PlatformSettings.get('APP_RELEASE_NOTES', 'Regular stability enhancements and performance optimizations.')
        force_update = PlatformSettings.get('APP_FORCE_UPDATE', 'false').lower() == 'true'

        return Response({
            'latest_version': latest_version,
            'min_version': min_version,
            'download_url': download_url,
            'release_notes': release_notes,
            'force_update': force_update,
        })


class DepositWalletsView(APIView):
    """
    GET /api/v1/dashboard/deposit-wallets/
    Returns platform company deposit wallet addresses for crypto networks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'BEP20': PlatformSettings.get('COMPANY_WALLET_BEP20', '0x71C8bf7B67295F2797e883FffFa7617bFF524b08'),
            'TRC20': PlatformSettings.get('COMPANY_WALLET_TRC20', 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9'),
            'BEP20_QR': PlatformSettings.get('COMPANY_WALLET_BEP20_QR', ''),
            'TRC20_QR': PlatformSettings.get('COMPANY_WALLET_TRC20_QR', ''),
        })


class DashboardView(APIView):
    """
    GET /api/v1/dashboard/
    Returns a consolidated summary of the user's platform activity.
    Mirrors all fields from the SRS User Dashboard spec.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Wallet
        try:
            wallet = user.wallet
        except Wallet.DoesNotExist:
            wallet = None

        # Investments
        investments = user.investments.all()
        total_invested = sum(i.amount for i in investments.filter(status__in=[
            Investment.Status.ACTIVE, Investment.Status.COMPLETED
        ]))
        active_investments = investments.filter(status=Investment.Status.ACTIVE).count()

        # Total profit = sum of total_credited - amount (for all completed/active)
        total_profit = sum(
            max(i.total_credited - i.amount, 0)
            for i in investments.filter(status__in=[
                Investment.Status.ACTIVE, Investment.Status.COMPLETED
            ])
        )

        # Commissions
        direct_income = sum(
            c.amount for c in user.commissions.filter(
                commission_type=ReferralCommission.CommissionType.DIRECT, is_paid=True
            )
        )
        roi_income = sum(
            c.amount for c in user.commissions.filter(
                commission_type=ReferralCommission.CommissionType.ROI, is_paid=True
            )
        )

        # Team
        total_team = user.direct_children.count()
        direct_team = user.direct_referrals.count() if hasattr(user, 'direct_referrals') else total_team

        # Build response
        return Response({
            # Identity
            'user_id': str(user.id),
            'parent_id': str(user.parent_id) if user.parent_id else None,
            'referral_code': user.referral_code,
            'referral_link': f"{request.scheme}://{request.get_host()}/app.html#register?ref={user.referral_code}",

            # Wallet
            'wallet_balance': float(wallet.balance) if wallet else 0.0,
            'total_deposited': float(wallet.total_deposited) if wallet else 0.0,
            'total_withdrawn': float(wallet.total_withdrawn) if wallet else 0.0,

            # Investments
            'total_invested': float(total_invested),
            'active_investments': active_investments,
            'total_profit': float(total_profit),

            # Income
            'direct_income': float(direct_income),
            'roi_income': float(roi_income),
            'total_roi_earned': float(wallet.total_roi_earned) if wallet else 0.0,
            'total_direct_income': float(wallet.total_direct_income) if wallet else 0.0,
            'total_referral_income': float(wallet.total_referral_income) if wallet else 0.0,

            # Team & Level
            'total_team': total_team,
            'direct_team': direct_team,
            'active_level': user.active_level,
            'active_direct_level': user.active_level,
            'active_roi_level': getattr(user, 'active_roi_level', user.active_level),
            'is_commission_bypassed': getattr(user, 'is_commission_bypassed', False),
            'bypass_plan_and_level_requirements': getattr(user, 'bypass_plan_and_level_requirements', False),

            # Company Deposit Wallets
            'deposit_wallets': {
                'BEP20': PlatformSettings.get('COMPANY_WALLET_BEP20', '0x71C8bf7B67295F2797e883FffFa7617bFF524b08'),
                'TRC20': PlatformSettings.get('COMPANY_WALLET_TRC20', 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9'),
                'BEP20_QR': PlatformSettings.get('COMPANY_WALLET_BEP20_QR', ''),
                'TRC20_QR': PlatformSettings.get('COMPANY_WALLET_TRC20_QR', ''),
            },
            'settings': {
                'PROFIT_WITHDRAWAL_FEE': float(PlatformSettings.get('PROFIT_WITHDRAWAL_FEE', '1.00')),
                'MIN_PROFIT_WITHDRAWAL': float(PlatformSettings.get('MIN_PROFIT_WITHDRAWAL', '10.00')),
            },
        })
