from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class AuthTests(APITestCase):
    """Tests for all Phase 3 authentication endpoints."""

    def setUp(self):
        self.register_url = reverse('accounts:register')
        self.login_url = reverse('accounts:login')
        self.logout_url = reverse('accounts:logout')
        self.profile_url = reverse('accounts:profile')
        self.verify_email_url = reverse('accounts:verify_email')
        self.resend_otp_url = reverse('accounts:resend_otp')
        self.change_password_url = reverse('accounts:change_password')
        self.forgot_password_url = reverse('accounts:forgot_password')
        self.reset_password_url = reverse('accounts:reset_password')
        self.change_email_url = reverse('accounts:change_unverified_email')

        self.user_data = {
            'email': 'test@finovo.com',
            'username': 'testuser',
            'first_name': 'John',
            'last_name': 'Doe',
            'password': 'SecurePass123!',
            'password2': 'SecurePass123!',
        }

    def _create_verified_user(self, email='verified@finovo.com', username='verified'):
        """Helper: create a verified active user."""
        user = User.objects.create_user(
            email=email, username=username, password='SecurePass123!'
        )
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])
        return user

    def _auth_header(self, user):
        """Helper: return Authorization header for a user."""
        refresh = RefreshToken.for_user(user)
        return {'HTTP_AUTHORIZATION': f'Bearer {str(refresh.access_token)}'}

    # ── Registration ─────────────────────────────────────────────────────────

    def test_register_success(self):
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='test@finovo.com').exists())

    def test_register_password_mismatch(self):
        data = {**self.user_data, 'password2': 'WrongPass123!'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):
        self.client.post(self.register_url, self.user_data)
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_with_referral_code(self):
        sponsor = self._create_verified_user('sponsor@finovo.com', 'sponsor')
        data = {**self.user_data, 'referral_code': sponsor.referral_code}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_user = User.objects.get(email='test@finovo.com')
        self.assertEqual(new_user.parent, sponsor)

    def test_register_with_invalid_referral_code(self):
        data = {**self.user_data, 'referral_code': 'INVALID00'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Login ─────────────────────────────────────────────────────────────────

    def test_login_success(self):
        self._create_verified_user()
        response = self.client.post(self.login_url, {
            'email': 'verified@finovo.com',
            'password': 'SecurePass123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertTrue(response.data.get('is_email_verified'))

    def test_login_unverified_user_returns_flag(self):
        User.objects.create_user(email='unverified@finovo.com', username='unverified', password='SecurePass123!')
        response = self.client.post(self.login_url, {
            'email': 'unverified@finovo.com',
            'password': 'SecurePass123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data.get('is_email_verified'))

    def test_login_wrong_password(self):
        self._create_verified_user()
        response = self.client.post(self.login_url, {
            'email': 'verified@finovo.com',
            'password': 'WrongPassword!'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Logout ────────────────────────────────────────────────────────────────

    def test_logout_success(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.logout_url, {'refresh': str(refresh)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_missing_refresh_token(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.logout_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Email Verification ────────────────────────────────────────────────────

    def test_verify_email_success(self):
        user = User.objects.create_user(email='new@finovo.com', username='newuser', password='Pass123!')
        user.email_otp = '123456'
        user.email_otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save(update_fields=['email_otp', 'email_otp_expiry'])

        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.verify_email_url, {'otp': '123456'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_verify_email_wrong_otp(self):
        user = User.objects.create_user(email='new2@finovo.com', username='newuser2', password='Pass123!')
        user.email_otp = '123456'
        user.email_otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save(update_fields=['email_otp', 'email_otp_expiry'])

        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.verify_email_url, {'otp': '999999'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_expired_otp(self):
        user = User.objects.create_user(email='new3@finovo.com', username='newuser3', password='Pass123!')
        user.email_otp = '123456'
        user.email_otp_expiry = timezone.now() - timedelta(minutes=1)  # expired
        user.save(update_fields=['email_otp', 'email_otp_expiry'])

        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.verify_email_url, {'otp': '123456'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Change Unverified Email ───────────────────────────────────────────────

    def test_change_unverified_email_success(self):
        user = User.objects.create_user(email='wrong@finovo.com', username='wronguser', password='Pass123!')
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = self.client.post(self.change_email_url, {'new_email': 'corrected@finovo.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'corrected@finovo.com')

        user.refresh_from_db()
        self.assertEqual(user.email, 'corrected@finovo.com')
        self.assertIsNotNone(user.email_otp)

    def test_change_unverified_email_duplicate(self):
        self._create_verified_user('existing@finovo.com', 'existinguser')
        user = User.objects.create_user(email='wrong2@finovo.com', username='wronguser2', password='Pass123!')
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = self.client.post(self.change_email_url, {'new_email': 'existing@finovo.com'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_unverified_email_already_verified(self):
        user = self._create_verified_user('already_verified@finovo.com', 'verifieduser2')
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = self.client.post(self.change_email_url, {'new_email': 'new_attempt@finovo.com'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Profile ───────────────────────────────────────────────────────────────

    def test_get_profile(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], user.email)

    def test_update_profile(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.patch(self.profile_url, {
            'first_name': 'Jane',
            'country': 'India',
            'current_password': 'SecurePass123!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'Jane')

    def test_update_profile_missing_password(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.patch(self.profile_url, {'first_name': 'Jane', 'country': 'India'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)

    def test_update_profile_wrong_password(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.patch(self.profile_url, {
            'first_name': 'Jane',
            'country': 'India',
            'current_password': 'IncorrectPassword!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)

    def test_profile_unauthenticated(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Change Password ───────────────────────────────────────────────────────

    def test_change_password_success(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.change_password_url, {
            'old_password': 'SecurePass123!',
            'new_password': 'NewSecurePass456!',
            'new_password2': 'NewSecurePass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_change_password_wrong_old(self):
        user = self._create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        response = self.client.post(self.change_password_url, {
            'old_password': 'WrongOldPass!',
            'new_password': 'NewSecurePass456!',
            'new_password2': 'NewSecurePass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Forgot / Reset Password ───────────────────────────────────────────────

    def test_forgot_password_always_200(self):
        """Endpoint returns 200 even for unregistered emails (prevent enumeration)."""
        response = self.client.post(self.forgot_password_url, {'email': 'notexist@finovo.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reset_password_success(self):
        user = self._create_verified_user()
        user.email_otp = '654321'
        user.email_otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save(update_fields=['email_otp', 'email_otp_expiry'])

        response = self.client.post(self.reset_password_url, {
            'email': user.email,
            'otp': '654321',
            'new_password': 'BrandNewPass789!',
            'new_password2': 'BrandNewPass789!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password('BrandNewPass789!'))

    def test_reset_password_wrong_otp(self):
        user = self._create_verified_user()
        user.email_otp = '654321'
        user.email_otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save(update_fields=['email_otp', 'email_otp_expiry'])

        response = self.client.post(self.reset_password_url, {
            'email': user.email,
            'otp': '000000',
            'new_password': 'BrandNewPass789!',
            'new_password2': 'BrandNewPass789!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
