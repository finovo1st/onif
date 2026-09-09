import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall, APP_DOMAIN } from '../config/api';
import colors from '../theme/colors';
import { copyToClipboard } from '../utils/clipboard';

export default function DashboardScreen({ onNavigate }) {
  const { user } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Consolidated Dashboard Stats State (Matching Web Portal)
  const [stats, setStats] = useState({
    wallet_balance: 0.0,
    total_deposited: 0.0,
    total_withdrawn: 0.0,
    active_investments_amount: 0.0,
    total_roi_earned: 0.0,
    total_direct_income: 0.0,
    total_referral_income: 0.0,
    direct_team: 0,
    active_level: 0,
    is_commission_bypassed: false,
    referral_code: '',
    referral_link: '',
  });

  const [activeInvestments, setActiveInvestments] = useState([]);
  const [recentLedger, setRecentLedger] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      // Parallel API calls matching web frontend loadAllAPIData()
      const [overviewData, investmentsData, ledgerData] = await Promise.all([
        apiCall('/dashboard/').catch(() => null),
        apiCall('/investments/').catch(() => []),
        apiCall('/wallet/transactions/').catch(() => []),
      ]);

      const rawInvestments = Array.isArray(investmentsData)
        ? investmentsData
        : (investmentsData?.results || []);

      const rawLedger = Array.isArray(ledgerData)
        ? ledgerData
        : (ledgerData?.results || []);

      // Calculate active investment total (sum of active investments amounts, matching web portal)
      const activeInvestSum = rawInvestments
        .filter((i) => i.status === 'ACTIVE')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const refCode = overviewData?.referral_code || user?.referral_code || '';
      const refLink =
        overviewData?.referral_link ||
        (refCode ? `${APP_DOMAIN}/app.html#register?ref=${refCode}` : '');

      if (overviewData) {
        setStats({
          wallet_balance: Number(overviewData.wallet_balance || 0),
          total_deposited: Number(overviewData.total_deposited || 0),
          total_withdrawn: Number(overviewData.total_withdrawn || 0),
          active_investments_amount:
            activeInvestSum > 0 ? activeInvestSum : Number(overviewData.total_invested || 0),
          total_roi_earned: Number(overviewData.total_roi_earned || 0),
          total_direct_income: Number(overviewData.total_direct_income || 0),
          total_referral_income: Number(overviewData.total_referral_income || 0),
          direct_team: overviewData.direct_team !== undefined ? overviewData.direct_team : (overviewData.total_team || 0),
          active_level: overviewData.active_level !== undefined ? overviewData.active_level : (user?.active_level || 0),
          is_commission_bypassed: Boolean(
            overviewData.is_commission_bypassed ||
            overviewData.bypass_plan_and_level_requirements ||
            user?.is_commission_bypassed ||
            user?.bypass_plan_and_level_requirements
          ),
          referral_code: refCode,
          referral_link: refLink,
        });
      }

      setActiveInvestments(rawInvestments);
      setRecentLedger(rawLedger);
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const copyText = async (label, text) => {
    if (!text) return;
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
    await copyToClipboard(text, label, true);
  };

  const activeItems = activeInvestments.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'PENDING' || i.status === 'DEPOSIT_PENDING'
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* Page Header */}
      <View style={styles.actionHeader}>
        <Text style={styles.eyebrow}>PORTFOLIO OVERVIEW</Text>
        <Text style={styles.pageTitle}>Dashboard</Text>
      </View>

      {/* 5-Metric Cards Grid (Matching Web Portal Stat Cards) */}
      <View style={styles.metricGrid}>
        {/* Row 1: Wallet Balance & Active Investments */}
        <View style={styles.metricRow}>
          {/* 1. Wallet Balance */}
          <View style={styles.statCard}>
            <View style={styles.statTextCol}>
              <Text style={styles.statLabel} numberOfLines={1}>WALLET BALANCE</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                ${Number(stats.wallet_balance).toFixed(2)}
              </Text>
              <Text style={styles.statSub} numberOfLines={1}>Available Liquidity</Text>
            </View>
            <View style={styles.statIconBadge}>
              <Feather name="credit-card" size={16} color={colors.goldSoft} />
            </View>
          </View>

          {/* 2. Active Investments */}
          <View style={styles.statCard}>
            <View style={styles.statTextCol}>
              <Text style={styles.statLabel} numberOfLines={1}>ACTIVE INVESTMENTS</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                ${Number(stats.active_investments_amount).toFixed(2)}
              </Text>
              <Text style={styles.statSub} numberOfLines={1}>
                {activeItems.filter((i) => i.status === 'ACTIVE').length} Active Plan(s)
              </Text>
            </View>
            <View style={styles.statIconBadge}>
              <Feather name="activity" size={16} color={colors.goldSoft} />
            </View>
          </View>
        </View>

        {/* Row 2: Total ROI Earned & Direct Referral Income */}
        <View style={styles.metricRow}>
          {/* 3. Total ROI Earned */}
          <View style={styles.statCard}>
            <View style={styles.statTextCol}>
              <Text style={styles.statLabel} numberOfLines={1}>TOTAL ROI EARNED</Text>
              <Text style={[styles.statValue, { color: colors.accentGreenSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                +${Number(stats.total_roi_earned).toFixed(2)}
              </Text>
              <Text style={styles.statSub} numberOfLines={1}>Weekly Passive Yield</Text>
            </View>
            <View style={styles.statIconBadge}>
              <Feather name="dollar-sign" size={16} color={colors.accentGreenSoft} />
            </View>
          </View>

          {/* 4. Direct Referral Income */}
          <View style={styles.statCard}>
            <View style={styles.statTextCol}>
              <Text style={styles.statLabel} numberOfLines={1}>DIRECT REFERRAL INCOME</Text>
              <Text style={[styles.statValue, { color: colors.goldSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                +${Number(stats.total_direct_income).toFixed(2)}
              </Text>
              <Text style={styles.statSub} numberOfLines={1}>Direct Sponsor Bonus</Text>
            </View>
            <View style={styles.statIconBadge}>
              <Feather name="users" size={16} color={colors.goldSoft} />
            </View>
          </View>
        </View>

        {/* 5. Total Referral ROI Income (Full Width Card matching Web) */}
        <View style={styles.statCardFull}>
          <View style={styles.statTextCol}>
            <Text style={styles.statLabel} numberOfLines={1}>TOTAL REFERRAL ROI INCOME</Text>
            <Text style={[styles.statValue, { color: colors.goldSoft }]} numberOfLines={1} adjustsFontSizeToFit>
              +${Number(stats.total_referral_income).toFixed(2)}
            </Text>
            <Text style={styles.statSub} numberOfLines={1}>5-Tier Network Referral ROI Returns</Text>
          </View>
          <View style={styles.statIconBadge}>
            <Feather name="award" size={17} color={colors.goldSoft} />
          </View>
        </View>
      </View>

      {/* Middle Content Section: Active Investments & Referral Code */}
      <View style={styles.middleSection}>
        {/* Active Investments Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.eyebrow}>PORTFOLIO</Text>
              <Text style={styles.cardTitle}>Active Investments</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.goldSoft} />
            </View>
          ) : activeItems.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyIconCircle}>
                <Feather name="trending-up" size={22} color={colors.goldSoft} />
              </View>
              <Text style={styles.emptyTitle}>No Active Investments</Text>
              <Text style={styles.emptyDesc}>
                Select an institutional yield plan to start earning up to 5.0% weekly ROI.
              </Text>
              <TouchableOpacity
                style={styles.btnEmptyAction}
                onPress={() => onNavigate && onNavigate('investments')}
                activeOpacity={0.8}
              >
                <Text style={styles.btnEmptyActionText}>+ Choose Plan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeItems.map((inv, idx) => {
              const credited = Number(inv.total_credited || 0);
              const maxRet = Number(inv.max_return || Number(inv.amount || 0) * 3);
              const pct = maxRet > 0 ? Math.min(100, (credited / maxRet) * 100) : 0;
              const isPending =
                inv.status === 'PENDING' || inv.status === 'DEPOSIT_PENDING';

              return (
                <View key={inv.id || idx} style={styles.invItem}>
                  <View style={styles.invTopRow}>
                    <Text style={styles.invPlanName} numberOfLines={1}>
                      {inv.plan_name || 'Trading Plan'} (${Number(inv.amount || 0).toFixed(2)})
                    </Text>
                    <View>
                      {isPending ? (
                        <View style={styles.badgePending}>
                          <Text style={styles.badgePendingText}>PENDING APPROVAL</Text>
                        </View>
                      ) : (
                        <Text style={styles.invReturnCap}>
                          ${credited.toFixed(2)} / ${maxRet.toFixed(2)}{' '}
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                            ({pct.toFixed(0)}%)
                          </Text>
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                  </View>

                  <View style={styles.invSubRow}>
                    <Text style={styles.invMeta}>
                      300% Cap Limit • Trading Capital: $
                      {Number(inv.trading_capital || inv.amount || 0).toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.invStatus,
                        {
                          color: isPending
                            ? colors.accentWarning
                            : colors.accentGreenSoft,
                        },
                      ]}
                    >
                      {isPending ? 'PENDING' : 'ACTIVE'}
                    </Text>
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
            Share your link to earn{' '}
            <Text style={{ color: colors.textMain, fontWeight: '700' }}>Direct Commission</Text>{' '}
            credited to your oldest active plan +{' '}
            <Text style={{ color: colors.textMain, fontWeight: '700' }}>
              Weekly ROI Level Income
            </Text>{' '}
            up to 5 levels deep. Commission income fills and accelerates your investment plan toward
            max return.
          </Text>

          {/* Referral Link Box */}
          <View style={styles.refBox}>
            <Text style={styles.refLinkText} numberOfLines={1}>
              {stats.referral_link || `${APP_DOMAIN}/app.html#register?ref=${stats.referral_code}`}
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() =>
                copyText(
                  'Referral Link',
                  stats.referral_link || `${APP_DOMAIN}/app.html#register?ref=${stats.referral_code}`
                )
              }
              activeOpacity={0.7}
            >
              <Feather name="copy" size={11} color="#030507" style={{ marginRight: 3 }} />
              <Text style={styles.copyBtnText}>
                {copyFeedback === 'Referral Link' ? 'Copied!' : 'Copy Link'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Referral Code Quick Chip */}
          {stats.referral_code ? (
            <View style={styles.refCodeChipRow}>
              <View style={styles.refCodeBadge}>
                <Text style={styles.refCodeBadgeLabel}>CODE:</Text>
                <Text style={styles.refCodeBadgeValue}>{stats.referral_code}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyCodeChipBtn}
                onPress={() => copyText('Referral Code', stats.referral_code)}
                activeOpacity={0.7}
              >
                <Feather name="copy" size={10} color={colors.goldSoft} style={{ marginRight: 3 }} />
                <Text style={styles.copyCodeChipText}>
                  {copyFeedback === 'Referral Code' ? 'Copied' : 'Copy Code'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Privilege Badge if Bypassed */}
          {stats.is_commission_bypassed && (
            <View style={styles.unlimitedBadge}>
              <Feather name="zap" size={11} color={colors.goldSoft} style={{ marginRight: 4 }} />
              <Text style={styles.unlimitedBadgeText}>
                UNLIMITED EARNER (ALL 5 LEVELS UNLOCKED)
              </Text>
            </View>
          )}

          <View style={styles.refMetaRow}>
            <Text style={styles.refMetaItem}>
              Direct Downlines:{' '}
              <Text style={{ color: colors.textMain, fontWeight: '700' }}>
                {stats.direct_team} Members
              </Text>
            </Text>
            <Text style={styles.refMetaItem}>
              Unlocked Levels:{' '}
              <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>
                Level {stats.active_level} of 5
              </Text>
            </Text>
          </View>
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
            <Text style={styles.btnSmSecondaryText}>View All Ledger</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.goldSoft} />
          </View>
        ) : recentLedger.length === 0 ? (
          <View style={styles.emptyLedgerBox}>
            <Text style={styles.emptyLedgerTitle}>No Recent Ledger Activity</Text>
            <Text style={styles.emptyLedgerDesc}>
              All deposits, ROI payouts, direct bonuses, and withdrawals will record here.
            </Text>
          </View>
        ) : (
          recentLedger.slice(0, 6).map((item, idx) => {
            const isCredit =
              item.transaction_type === 'CREDIT' || item.type === 'CREDIT';
            const cat = item.category || item.type || 'TRANSACTION';
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleDateString()
              : 'Recent';

            return (
              <View key={item.id || idx} style={styles.ledgerRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <View
                      style={[
                        styles.ledgerTypeBadge,
                        {
                          backgroundColor: isCredit
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                          borderColor: isCredit
                            ? 'rgba(16, 185, 129, 0.35)'
                            : 'rgba(239, 68, 68, 0.35)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ledgerTypeBadgeText,
                          {
                            color: isCredit
                              ? colors.accentGreenSoft
                              : colors.accentDanger,
                          },
                        ]}
                      >
                        {isCredit ? 'CREDIT' : 'DEBIT'}
                      </Text>
                    </View>
                    <Text style={styles.ledgerCategory}>{cat}</Text>
                    <Text style={styles.ledgerDate}>• {dateStr}</Text>
                  </View>
                  <Text style={styles.ledgerDesc} numberOfLines={1}>
                    {item.description || 'Wallet transaction'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      { color: isCredit ? colors.accentGreenSoft : colors.accentDanger },
                    ]}
                  >
                    {isCredit ? '+' : '-'}${Number(item.amount || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.ledgerBalanceAfter}>
                    Bal: ${Number(item.balance_after || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
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
  actionHeader: {
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
    gap: 10,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 74,
  },
  statCardFull: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 74,
  },
  statTextCol: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  statSub: {
    fontSize: 9.5,
    color: colors.textDim,
    marginTop: 2,
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
    flexShrink: 0,
  },
  middleSection: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
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
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(198, 153, 61, 0.1)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
    marginBottom: 12,
  },
  btnEmptyAction: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnEmptyActionText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 12,
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
    flex: 1,
    paddingRight: 6,
  },
  invReturnCap: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentWarning,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgePendingText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accentWarning,
    letterSpacing: 0.4,
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
    fontSize: 11.5,
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
  refCodeChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  refCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refCodeBadgeLabel: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '700',
  },
  refCodeBadgeValue: {
    fontSize: 12,
    color: colors.goldSoft,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  copyCodeChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(198, 153, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.25)',
  },
  copyCodeChipText: {
    fontSize: 10,
    color: colors.goldSoft,
    fontWeight: '700',
  },
  unlimitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  unlimitedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentGreenSoft,
    letterSpacing: 0.4,
  },
  refMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  refMetaItem: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  emptyLedgerBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyLedgerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 2,
  },
  emptyLedgerDesc: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 270,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  ledgerTypeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
  },
  ledgerTypeBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ledgerCategory: {
    fontSize: 11.5,
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
    marginTop: 1,
  },
  ledgerAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  ledgerBalanceAfter: {
    fontSize: 9.5,
    color: colors.textDim,
    marginTop: 1,
  },
});
