import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InvestmentsScreen from './src/screens/InvestmentsScreen';
import WalletScreen from './src/screens/WalletScreen';
import ReferralsScreen from './src/screens/ReferralsScreen';
import KYCScreen from './src/screens/KYCScreen';
import SupportScreen from './src/screens/SupportScreen';
import AdminScreen from './src/screens/AdminScreen';
import colors from './src/theme/colors';

function MainApp() {
  const { token, user, logout, isAdmin, adminMode, toggleAdminMode } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'investments' | 'wallet' | 'referrals' | 'kyc' | 'support' | 'admin'

  if (!token || !user) {
    return <AuthScreen />;
  }

  const navigateTo = (tabName) => {
    setActiveTab(tabName);
  };

  const renderScreen = () => {
    if (adminMode && activeTab === 'admin') {
      return <AdminScreen onNavigate={navigateTo} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen onNavigate={navigateTo} />;
      case 'investments':
        return <InvestmentsScreen onNavigate={navigateTo} />;
      case 'wallet':
        return <WalletScreen onNavigate={navigateTo} />;
      case 'referrals':
        return <ReferralsScreen onNavigate={navigateTo} />;
      case 'kyc':
        return <KYCScreen onNavigate={navigateTo} />;
      case 'support':
        return <SupportScreen onNavigate={navigateTo} />;
      case 'admin':
        return <AdminScreen onNavigate={navigateTo} />;
      default:
        return <DashboardScreen onNavigate={navigateTo} />;
    }
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />

      {/* Admin Mode Switch Banner (Matches Web Portal Banner) */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.adminBanner, adminMode ? styles.adminBannerActive : styles.adminBannerInactive]}
          onPress={() => {
            toggleAdminMode();
            if (!adminMode) setActiveTab('admin');
            else setActiveTab('dashboard');
          }}
          activeOpacity={0.8}
        >
          <Feather
            name={adminMode ? 'shield' : 'user'}
            size={12}
            color={adminMode ? '#030507' : colors.goldSoft}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.adminBannerText,
              adminMode ? styles.adminBannerTextActive : styles.adminBannerTextInactive,
            ]}
          >
            {adminMode
              ? '⚡ ADMIN CONSOLE ACTIVE • Tap to switch to Investor View'
              : '⚡ SUPERUSER DETECTED • Tap to switch to Admin Console'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Global Topbar Header (Obsidian Glass with Gold Accents) */}
      <View style={styles.topbar}>
        <View style={styles.brandCol}>
          <View style={styles.brandLogoCircle}>
            <Text style={styles.brandLogoText}>F</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>FINOVO</Text>
            <View style={styles.userSubRow}>
              <Text style={styles.userRole}>Level {user?.active_level || 1}</Text>
              <TouchableOpacity
                style={[styles.kycBadge, { backgroundColor: kycBg, borderColor: kycBorder }]}
                onPress={() => setActiveTab('kyc')}
                activeOpacity={0.7}
              >
                <Text style={[styles.kycBadgeText, { color: kycColor }]}>{kycText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.topbarActions}>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.topAdminBtn, activeTab === 'admin' && styles.topAdminBtnActive]}
              onPress={() => setActiveTab('admin')}
              activeOpacity={0.8}
            >
              <Feather name="shield" size={12} color={activeTab === 'admin' ? '#030507' : colors.goldSoft} />
              <Text
                style={[
                  styles.topAdminBtnText,
                  activeTab === 'admin' && styles.topAdminBtnTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickInvestBtn}
            onPress={() => setActiveTab('investments')}
            activeOpacity={0.8}
          >
            <Feather name="plus-circle" size={13} color="#030507" style={{ marginRight: 4 }} />
            <Text style={styles.quickInvestText}>Invest</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.7}
            title="Logout"
          >
            <Feather name="log-out" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.content}>{renderScreen()}</View>

      {/* Institutional Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* 1. Dashboard */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.7}
        >
          {activeTab === 'dashboard' && <View style={styles.activeIndicator} />}
          <Feather
            name="grid"
            size={18}
            color={activeTab === 'dashboard' ? colors.goldSoft : colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'dashboard' && styles.navLabelActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        {/* 2. Investments */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('investments')}
          activeOpacity={0.7}
        >
          {activeTab === 'investments' && <View style={styles.activeIndicator} />}
          <Feather
            name="trending-up"
            size={18}
            color={activeTab === 'investments' ? colors.goldSoft : colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'investments' && styles.navLabelActive,
            ]}
          >
            Invest
          </Text>
        </TouchableOpacity>

        {/* 3. Wallet */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('wallet')}
          activeOpacity={0.7}
        >
          {activeTab === 'wallet' && <View style={styles.activeIndicator} />}
          <Feather
            name="credit-card"
            size={18}
            color={activeTab === 'wallet' ? colors.goldSoft : colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'wallet' && styles.navLabelActive,
            ]}
          >
            Wallet
          </Text>
        </TouchableOpacity>

        {/* 4. Network */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('referrals')}
          activeOpacity={0.7}
        >
          {activeTab === 'referrals' && <View style={styles.activeIndicator} />}
          <Feather
            name="users"
            size={18}
            color={activeTab === 'referrals' ? colors.goldSoft : colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'referrals' && styles.navLabelActive,
            ]}
          >
            Network
          </Text>
        </TouchableOpacity>

        {/* 5. Support / Helpdesk */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab(activeTab === 'kyc' ? 'kyc' : 'support')}
          activeOpacity={0.7}
        >
          {(activeTab === 'support' || activeTab === 'kyc') && <View style={styles.activeIndicator} />}
          <Feather
            name="headphones"
            size={18}
            color={
              activeTab === 'support' || activeTab === 'kyc'
                ? colors.goldSoft
                : colors.textMuted
            }
          />
          <Text
            style={[
              styles.navLabel,
              (activeTab === 'support' || activeTab === 'kyc') && styles.navLabelActive,
            ]}
          >
            Support
          </Text>
        </TouchableOpacity>

        {/* 6. Admin Tab (Only when superuser/staff) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => setActiveTab('admin')}
            activeOpacity={0.7}
          >
            {activeTab === 'admin' && <View style={styles.activeIndicator} />}
            <Feather
              name="shield"
              size={18}
              color={activeTab === 'admin' ? colors.goldSoft : colors.textMuted}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'admin' && styles.navLabelActive,
              ]}
            >
              Admin
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  adminBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerActive: {
    backgroundColor: colors.gold,
  },
  adminBannerInactive: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgCardBorderGold,
  },
  adminBannerText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  adminBannerTextActive: {
    color: '#030507',
  },
  adminBannerTextInactive: {
    color: colors.goldSoft,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#070A0E',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgCardBorder,
  },
  brandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: 1.5,
  },
  userSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  userRole: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '600',
  },
  kycBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  kycBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  topAdminBtnActive: {
    backgroundColor: colors.gold,
  },
  topAdminBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  topAdminBtnTextActive: {
    color: '#030507',
  },
  quickInvestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickInvestText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#030507',
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#070A0E',
    borderTopWidth: 1,
    borderTopColor: colors.bgCardBorder,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },
  navLabel: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
});
