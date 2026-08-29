import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

export default function AuthScreen() {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'verify-otp' | 'forgot' | 'reset'
  const {
    login,
    register,
    verifyEmail,
    resendOTP,
    forgotPassword,
    resendForgotOTP,
    resetPassword,
    enableDemoMode,
    loading,
  } = useContext(AuthContext);

  // Form State
  const [email, setEmail] = useState('l1_alice@finovo.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Register Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password2, setPassword2] = useState('');
  const [refCode, setRefCode] = useState('');

  // OTP Verification Fields
  const [otpCode, setOtpCode] = useState('');
  const [otpEmailDisplay, setOtpEmailDisplay] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Forgot / Reset Password Fields
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [resetCountdown, setResetCountdown] = useState(0);

  // Countdown timer effect
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => {
    let timer;
    if (resetCountdown > 0) {
      timer = setTimeout(() => setResetCountdown(resetCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resetCountdown]);

  const onLoginSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter your email or username and password.');
      return;
    }
    try {
      await login(email, password);
    } catch (err) {
      Alert.alert(
        'Sign In Failed',
        err.message || 'Unable to sign in. Please verify your credentials.',
        [
          { text: 'Try Again' },
          { text: 'Use Demo Mode', onPress: () => enableDemoMode(email) },
        ]
      );
    }
  };

  const onRegisterSubmit = async () => {
    if (!email || !password || !username) {
      Alert.alert('Validation Error', 'Please fill in all required registration fields.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Password Error', 'Passwords do not match.');
      return;
    }
    try {
      await register({
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        password,
        password2,
        referral_code: refCode,
      });
      setOtpEmailDisplay(email);
      setOtpCode('');
      setOtpCountdown(60);
      setAuthMode('verify-otp');
    } catch (err) {
      Alert.alert('Registration Error', err.message);
    }
  };

  const onVerifyOTPSubmit = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Validation Error', 'Please enter the complete 6-digit verification code.');
      return;
    }
    try {
      await verifyEmail(otpCode);
      Alert.alert('Email Verified', 'Your account has been verified! Welcome to FINOVO.');
    } catch (err) {
      Alert.alert('Verification Error', err.message || 'Invalid or expired OTP code.');
    }
  };

  const onResendOTPClick = async () => {
    if (otpCountdown > 0) return;
    try {
      await resendOTP(otpEmailDisplay || email);
      setOtpCountdown(60);
      Alert.alert('Code Sent', 'A fresh 6-digit verification code has been dispatched to your email.');
    } catch (err) {
      Alert.alert('Resend Error', err.message);
    }
  };

  const onForgotSubmit = async () => {
    if (!resetIdentifier) {
      Alert.alert('Validation Error', 'Please enter your registered email address or username.');
      return;
    }
    try {
      await forgotPassword(resetIdentifier);
      setResetCountdown(60);
      Alert.alert('Reset Code Sent', `If the account exists, a 6-digit reset code has been sent.`);
      setAuthMode('reset');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const onResendForgotOTPClick = async () => {
    if (resetCountdown > 0) return;
    try {
      await resendForgotOTP(resetIdentifier);
      setResetCountdown(60);
      Alert.alert('Code Sent', 'A new password reset code has been dispatched.');
    } catch (err) {
      Alert.alert('Resend Error', err.message);
    }
  };

  const onResetSubmit = async () => {
    if (!resetOtp || !newPassword || !newPassword2) {
      Alert.alert('Validation Error', 'Please enter the OTP code and your new password.');
      return;
    }
    if (newPassword !== newPassword2) {
      Alert.alert('Password Error', 'New passwords do not match.');
      return;
    }
    try {
      await resetPassword(resetIdentifier, resetOtp, newPassword);
      Alert.alert('Success', 'Password reset successfully. You can now sign in with your new password.');
      setAuthMode('login');
    } catch (err) {
      Alert.alert('Reset Error', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Brand Header */}
      <View style={styles.headerBox}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>F</Text>
        </View>
        <Text style={styles.brandTitle}>FINOVO</Text>
        <Text style={styles.brandSubtitle}>Institutional Crypto Investment &amp; Referral Portal</Text>

        <View style={styles.trustRow}>
          <Text style={styles.trustItem}>✓ Segregated Custody</Text>
          <Text style={styles.trustItem}>✓ 300% Return Cap</Text>
          <Text style={styles.trustItem}>✓ Fast USDT Settlements</Text>
        </View>
      </View>

      {/* Main Glassmorphic Auth Card */}
      <View style={styles.card}>
        {/* Tab Navigation for Login / Register */}
        {(authMode === 'login' || authMode === 'register') && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, authMode === 'login' && styles.tabActive]}
              onPress={() => setAuthMode('login')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, authMode === 'register' && styles.tabActive]}
              onPress={() => setAuthMode('register')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. LOGIN FORM */}
        {authMode === 'login' && (
          <View>
            <Text style={styles.label}>Email or Username</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com or username"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.togglePwBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.togglePwText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowBetween}>
              <TouchableOpacity
                onPress={() => {
                  setResetIdentifier(email);
                  setAuthMode('forgot');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={onLoginSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Sign In to Member Portal →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => enableDemoMode('l1_alice@finovo.com', true)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSecondaryText}>⚡ Explore Full Demo Mode (Investor &amp; Admin)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, alignItems: 'center' }}
              onPress={() => setAuthMode('register')}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                New to Finovo? <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. REGISTER FORM */}
        {authMode === 'register' && (
          <View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Alice"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="alicesmith"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="user@example.com"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showRegPassword}
              />
              <TouchableOpacity
                style={styles.togglePwBtn}
                onPress={() => setShowRegPassword(!showRegPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.togglePwText}>{showRegPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={password2}
              onChangeText={setPassword2}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textDim}
              secureTextEntry={!showRegPassword}
            />

            <Text style={styles.label}>Sponsor / Referral Code (Optional)</Text>
            <TextInput
              style={styles.input}
              value={refCode}
              onChangeText={setRefCode}
              placeholder="e.g. SPONSOR123"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={onRegisterSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Create Free Account →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 14, alignItems: 'center' }}
              onPress={() => setAuthMode('login')}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Already have an account? <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. OTP VERIFICATION FORM (Post Registration) */}
        {authMode === 'verify-otp' && (
          <View style={{ alignItems: 'center' }}>
            <View style={styles.otpIconCircle}>
              <Feather name="mail" size={26} color={colors.goldSoft} />
            </View>
            <Text style={styles.formTitle}>Verify Your Email Address</Text>
            <Text style={[styles.formDesc, { textAlign: 'center' }]}>
              We've dispatched a 6-digit confirmation code to{'\n'}
              <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>{otpEmailDisplay}</Text>
            </Text>

            <View style={{ width: '100%', marginTop: 8 }}>
              <Text style={styles.label}>6-Digit Verification Code</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: '800',
                    letterSpacing: 8,
                    color: colors.goldSoft,
                  },
                ]}
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="123456"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { width: '100%', marginTop: 16 }]}
              onPress={onVerifyOTPSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Verify Email &amp; Activate Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpResendRow}>
              {otpCountdown > 0 ? (
                <Text style={styles.countdownText}>Resend code in {otpCountdown}s</Text>
              ) : (
                <TouchableOpacity onPress={onResendOTPClick} activeOpacity={0.7}>
                  <Text style={styles.resendBtnText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={{ marginTop: 18 }}
              onPress={() => setAuthMode('register')}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                ← <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Back to registration</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. FORGOT PASSWORD FORM */}
        {authMode === 'forgot' && (
          <View>
            <Text style={styles.formTitle}>Reset Your Password</Text>
            <Text style={styles.formDesc}>
              Enter your registered email address or username and we will dispatch a 6-digit verification code.
            </Text>

            <Text style={styles.label}>Email Address or Username</Text>
            <TextInput
              style={styles.input}
              value={resetIdentifier}
              onChangeText={setResetIdentifier}
              placeholder="you@example.com or username"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={onForgotSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Send Reset Code →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, alignItems: 'center' }}
              onPress={() => setAuthMode('login')}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Remember your password? <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. RESET PASSWORD FORM */}
        {authMode === 'reset' && (
          <View>
            <Text style={styles.formTitle}>Enter Verification Code</Text>
            <Text style={styles.formDesc}>
              Enter the 6-digit OTP code dispatched to <Text style={{ color: colors.goldSoft }}>{resetIdentifier}</Text> and choose your new password.
            </Text>

            <Text style={styles.label}>6-Digit OTP Code</Text>
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '800',
                  letterSpacing: 6,
                  color: colors.goldSoft,
                },
              ]}
              value={resetOtp}
              onChangeText={setResetOtp}
              placeholder="123456"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showResetPassword}
              />
              <TouchableOpacity
                style={styles.togglePwBtn}
                onPress={() => setShowResetPassword(!showResetPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.togglePwText}>{showResetPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword2}
              onChangeText={setNewPassword2}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textDim}
              secureTextEntry={!showResetPassword}
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={onResetSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Update &amp; Save Password</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpResendRow}>
              {resetCountdown > 0 ? (
                <Text style={styles.countdownText}>Resend code in {resetCountdown}s</Text>
              ) : (
                <TouchableOpacity onPress={onResendForgotOTPClick} activeOpacity={0.7}>
                  <Text style={styles.resendBtnText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 12 }}>
              <TouchableOpacity onPress={() => setAuthMode('forgot')}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>← Change email</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textDim }}>|</Text>
              <TouchableOpacity onPress={() => setAuthMode('login')}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 13 }}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 36,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  trustItem: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgCardBorder,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.gold,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 6,
  },
  formDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  otpIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 5,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.textMain,
    fontSize: 14,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  togglePwBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  togglePwText: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  forgotLink: {
    fontSize: 12,
    color: colors.goldSoft,
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#030507',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.goldSoft,
  },
  otpResendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  countdownText: {
    fontSize: 12,
    color: colors.textDim,
  },
  resendBtnText: {
    fontSize: 12,
    color: colors.goldSoft,
    fontWeight: '700',
  },
});

