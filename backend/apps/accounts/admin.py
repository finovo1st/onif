from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'full_name', 'role', 'bypass_plan_and_level_requirements', 'kyc_status', 'is_email_verified', 'active_level', 'created_at')
    list_filter = ('role', 'bypass_plan_and_level_requirements', 'kyc_status', 'is_email_verified', 'is_2fa_enabled', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'referral_code')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'referral_code', 'email_otp', 'email_otp_expiry')
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'username', 'phone_number', 'date_of_birth', 'country', 'profile_picture')}),
        (_('Role & KYC'), {'fields': ('role', 'bypass_plan_and_level_requirements', 'kyc_status', 'kyc_document_front', 'kyc_document_back', 'kyc_reviewed_at')}),
        (_('Security & Verification'), {'fields': ('is_email_verified', 'email_otp', 'email_otp_expiry', 'is_2fa_enabled', 'otp_secret')}),
        (_('Referral System'), {'fields': ('referral_code', 'parent', 'active_level', 'active_roi_level')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    
    actions = ['approve_kyc', 'reject_kyc']
    
    @admin.action(description='Approve KYC for selected users')
    def approve_kyc(self, request, queryset):
        queryset.update(kyc_status=User.KYCStatus.APPROVED)
        
    @admin.action(description='Reject KYC for selected users')
    def reject_kyc(self, request, queryset):
        queryset.update(kyc_status=User.KYCStatus.REJECTED)
