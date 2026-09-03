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
  Image,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

export default function AuthScreen({ initialMode, initialRefCode }) {
  const [authMode, setAuthMode] = useState(initialMode || 'login'); // 'login' | 'register' | 'verify-otp' | 'forgot' | 'reset'
  const {
    login,
    register,
    verifyEmail,
    resendOTP,
    forgotPassword,
    resendForgotOTP,
    resetPassword,
    loading,
  } = useContext(AuthContext);

  useEffect(() => {
    if (initialMode) setAuthMode(initialMode);
    if (initialRefCode) setRefCode(initialRefCode);
  }, [initialMode, initialRefCode]);

  // Form State - Clean Live Empty Defaults
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Register Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password2, setPassword2] = useState('');
  const [refCode, setRefCode] = useState(initialRefCode || '');
  const [agreedToTnc, setAgreedToTnc] = useState(false);
  const [tncModalVisible, setTncModalVisible] = useState(false);

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
        err.message || 'Unable to sign in. Please verify your credentials.'
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
    if (!agreedToTnc) {
      Alert.alert(
        'Terms & Conditions Required',
        'Please review and agree to the Terms & Conditions and risk disclosure before creating an account.'
      );
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
        <Image
          source={require('../assets/logo.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
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
                  placeholder="First name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
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
              placeholder="Enter sponsor code if any"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />

            {/* Terms & Conditions Checkbox */}
            <View style={styles.tncRow}>
              <TouchableOpacity
                style={[styles.checkboxBox, agreedToTnc && styles.checkboxBoxChecked]}
                onPress={() => setAgreedToTnc(!agreedToTnc)}
                activeOpacity={0.7}
              >
                {agreedToTnc && <Feather name="check" size={13} color="#030507" />}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.tncText}>
                  I confirm that I am 18+ and have read, understood, and agree to the{' '}
                  <Text
                    style={styles.tncLink}
                    onPress={() => setTncModalVisible(true)}
                  >
                    Terms & Conditions
                  </Text>{' '}
                  and investment risk disclosure.
                </Text>
              </View>
            </View>

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
                <Text style={styles.btnPrimaryText}>Verify Email & Activate Account</Text>
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
                <Text style={styles.btnPrimaryText}>Update & Save Password</Text>
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

      {/* TERMS & CONDITIONS MODAL */}
      <Modal
        visible={tncModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTncModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="file-text" size={18} color={colors.goldSoft} />
                <Text style={styles.modalTitle}>Terms & Conditions</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTncModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Terms Content */}
            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.tncSectionNum}>1. Introduction</Text>
              <Text style={styles.tncBodyText}>
                These Terms & Conditions (“Terms”) govern your access to and use of the FINOVO website, application, dashboard, trading-related services, and associated features (“Platform”). By registering for or using FINOVO, you confirm that you have read, understood, and agreed to these Terms.
              </Text>

              <Text style={styles.tncSectionNum}>2. Systematic Model</Text>
              <Text style={styles.tncBodyText}>
                Finovo is an AI based automatic systematic generation plan based company.
              </Text>

              <Text style={styles.tncSectionNum}>3. Global Market Investments</Text>
              <Text style={styles.tncBodyText}>
                Finovo invests in global markets and tokens.
              </Text>

              <Text style={styles.tncSectionNum}>4. Regulatory Compliance</Text>
              <Text style={styles.tncBodyText}>
                Users must satisfy all applicable legal and regulatory requirements in UAE.
              </Text>

              <Text style={styles.tncSectionNum}>5. Compliance & Sanctions Access</Text>
              <Text style={styles.tncBodyText}>
                FINOVO may restrict or refuse access where providing the service would violate applicable laws, regulations, sanctions, or internal compliance requirements.
              </Text>

              <Text style={styles.tncSectionNum}>6. User Accounts & Confidentiality</Text>
              <Text style={styles.tncBodyText}>
                Users are responsible for providing accurate, complete, and up-to-date information during registration and KYC verification. Each user must maintain the confidentiality of their login credentials and is responsible for activity conducted through their account. FINOVO may suspend, restrict, or terminate an account where there is suspected fraud, misuse, false information, security concerns, or violation of these Terms.
              </Text>

              <Text style={styles.tncSectionNum}>7. KYC & Compliance</Text>
              <Text style={styles.tncBodyText}>
                FINOVO may require identity verification and supporting documents before allowing deposits, withdrawals, or other services. Additional verification may be requested at any time where required for compliance, security, or fraud prevention.
              </Text>

              <Text style={styles.tncSectionNum}>8. Deposits</Text>
              <Text style={styles.tncBodyText}>
                Deposits must be made only through payment methods and wallet addresses officially displayed by FINOVO. Users are responsible for verifying transaction details before confirming a deposit. FINOVO is not responsible for losses caused by sending funds to an incorrect or unofficial address.
              </Text>

              <Text style={styles.tncSectionNum}>9. Withdrawals</Text>
              <Text style={styles.tncBodyText}>
                Withdrawal requests are subject to account verification, compliance checks, available balance, applicable fees, and the terms of the selected service. FINOVO may temporarily delay a withdrawal where additional verification or security review is required. Minimum withdrawal amounts and transaction charges, if applicable, will be displayed on the Platform and may be updated from time to time.
              </Text>

              <Text style={styles.tncSectionNum}>10. Investment Performance & Risk Disclosure</Text>
              <Text style={styles.tncBodyText}>
                Where the Platform displays investment performance or profit distributions, such figures are subject to actual market conditions and the applicable FINOVO program terms. No statement on the Platform should be interpreted as a promise of fixed, guaranteed, or risk-free returns.
              </Text>

              <Text style={styles.tncSectionNum}>11. Fees</Text>
              <Text style={styles.tncBodyText}>
                Applicable management fees, transaction charges, withdrawal fees, network fees, or other service charges will be disclosed through the Platform. FINOVO reserves the right to modify applicable fees prospectively by providing appropriate notice.
              </Text>

              <Text style={styles.tncSectionNum}>12. Referral & Team Programs</Text>
              <Text style={styles.tncBodyText}>
                Where FINOVO offers referral or team-based rewards, eligibility, calculation methodology, levels, limits, and payment conditions will be governed by the applicable program rules. FINOVO may reject rewards generated through fraudulent, artificial, duplicate, self-referral, or otherwise prohibited activity.
              </Text>

              <Text style={styles.tncSectionNum}>13. Prohibited Activities</Text>
              <Text style={styles.tncBodyText}>
                Users must not:{'\n'}
                • Provide false or misleading information.{'\n'}
                • Use another person's account.{'\n'}
                • Attempt to manipulate Platform records or trading information.{'\n'}
                • Conduct fraudulent transactions.{'\n'}
                • Use the Platform for unlawful activities.{'\n'}
                • Attempt unauthorized access to FINOVO systems.
              </Text>

              {/* User Declaration Box */}
              <View style={styles.tncDeclarationBox}>
                <Text style={styles.tncDeclarationTitle}>14. User Acknowledgment & Declaration</Text>
                <Text style={styles.tncDeclarationSub}>
                  By proceeding with registration, investment, or use of our services, I hereby acknowledge and confirm that:
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>1. Age & Eligibility: </Text>
                  I confirm that I am 18 years of age or older and legally eligible to use the services offered by the Company.
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>2. Terms & Conditions: </Text>
                  I confirm that I have read, understood, and agreed to all applicable Terms & Conditions, policies, disclosures, and guidelines of the Company.
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>3. Investment Risk: </Text>
                  I understand and acknowledge that all investments involve a certain level of risk, and that the value of an investment may fluctuate. I understand that returns are not guaranteed unless expressly stated otherwise by the Company.
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>4. Independent Decision: </Text>
                  I confirm that I am making my investment or financial decision voluntarily and at my own discretion, after considering the associated risks and my own financial circumstances.
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>5. Risk Acceptance: </Text>
                  I acknowledge that I have understood the nature and risks associated with the investment/service and accept the risks involved before proceeding.
                </Text>
                <Text style={styles.tncDeclarationItem}>
                  <Text style={{ fontWeight: '700', color: colors.goldSoft }}>6. Accuracy of Information: </Text>
                  I confirm that all information and documents provided by me to the Company are true, accurate, complete, and up to date.
                </Text>
                <Text style={[styles.tncDeclarationSub, { marginTop: 10, color: colors.goldSoft, fontWeight: '700' }]}>
                  By selecting “I Agree / I Acknowledge”, I confirm that I have read, understood, and voluntarily accepted the above declaration and the Company's applicable Terms & Conditions.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setTncModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAgreeBtn}
                onPress={() => {
                  setAgreedToTnc(true);
                  setTncModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalAgreeBtnText}>I Agree & Acknowledge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
  },
  brandLogo: {
    width: 240,
    height: 80,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
  tncRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    marginBottom: 6,
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  tncText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  tncLink: {
    color: colors.goldSoft,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 7, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#0c1017',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  modalScrollBody: {
    padding: 18,
  },
  tncSectionNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
    marginTop: 10,
    marginBottom: 4,
  },
  tncBodyText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  tncDeclarationBox: {
    backgroundColor: 'rgba(198, 153, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  tncDeclarationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldSoft,
    marginBottom: 6,
  },
  tncDeclarationSub: {
    fontSize: 11.5,
    color: colors.textMain,
    lineHeight: 16,
    marginBottom: 6,
  },
  tncDeclarationItem: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 5,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseBtnText: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalAgreeBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
  },
  modalAgreeBtnText: {
    fontSize: 12.5,
    color: '#030507',
    fontWeight: '700',
  },
});

