from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User as UserModel
from .services import verify_otp

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT token serializer with extra user claims."""

    def validate(self, attrs):
        login_id = attrs.get(self.username_field)
        if login_id and '@' not in login_id:
            user = User.objects.filter(username__iexact=login_id).first()
            if user:
                attrs[self.username_field] = user.email
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['is_email_verified'] = user.is_email_verified
        return token


class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer."""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True, label='Confirm Password')
    referral_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password2', 'referral_code']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        referral_code = validated_data.pop('referral_code', None)
        validated_data.pop('password2')
        password = validated_data.pop('password')

        user = User(**validated_data)

        # Link parent via referral code
        if referral_code:
            try:
                parent = User.objects.get(referral_code=referral_code)
                user.parent = parent
            except User.DoesNotExist:
                raise serializers.ValidationError({'referral_code': 'Invalid referral code.'})

        user.set_password(password)
        user.save()

        # Create wallet immediately
        from apps.wallet.models import Wallet
        Wallet.objects.get_or_create(user=user)

        # Update 5-level ancestors team_total_members
        if user.parent:
            from django.db.models import F
            current_parent = user.parent
            ancestor_ids = []
            for _ in range(5):
                if current_parent:
                    ancestor_ids.append(current_parent.id)
                    current_parent = current_parent.parent
                else:
                    break
            
            if ancestor_ids:
                # Ensure all ancestors have wallets before updating
                for aid in ancestor_ids:
                    Wallet.objects.get_or_create(user_id=aid)
                
                Wallet.objects.filter(user_id__in=ancestor_ids).update(
                    team_total_members=F('team_total_members') + 1
                )

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Read/write user profile details."""

    full_name = serializers.SerializerMethodField(read_only=True)
    parent_email = serializers.SerializerMethodField(read_only=True)
    kyc_document_front_url = serializers.SerializerMethodField(read_only=True)
    kyc_document_back_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name',
            'phone_number', 'date_of_birth', 'country', 'profile_picture',
            'role', 'is_staff', 'is_superuser', 'kyc_status', 'kyc_document_type',
            'kyc_document_number', 'kyc_document_front_url', 'kyc_document_back_url', 'kyc_submitted_at',
            'kyc_reviewed_at', 'kyc_rejection_reason',
            'is_email_verified', 'is_2fa_enabled',
            'referral_code', 'parent_email', 'active_level', 'active_direct_level', 'active_roi_level',
            'date_joined', 'created_at',
        ]
        read_only_fields = [
            'id', 'email', 'role', 'is_staff', 'is_superuser', 'kyc_status',
            'kyc_document_type', 'kyc_document_number', 'kyc_document_front_url', 'kyc_document_back_url',
            'kyc_submitted_at', 'kyc_reviewed_at', 'kyc_rejection_reason',
            'is_email_verified', 'referral_code', 'active_level', 'active_direct_level', 'active_roi_level',
            'date_joined', 'created_at', 'parent_email',
        ]

    def get_full_name(self, obj) -> str:
        return obj.full_name

    def get_parent_email(self, obj) -> str | None:
        return obj.parent.email if obj.parent else None

    def get_kyc_document_front_url(self, obj) -> str | None:
        if obj.kyc_document_front:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.kyc_document_front.url)
            return obj.kyc_document_front.url
        return None

    def get_kyc_document_back_url(self, obj) -> str | None:
        if obj.kyc_document_back:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.kyc_document_back.url)
            return obj.kyc_document_back.url
        return None


class KYCSubmitSerializer(serializers.ModelSerializer):
    """Submit document and details for KYC identity verification."""
    kyc_document_front = serializers.FileField(required=True)
    kyc_document_back = serializers.FileField(required=True)
    kyc_document_type = serializers.CharField(required=True)
    kyc_document_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'kyc_document_type', 'kyc_document_number', 'kyc_document_front', 'kyc_document_back',
            'country', 'first_name', 'last_name', 'date_of_birth',
        ]

    def update(self, instance, validated_data):
        instance.kyc_document_type = validated_data.get('kyc_document_type', instance.kyc_document_type)
        instance.kyc_document_number = validated_data.get('kyc_document_number', instance.kyc_document_number)
        instance.kyc_document_front = validated_data.get('kyc_document_front', instance.kyc_document_front)
        instance.kyc_document_back = validated_data.get('kyc_document_back', instance.kyc_document_back)
        if 'country' in validated_data:
            instance.country = validated_data['country']
        if 'first_name' in validated_data:
            instance.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            instance.last_name = validated_data['last_name']
        if 'date_of_birth' in validated_data:
            instance.date_of_birth = validated_data['date_of_birth']
        instance.kyc_status = User.KYCStatus.PENDING
        instance.kyc_submitted_at = timezone.now()
        instance.kyc_rejection_reason = None
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Change password (requires old password)."""

    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True, label='Confirm New Password')

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password': "Passwords do not match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    """Send OTP to email for password reset."""

    email = serializers.CharField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    """Reset password using OTP."""

    email = serializers.CharField(required=True)
    otp = serializers.CharField(required=True, max_length=6)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, label='Confirm New Password')

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password': "Passwords do not match."})
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    """Verify email address using OTP."""

    otp = serializers.CharField(required=True, max_length=6)


class ResendOTPSerializer(serializers.Serializer):
    """Request a new OTP for email verification."""

    email = serializers.EmailField(required=True)
