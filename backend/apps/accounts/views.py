from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    KYCSubmitSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    VerifyEmailSerializer,
    ResendOTPSerializer,
    ChangeUnverifiedEmailSerializer,
)
from .services import send_otp_email, verify_otp

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login endpoint — returns access + refresh JWT tokens."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """
    POST /api/v1/auth/register/
    Register a new user. Sends email verification OTP immediately after.
    """
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        # Send email verification OTP
        try:
            send_otp_email(user, subject='Verify your FINOVO account')
        except Exception:
            pass  # Do not block registration on email failure
        return user

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {'detail': 'Registration successful. Please check your email for the verification OTP.'},
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklist the refresh token, effectively logging the user out.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    """
    POST /api/v1/auth/verify-email/
    Verify email address using the OTP sent during registration.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if user.is_email_verified:
            return Response({'detail': 'Email is already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        if verify_otp(user, serializer.validated_data['otp']):
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])
            return Response({'detail': 'Email verified successfully.'})

        return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)


class ResendOTPView(APIView):
    """
    POST /api/v1/auth/resend-otp/
    Resend the email verification OTP.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(email=serializer.validated_data['email'])
        except User.DoesNotExist:
            # Return 200 to prevent email enumeration
            return Response({'detail': 'If the email exists, a new OTP has been sent.'})

        if user.is_email_verified:
            return Response({'detail': 'Email is already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            send_otp_email(user, subject='Your FINOVO verification code')
        except Exception:
            return Response({'detail': 'Failed to send OTP. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'detail': 'OTP sent successfully. Please check your email.'})


class ChangeUnverifiedEmailView(APIView):
    """
    POST /api/v1/auth/change-email/
    Update email address on an unverified account and dispatch a new OTP.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response(
                {'detail': 'Email is already verified and cannot be changed here.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ChangeUnverifiedEmailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        new_email = serializer.validated_data['new_email']
        user.email = new_email
        user.save(update_fields=['email'])

        try:
            send_otp_email(user, subject='Verify your new FINOVO account email')
        except Exception:
            return Response(
                {'detail': 'Email updated, but failed to send OTP. Please click Resend Code.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'detail': 'Email updated successfully. A new verification OTP has been sent.',
            'email': new_email
        })


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/v1/auth/profile/   — view profile
    PATCH /api/v1/auth/profile/  — update profile fields
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class KYCSubmitView(APIView):
    """
    GET  /api/v1/auth/kyc/ — get current user's KYC verification status
    POST /api/v1/auth/kyc/ — submit identity documents for verification
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        if user.kyc_status == User.KYCStatus.APPROVED:
            return Response(
                {'detail': 'Your KYC is already approved and verified.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = KYCSubmitSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        profile_data = UserProfileSerializer(user, context={'request': request}).data
        return Response({
            'detail': 'KYC documents submitted successfully. Our compliance team will review your submission.',
            'profile': profile_data,
        })



class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/
    Change password using current password for verification.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully. Please log in again.'})


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    Send password-reset OTP to the given email address or username.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['email']
        try:
            if '@' in identifier:
                user = User.objects.get(email__iexact=identifier)
            else:
                user = User.objects.get(username__iexact=identifier)
            send_otp_email(user, subject='FINOVO Password Reset Code')
        except User.DoesNotExist:
            pass  # Silent — prevent email enumeration

        return Response({'detail': 'If this email or username is registered, a reset OTP has been sent.'})


class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/
    Reset password using email/username + OTP.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['email']
        try:
            if '@' in identifier:
                user = User.objects.get(email__iexact=identifier)
            else:
                user = User.objects.get(username__iexact=identifier)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid email/username or OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        if not verify_otp(user, serializer.validated_data['otp']):
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successfully. You can now log in.'})
