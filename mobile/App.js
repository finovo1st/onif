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
import colors from './src/theme/colors';

function MainApp() {
  const { token, user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'investments' | 'wallet' | 'referrals' | 'kyc' | 'support'

  if (!token || !user) {
    return <AuthScreen />;
  }

  const navigateTo = (tabName) => {
    setActiveTab(tabName);
  };

  const renderScreen = () => {
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
      default:
        return <DashboardScreen onNavigate={navigateTo} />;
    }
  };

  const isKycApproved = user?.kyc_status === 'APPROVED';
  const kycText = isKycApproved ? 'KYC Verified' : user?.kyc_status === 'IN_REVIEW' ? 'KYC In Review' : 'KYC Pending';
  const kycBg = isKycApproved ? colors.badgeApprovedBg : user?.kyc_status === 'IN_REVIEW' ? colors.badgePendingBg : colors.badgeRejectedBg;
  const kycBorder = isKycApproved ? colors.badgeApprovedBorder : user?.kyc_status === 'IN_REVIEW' ? colors.badgePendingBorder : colors.badgeRejectedBorder;
  const kycColor = isKycApproved ? colors.accentGreenSoft : user?.kyc_status === 'IN_REVIEW' ? colors.accentWarning : colors.accentDanger;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />

      {/* Global Topbar Header (Obsidian Glass with Gold Accents) */}
      <View style={styles.topbar}>
        <View style={styles.brandCol}>
          <View style={styles.brandLogoCircle}>
            <Text style={styles.brandLogoText}>F</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>FINOVO</Text>
            <View style={styles.userSubRow}>
              <Text style={styles.userRole}>Level {user?.active_level || 2}</Text>
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
            size={19}
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
            size={19}
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
            size={19}
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
            size={19}
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
            size={19}
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
    width: 34,
    height: 34,
    borderRadius: 8,
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
    letterSpacing: 1.2,
  },
  userSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  userRole: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '600',
  },
  kycBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  kycBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#030507',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 6,
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#070A0E',
    borderTopWidth: 1,
    borderTopColor: colors.bgCardBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 2,
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    position: 'relative',
    paddingTop: 6,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2.5,
    backgroundColor: colors.gold,
    borderRadius: 2,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
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
