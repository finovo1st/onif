import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function DashboardScreen({ onNavigate }) {
  const { user, isDemoMode } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    wallet_balance: 1450.0,
    total_deposited: 1000.0,
    active_investments_amount: 1000.0,
    total_roi_earned: 125.0,
    total_direct_income: 80.0,
    total_referral_income: 25.0,
    direct_team: 4,
    active_level: 2,
    referral_code: 'ALICE123',
    referral_link: 'https://finovo.app/app.html#register?ref=ALICE123',
  });

  const [activeInvestments, setActiveInvestments] = useState([
    {
      id: 'inv-1',
      plan_name: 'Package 1',
      cost: 120.0,
      amount: 120.0,
      trading_capital: 100.0,
      max_return: 350.0,
      total_credited: 125.0,
      status: 'ACTIVE',
      weekly_roi_rate: 2.0,
    },
  ]);

  const [recentLedger, setRecentLedger] = useState([
    {
      id: '1',
      transaction_type: 'CREDIT',
      category: 'DEPOSIT',
      amount: 120.0,
      balance_after: 120.0,
      created_at: '2026-08-01',
      description: 'Approved deposit #dep-001 for Package 1',
    },
    {
      id: '2',
      transaction_type: 'CREDIT',
      category: 'DIRECT_INCOME',
      amount: 40.0,
      balance_after: 160.0,
      created_at: '2026-08-05',
      description: 'Level-1 direct commission from l2_emma@finovo.com',
    },
    {
      id: '3',
      transaction_type: 'CREDIT',
      category: 'ROI',
      amount: 125.0,
      balance_after: 285.0,
      created_at: '2026-08-10',
      description: 'Weekly ROI credited from Package 1',
    },
  ]);

  const loadDashboardData = async () => {
    if (isDemoMode) return;
    try {
      const data = await apiCall('/dashboard/');
      if (data) {
        setStats({
          wallet_balance: data.wallet_balance || 0,
          total_deposited: data.total_deposited || 0,
          active_investments_amount: data.total_invested || 0,
          total_roi_earned: data.total_roi_earned || 0,
          total_direct_income: data.total_direct_income || 0,
          total_referral_income: data.total_referral_income || 0,
          direct_team: data.direct_team || 0,
          active_level: data.active_level || user?.active_level || 0,
          referral_code: data.referral_code || user?.referral_code || 'ALICE123',
          referral_link: data.referral_link || `https://finovo.app/app.html#register?ref=${user?.referral_code || 'ALICE123'}`,
        });
      }

      const investments = await apiCall('/investments/').catch(() => []);
      const invList = Array.isArray(investments) ? investments : (investments?.results || []);
      if (invList.length > 0) {
        setActiveInvestments(invList);
      }

      const ledger = await apiCall('/wallet/transactions/').catch(() => []);
      const ledgerList = Array.isArray(ledger) ? ledger : (ledger?.results || []);
      if (ledgerList.length > 0) {
        setRecentLedger(ledgerList);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const copyText = (label, text) => {
    Alert.alert('Copied to Clipboard', `${label}: ${text}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* Action Header Strip */}
      <View style={styles.actionHeader}>
        <View>
          <Text style={styles.eyebrow}>PORTFOLIO OVERVIEW</Text>
          <Text style={styles.pageTitle}>Dashboard</Text>
        </View>
        <View style={styles.topActionBtns}>
          <TouchableOpacity
            style={styles.btnSmPrimary}
            onPress={() => onNavigate && onNavigate('investments')}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={12} color="#030507" style={{ marginRight: 3 }} />
            <Text style={styles.btnSmPrimaryText}>Invest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSmSecondary}
            onPress={() => onNavigate && onNavigate('wallet')}
            activeOpacity={0.7}
          >
            <Text style={styles.btnSmSecondaryText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 5-Metric Cards Grid (Matching Web Portal) */}
      <View style={styles.metricGrid}>
        <View style={styles.statCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Wallet Balance</Text>
            <Text style={styles.statValue}>${Number(stats.wallet_balance).toFixed(2)}</Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="credit-card" size={17} color={colors.goldSoft} />
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Active Investments</Text>
            <Text style={styles.statValue}>${Number(stats.active_investments_amount).toFixed(2)}</Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="activity" size={17} color={colors.goldSoft} />
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Total ROI Earned</Text>
            <Text style={[styles.statValue, { color: colors.accentGreenSoft }]}>
              +${Number(stats.total_roi_earned).toFixed(2)}
            </Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="trending-up" size={17} color={colors.accentGreenSoft} />
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Direct Referral Income</Text>
            <Text style={[styles.statValue, { color: colors.goldSoft }]}>
              +${Number(stats.total_direct_income).toFixed(2)}
            </Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="user-check" size={17} color={colors.goldSoft} />
          </View>
        </View>

        <View style={[styles.statCard, { width: '100%' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statLabel}>Total Referral ROI Income (5 Levels)</Text>
            <Text style={[styles.statValue, { color: colors.goldSoft }]}>
              +${Number(stats.total_referral_income).toFixed(2)}
            </Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="award" size={17} color={colors.goldSoft} />
          </View>
        </View>
      </View>

      {/* Active Investments Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>PORTFOLIO</Text>
            <Text style={styles.cardTitle}>Active Investments</Text>
          </View>
          <TouchableOpacity
            style={styles.btnSmPrimary}
            onPress={() => onNavigate && onNavigate('investments')}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={12} color="#030507" style={{ marginRight: 3 }} />
            <Text style={styles.btnSmPrimaryText}>New Plan</Text>
          </TouchableOpacity>
        </View>

        {activeInvestments.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No active investments currently recorded.
          </Text>
        ) : (
          activeInvestments.map((inv, idx) => {
            const credited = Number(inv.total_credited || 0);
            const maxRet = Number(inv.max_return || inv.amount * 3);
            const pct = maxRet > 0 ? Math.min(100, (credited / maxRet) * 100) : 0;
            return (
              <View key={inv.id || idx} style={styles.invItem}>
                <View style={styles.invTopRow}>
                  <Text style={styles.invPlanName}>
                    {inv.plan_name || 'Trading Plan'} (${Number(inv.amount).toFixed(2)} USDT)
                  </Text>
                  <Text style={styles.invReturnCap}>
                    ${credited.toFixed(2)} / ${maxRet.toFixed(2)} ({pct.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.invSubRow}>
                  <Text style={styles.invMeta}>300% Cap Limit</Text>
                  <Text style={styles.invStatus}>{inv.status || 'ACTIVE'}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Quick Referral Share Box */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>AFFILIATE</Text>
            <Text style={styles.cardTitle}>Your Referral Code &amp; Link</Text>
          </View>
        </View>

        <Text style={styles.refExplainer}>
          Share your link to earn <Text style={{ color: colors.textMain, fontWeight: '700' }}>Direct Commission</Text> +{' '}
          <Text style={{ color: colors.textMain, fontWeight: '700' }}>Weekly ROI Level Income</Text> up to 5 levels deep.
        </Text>

        <View style={styles.refBox}>
          <Text style={styles.refLinkText} numberOfLines={1}>
            {stats.referral_link}
          </Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => copyText('Referral Link', stats.referral_link)}
            activeOpacity={0.7}
          >
            <Feather name="copy" size={11} color="#030507" style={{ marginRight: 3 }} />
            <Text style={styles.copyBtnText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.refMetaRow}>
          <Text style={styles.refMetaItem}>
            Direct Downlines: <Text style={{ color: colors.textMain, fontWeight: '700' }}>{stats.direct_team} Users</Text>
          </Text>
          <Text style={styles.refMetaItem}>
            Unlocked Levels: <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Level {stats.active_level}</Text>
          </Text>
        </View>
      </View>

      {/* Recent Ledger Activity Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>TRANSACTIONS</Text>
            <Text style={styles.cardTitle}>Recent Wallet Ledger</Text>
          </View>
          <TouchableOpacity
            style={styles.btnSmSecondary}
            onPress={() => onNavigate && onNavigate('wallet')}
            activeOpacity={0.7}
          >
            <Text style={styles.btnSmSecondaryText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentLedger.slice(0, 5).map((item, idx) => {
          const isCredit = item.transaction_type === 'CREDIT';
          return (
            <View key={item.id || idx} style={styles.ledgerRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.ledgerCategory}>{item.category}</Text>
                  <Text style={styles.ledgerDate}>{item.created_at || 'Recent'}</Text>
                </View>
                <Text style={styles.ledgerDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.ledgerAmount,
                    { color: isCredit ? colors.accentGreenSoft : colors.accentDanger },
                  ]}
                >
                  {isCredit ? '+' : '-'}${Number(item.amount).toFixed(2)}
                </Text>
                <Text style={styles.ledgerBalanceAfter}>
                  Bal: ${Number(item.balance_after || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          );
        })}
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
    paddingBottom: 36,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1.2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  topActionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSmPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnSmPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 12,
  },
  btnSmSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  btnSmSecondaryText: {
    color: colors.textMain,
    fontWeight: '600',
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  invItem: {
    marginBottom: 14,
  },
  invTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  invPlanName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
  },
  invReturnCap: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  invSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  invMeta: {
    fontSize: 10,
    color: colors.textDim,
  },
  invStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentGreenSoft,
  },
  refExplainer: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  refBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  refLinkText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMain,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#030507',
  },
  refMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  refMetaItem: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  ledgerCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
  },
  ledgerDate: {
    fontSize: 10,
    color: colors.textDim,
  },
  ledgerDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerBalanceAfter: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
});
