from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    LogoutView,
    VerifyEmailView,
    ResendOTPView,
    ChangeUnverifiedEmailView,
    ProfileView,
    KYCSubmitView,
    ChangePasswordView,
    ForgotPasswordView,
    ResetPasswordView,
)

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),

    # Email verification
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('change-email/', ChangeUnverifiedEmailView.as_view(), name='change_unverified_email'),

    # Profile & KYC
    path('profile/', ProfileView.as_view(), name='profile'),
    path('kyc/', KYCSubmitView.as_view(), name='kyc'),

    # Password management
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
]
