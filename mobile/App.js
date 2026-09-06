import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InvestmentsScreen from './src/screens/InvestmentsScreen';
import WalletScreen from './src/screens/WalletScreen';
import ReferralsScreen from './src/screens/ReferralsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import KYCScreen from './src/screens/KYCScreen';
import SupportScreen from './src/screens/SupportScreen';
import AdminScreen from './src/screens/AdminScreen';
import colors from './src/theme/colors';
import { apiCall } from './src/config/api';
import { APP_VERSION, compareSemVer } from './src/config/version';
import AppUpdateModal from './src/components/AppUpdateModal';

function MainApp({ initialDeepLink }) {
  const { token, user, isAdmin, adminMode } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'investments' | 'wallet' | 'referrals' | 'profile' | 'kyc' | 'support' | 'admin'

  if (!token || !user) {
    return <AuthScreen initialMode={initialDeepLink?.mode} initialRefCode={initialDeepLink?.refCode} />;
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
      case 'profile':
        return <ProfileScreen onNavigate={navigateTo} />;
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />

      {/* Global Clean Topbar Header (Obsidian Glass with Gold Accents) */}
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.brandCol}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.8}
        >
          <Image
            source={require('./src/assets/logo-title.png')}
            style={styles.brandLogoImg}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Screen Body */}
      <View style={styles.content}>{renderScreen()}</View>

      {/* Institutional Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* 1. Overview / Dashboard */}
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
            numberOfLines={1}
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
            numberOfLines={1}
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
            numberOfLines={1}
            style={[
              styles.navLabel,
              activeTab === 'wallet' && styles.navLabelActive,
            ]}
          >
            Wallet
          </Text>
        </TouchableOpacity>

        {/* 4. Network / Referrals */}
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
            numberOfLines={1}
            style={[
              styles.navLabel,
              activeTab === 'referrals' && styles.navLabelActive,
            ]}
          >
            Network
          </Text>
        </TouchableOpacity>

        {/* 5. My Profile */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          {(activeTab === 'profile' || activeTab === 'kyc' || activeTab === 'support' || activeTab === 'admin') && (
            <View style={styles.activeIndicator} />
          )}
          <Feather
            name="user"
            size={18}
            color={
              activeTab === 'profile' || activeTab === 'kyc' || activeTab === 'support' || activeTab === 'admin'
                ? colors.goldSoft
                : colors.textMuted
            }
          />
          <Text
            numberOfLines={1}
            style={[
              styles.navLabel,
              (activeTab === 'profile' || activeTab === 'kyc' || activeTab === 'support' || activeTab === 'admin') &&
                styles.navLabelActive,
            ]}
          >
            My Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [deepLink, setDeepLink] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    // Check for App Updates on Startup
    const checkAppVersion = async () => {
      try {
        const res = await apiCall('/dashboard/app-version/').catch(() => null);
        if (res && res.latest_version) {
          const isOlderThanLatest = compareSemVer(APP_VERSION, res.latest_version) < 0;
          const isOlderThanMin = compareSemVer(APP_VERSION, res.min_version) < 0;
          const isForceUpdate = isOlderThanMin || !!res.force_update;

          if (isOlderThanLatest || isForceUpdate) {
            setUpdateInfo({
              visible: true,
              latestVersion: res.latest_version,
              minVersion: res.min_version,
              downloadUrl: res.download_url,
              releaseNotes: res.release_notes,
              isForceUpdate: isForceUpdate,
            });
          }
        }
      } catch (err) {
        console.warn('App version check failed:', err.message);
      }
    };

    checkAppVersion();

    const handleUrl = (url) => {
      if (!url) return;
      try {
        let mode = null;
        let refCode = null;
        if (url.includes('register') || url.includes('#register')) {
          mode = 'register';
        }
        const regex = /[?&]ref=([^&#]*)/;
        const match = regex.exec(url);
        if (match) {
          refCode = match[1];
        }

        if (mode || refCode) {
          setDeepLink({ mode, refCode });
        }
      } catch (e) {}
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <MainApp initialDeepLink={deepLink} />
      {updateInfo && (
        <AppUpdateModal
          visible={updateInfo.visible}
          currentVersion={APP_VERSION}
          latestVersion={updateInfo.latestVersion}
          releaseNotes={updateInfo.releaseNotes}
          downloadUrl={updateInfo.downloadUrl}
          isForceUpdate={updateInfo.isForceUpdate}
          onDismiss={() => setUpdateInfo(prev => (prev ? { ...prev, visible: false } : null))}
        />
      )}
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  topbar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#070A0E',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgCardBorder,
  },
  brandCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImg: {
    width: 210,
    height: 48,
    maxWidth: '85%',
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

