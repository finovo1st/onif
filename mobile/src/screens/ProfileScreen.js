import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';
import { copyToClipboard } from '../utils/clipboard';
import { apiCall } from '../config/api';

export default function ProfileScreen({ onNavigate }) {
  const {
    user,
    logout,
    isAdmin,
    adminMode,
    toggleAdminMode,
    fetchProfile,
  } = useContext(AuthContext);

  const [refreshing, setRefreshing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [country, setCountry] = useState(user?.country || '');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [showProfileCurrentPassword, setShowProfileCurrentPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password changing state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setUsername(user.username || '');
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone_number || '');
      setCountry(user.country || '');
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (fetchProfile) await fetchProfile();
    } catch (e) {
      console.warn('Profile refresh error:', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Email address is required.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username is required.');
      return;
    }
    if (!profileCurrentPassword) {
      Alert.alert('Validation Error', 'Current password is required to save profile changes.');
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        email: email.trim(),
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        country: country.trim(),
        current_password: profileCurrentPassword,
      };
      await apiCall('/auth/profile/', 'PATCH', payload);
      if (fetchProfile) await fetchProfile();
      Alert.alert('Success', 'Your profile details have been updated successfully.');
      setIsEditingProfile(false);
      setProfileCurrentPassword('');
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword) {
      Alert.alert('Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiCall('/auth/change-password/', 'POST', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: confirmPassword,
      });
      Alert.alert('Success', res?.detail || 'Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err) {
      Alert.alert('Password Change Failed', err.message || 'Could not change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const copyText = async (label, text) => {
    if (!text) return;
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
    await copyToClipboard(text, label, true);
  };

  const handleLogoutConfirm = () => {
    Alert.alert(
      'Sign Out Confirmation',
      'Are you sure you want to end your current session and sign out from FINOVO?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const isKycApproved = user?.kyc_status === 'APPROVED';
  const kycText = isKycApproved
    ? 'KYC Verified'
    : user?.kyc_status === 'IN_REVIEW'
    ? 'KYC In Review'
    : 'KYC Pending';
  const kycBg = isKycApproved
    ? colors.badgeApprovedBg
    : user?.kyc_status === 'IN_REVIEW'
    ? colors.badgePendingBg
    : colors.badgeRejectedBg;
  const kycBorder = isKycApproved
    ? colors.badgeApprovedBorder
    : user?.kyc_status === 'IN_REVIEW'
    ? colors.badgePendingBorder
    : colors.badgeRejectedBorder;
  const kycColor = isKycApproved
    ? colors.accentGreenSoft
    : user?.kyc_status === 'IN_REVIEW'
    ? colors.accentWarning
    : colors.accentDanger;

  const initials = (
    (user?.first_name ? user.first_name[0] : '') +
    (user?.last_name ? user.last_name[0] : '')
  ).toUpperCase() || (user?.username ? user.username.slice(0, 2).toUpperCase() : 'FN');

  const fullName =
    user?.first_name || user?.last_name
      ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
      : user?.username || 'Institutional Investor';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* ─── 1. PAGE HEADER ─── */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MEMBER PROFILE &amp; PREFERENCES</Text>
        <Text style={styles.pageTitle}>My Profile</Text>
      </View>

      {/* ─── 2. USER IDENTITY CARD ─── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.avatarStatusDot} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userHandle}>@{user?.username || 'member'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>
          </View>
        </View>

        {/* Badges Row */}
        <View style={styles.badgeRow}>
          <View style={styles.levelBadge}>
            <Feather name="shield" size={11} color={colors.goldSoft} style={{ marginRight: 4 }} />
            <Text style={styles.levelBadgeText}>Level {user?.active_level || 1} Member</Text>
          </View>

          <TouchableOpacity
            style={[styles.kycBadge, { backgroundColor: kycBg, borderColor: kycBorder }]}
            onPress={() => onNavigate && onNavigate('kyc')}
            activeOpacity={0.7}
          >
            <Feather
              name={isKycApproved ? 'check-circle' : 'alert-circle'}
              size={11}
              color={kycColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.kycBadgeText, { color: kycColor }]}>{kycText}</Text>
          </TouchableOpacity>
        </View>

        {/* User Meta Strip */}
        <View style={styles.metaStrip}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>MEMBER ID / UID</Text>
            <TouchableOpacity
              style={styles.copyRow}
              onPress={() => copyText('User ID', String(user?.id || 'N/A'))}
              activeOpacity={0.7}
            >
              <Text style={styles.metaValue}>#{user?.id || '—'}</Text>
              <Feather name="copy" size={11} color={colors.goldSoft} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          <View style={styles.metaDivider} />

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>MY REFERRAL CODE</Text>
            <TouchableOpacity
              style={styles.copyRow}
              onPress={() => copyText('Referral Code', user?.referral_code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.metaValue, { color: colors.goldSoft }]}>
                {user?.referral_code || '—'}
              </Text>
              <Feather name="copy" size={11} color={colors.goldSoft} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── 3. SUPERUSER / ADMIN CONSOLE BANNER (WHEN ADMIN) ─── */}
      {isAdmin && (
        <View style={styles.adminCard}>
          <View style={styles.adminCardHeader}>
            <View style={styles.adminIconBox}>
              <Feather name="shield" size={18} color={colors.goldSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.adminTagRow}>
                <Text style={styles.adminCardTitle}>⚡ Superuser Privileges</Text>
                <View style={[styles.modePill, adminMode && styles.modePillActive]}>
                  <Text style={[styles.modePillText, adminMode && styles.modePillTextActive]}>
                    {adminMode ? 'ADMIN MODE' : 'INVESTOR VIEW'}
                  </Text>
                </View>
              </View>
              <Text style={styles.adminCardDesc}>
                Full platform governance and liquidity management active.
              </Text>
            </View>
          </View>

          <View style={styles.adminActionRow}>
            <TouchableOpacity
              style={[
                styles.adminToggleBtn,
                adminMode ? styles.adminToggleBtnActive : styles.adminToggleBtnInactive,
              ]}
              onPress={() => {
                toggleAdminMode();
                if (!adminMode && onNavigate) onNavigate('admin');
              }}
              activeOpacity={0.8}
            >
              <Feather
                name={adminMode ? 'user' : 'shield'}
                size={13}
                color={adminMode ? '#030507' : colors.goldSoft}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.adminToggleBtnText,
                  adminMode ? styles.adminToggleBtnTextActive : styles.adminToggleBtnTextInactive,
                ]}
              >
                {adminMode ? 'Switch to Investor View' : 'Toggle Admin Mode'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adminLaunchBtn}
              onPress={() => onNavigate && onNavigate('admin')}
              activeOpacity={0.8}
            >
              <Text style={styles.adminLaunchBtnText}>Admin Console →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── 4. PERSONAL DETAILS & EDIT PROFILE ─── */}
      <Text style={styles.sectionHeading}>PROFILE &amp; SECURITY SETTINGS</Text>
      <View style={styles.formCard}>
        <View style={styles.formCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(198, 153, 61, 0.15)' }]}>
              <Feather name="user" size={17} color={colors.goldSoft} />
            </View>
            <View>
              <Text style={styles.formCardTitle}>Personal Information</Text>
              <Text style={styles.formCardSub}>Edit email, names, and contact details</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editToggleBtn}
            onPress={() => {
              setIsEditingProfile(!isEditingProfile);
              setProfileCurrentPassword('');
            }}
            activeOpacity={0.7}
          >
            <Feather
              name={isEditingProfile ? 'x' : 'edit-2'}
              size={13}
              color={isEditingProfile ? colors.accentDanger : colors.goldSoft}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.editToggleText,
                { color: isEditingProfile ? colors.accentDanger : colors.goldSoft },
              ]}
            >
              {isEditingProfile ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isEditingProfile ? (
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoVal}>{user?.email || 'Not Set'}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoVal}>@{user?.username || 'member'}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Legal Name</Text>
              <Text style={styles.infoVal}>{fullName}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoVal}>{user?.phone_number || 'Not Set'}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Country / Region</Text>
              <Text style={styles.infoVal}>{user?.country || 'Not Set'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.editForm}>
            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email address"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHelp}>
              Updating email updates your account sign-in address.
            </Text>

            <Text style={styles.inputLabel}>Username *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Country / Jurisdiction</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              placeholderTextColor={colors.textDim}
            />

            <Text style={[styles.inputLabel, { marginTop: 8 }]}>Current Password *</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={profileCurrentPassword}
                onChangeText={setProfileCurrentPassword}
                placeholder="Enter current password to confirm"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showProfileCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passEyeBtn}
                onPress={() => setShowProfileCurrentPassword(!showProfileCurrentPassword)}
              >
                <Feather
                  name={showProfileCurrentPassword ? 'eye-off' : 'eye'}
                  size={15}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHelp}>
              Required to verify your identity before saving profile changes.
            </Text>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.8}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#030507" />
              ) : (
                <>
                  <Feather name="check" size={15} color="#030507" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryActionBtnText}>Save Profile Details</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── 5. SECURITY & CHANGE PASSWORD ─── */}
      <View style={styles.formCard}>
        <View style={styles.formCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Feather name="lock" size={17} color={colors.accentDanger} />
            </View>
            <View>
              <Text style={styles.formCardTitle}>Password &amp; Security</Text>
              <Text style={styles.formCardSub}>Change your account login password</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editToggleBtn}
            onPress={() => setIsChangingPassword(!isChangingPassword)}
            activeOpacity={0.7}
          >
            <Feather
              name={isChangingPassword ? 'x' : 'key'}
              size={13}
              color={isChangingPassword ? colors.accentDanger : colors.goldSoft}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.editToggleText,
                { color: isChangingPassword ? colors.accentDanger : colors.goldSoft },
              ]}
            >
              {isChangingPassword ? 'Cancel' : 'Change'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isChangingPassword ? (
          <View style={{ paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17 }}>
              Protect your account by ensuring you use a strong, unique password of at least 8 characters.
            </Text>
          </View>
        ) : (
          <View style={styles.editForm}>
            <Text style={styles.inputLabel}>Current Password *</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showOldPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passEyeBtn}
                onPress={() => setShowOldPass(!showOldPass)}
              >
                <Feather name={showOldPass ? 'eye-off' : 'eye'} size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 10 }]}>New Password (min. 8 characters) *</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showNewPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passEyeBtn}
                onPress={() => setShowNewPass(!showNewPass)}
              >
                <Feather name={showNewPass ? 'eye-off' : 'eye'} size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Confirm New Password *</Text>
            <View style={styles.passInputWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showConfirmPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passEyeBtn}
                onPress={() => setShowConfirmPass(!showConfirmPass)}
              >
                <Feather name={showConfirmPass ? 'eye-off' : 'eye'} size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.gold, marginTop: 14 }]}
              onPress={handleChangePassword}
              disabled={savingPassword}
              activeOpacity={0.8}
            >
              {savingPassword ? (
                <ActivityIndicator size="small" color="#030507" />
              ) : (
                <>
                  <Feather name="shield" size={15} color="#030507" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryActionBtnText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── 6. ACCOUNT NAVIGATION & VERIFICATION ─── */}
      <Text style={styles.sectionHeading}>ACCOUNT &amp; GOVERNANCE</Text>
      <View style={styles.menuGroup}>
        {/* KYC Verification Item */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate && onNavigate('kyc')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Feather name="check-square" size={17} color={colors.accentGreenSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.menuItemTitle}>KYC Identity Verification</Text>
              <View style={[styles.statusMiniPill, { backgroundColor: kycBg, borderColor: kycBorder }]}>
                <Text style={[styles.statusMiniPillText, { color: kycColor }]}>{kycText}</Text>
              </View>
            </View>
            <Text style={styles.menuItemDesc}>
              {isKycApproved
                ? 'Identity verified • Segregated custody active'
                : 'Submit government ID to verify withdrawal limits'}
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textDim} />
        </TouchableOpacity>

        <View style={styles.menuSeparator} />

        {/* Referral Network Item */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate && onNavigate('referrals')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(198, 153, 61, 0.12)' }]}>
            <Feather name="users" size={17} color={colors.goldSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Referral Team &amp; Commissions</Text>
            <Text style={styles.menuItemDesc}>
              View unilevel tree, referral bonuses, and tier rank progress
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textDim} />
        </TouchableOpacity>

        <View style={styles.menuSeparator} />

        {/* Wallet & Transactions Item */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate && onNavigate('wallet')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
            <Feather name="credit-card" size={17} color="#60A5FA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Wallet &amp; Financial Ledger</Text>
            <Text style={styles.menuItemDesc}>
              Deposit USDT, request withdrawals, and track audit history
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textDim} />
        </TouchableOpacity>

        <View style={styles.menuSeparator} />

        {/* Investment Plans Item */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate && onNavigate('investments')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
            <Feather name="trending-up" size={17} color="#C084FC" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Structured Investment Plans</Text>
            <Text style={styles.menuItemDesc}>
              Explore 2.0% weekly ROI institutional strategy tiers
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      {/* ─── 5. INSTITUTIONAL SUPPORT & SECURITY ─── */}
      <Text style={styles.sectionHeading}>SUPPORT &amp; SECURITY</Text>
      <View style={styles.menuGroup}>
        {/* Support Desk Item */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate && onNavigate('support')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(198, 153, 61, 0.12)' }]}>
            <Feather name="headphones" size={17} color={colors.goldSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Institutional Helpdesk</Text>
            <Text style={styles.menuItemDesc}>
              Open support tickets and 24/7 client concierge
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textDim} />
        </TouchableOpacity>

        <View style={styles.menuSeparator} />

        {/* Security Info Card */}
        <View style={styles.securityItem}>
          <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Feather name="lock" size={17} color={colors.accentGreenSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Institutional Custody Standards</Text>
            <Text style={styles.menuItemDesc}>
              Segregated cold storage, multi-sig authorization, and automated 300% return caps.
            </Text>
          </View>
        </View>
      </View>

      {/* ─── 6. SESSION LOGOUT BUTTON ─── */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogoutConfirm}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={16} color={colors.accentDanger} style={{ marginRight: 8 }} />
        <Text style={styles.logoutBtnText}>Sign Out from Account</Text>
      </TouchableOpacity>

      {/* ─── 7. FOOTER BRANDING ─── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>FINOVO Mobile v1.0.0 • Institutional Trading Desk</Text>
        <Text style={styles.footerSubText}>© 2026 FINOVO. Segregated Vault Architecture.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.goldSoft,
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    padding: 16,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(198, 153, 61, 0.18)',
    borderWidth: 2,
    borderColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.5,
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentGreen,
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textMain,
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 12,
    color: colors.goldSoft,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 11.5,
    color: colors.textMuted,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(198, 153, 61, 0.12)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  kycBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 5, 7, 0.6)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaCol: {
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 10,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
  },

  // Superuser Admin Card
  adminCard: {
    backgroundColor: 'rgba(198, 153, 61, 0.08)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  adminCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  adminIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(198, 153, 61, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  adminCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.3,
  },
  modePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modePillActive: {
    backgroundColor: colors.gold,
  },
  modePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  modePillTextActive: {
    color: '#030507',
  },
  adminCardDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adminToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  adminToggleBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  adminToggleBtnInactive: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderColor: colors.bgCardBorderGold,
  },
  adminToggleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  adminToggleBtnTextActive: {
    color: '#030507',
  },
  adminToggleBtnTextInactive: {
    color: colors.goldSoft,
  },
  adminLaunchBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminLaunchBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textMain,
  },

  // Menus
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textDim,
    letterSpacing: 1.1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 18,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 2,
  },
  menuItemDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 62,
  },
  statusMiniPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusMiniPillText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // Logout Button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.accentDanger,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 10.5,
    color: colors.textDim,
    fontWeight: '600',
    marginBottom: 2,
  },
  footerSubText: {
    fontSize: 9.5,
    color: colors.textDim,
  },

  // Profile Edit & Password Form Styles
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 16,
    marginBottom: 16,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMain,
  },
  formCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
  },
  editToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoList: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  infoVal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMain,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  editForm: {
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0E131A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: 6,
  },
  inputHelp: {
    fontSize: 10,
    color: colors.textDim,
    marginBottom: 6,
    lineHeight: 14,
  },
  passInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  passEyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 10,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#030507',
  },
});
