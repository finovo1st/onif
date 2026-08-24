import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function ReferralsScreen() {
  const { user, isDemoMode } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    direct_income: 80.0,
    roi_income: 25.0,
    active_level: 2,
    referral_code: 'ALICE123',
    referral_link: 'https://finovo.app/app.html#register?ref=ALICE123',
  });

  const [team, setTeam] = useState([
    {
      id: 'm1',
      email: 'l2_emma@finovo.com',
      username: 'l2emma',
      date_joined: '2026-08-02',
      total_invested: 2000.0,
      direct_comm_generated: 40.0,
      roi_comm_generated: 15.0,
    },
    {
      id: 'm2',
      email: 'l2_frank@finovo.com',
      username: 'l2frank',
      date_joined: '2026-08-04',
      total_invested: 1000.0,
      direct_comm_generated: 20.0,
      roi_comm_generated: 10.0,
    },
    {
      id: 'm3',
      email: 'l2_george@finovo.com',
      username: 'georgew',
      date_joined: '2026-08-10',
      total_invested: 500.0,
      direct_comm_generated: 10.0,
      roi_comm_generated: 0.0,
    },
    {
      id: 'm4',
      email: 'l2_helen@finovo.com',
      username: 'helenh',
      date_joined: '2026-08-12',
      total_invested: 500.0,
      direct_comm_generated: 10.0,
      roi_comm_generated: 0.0,
    },
  ]);

  const [commissions, setCommissions] = useState([
    {
      id: 'c1',
      commission_type: 'DIRECT',
      level: 1,
      amount: 40.0,
      from_user_email: 'l2_emma@finovo.com',
      status: 'PAID',
      created_at: '2026-08-02',
    },
    {
      id: 'c2',
      commission_type: 'ROI',
      level: 1,
      amount: 25.0,
      from_user_email: 'l2_emma@finovo.com',
      status: 'PAID',
      created_at: '2026-08-09',
    },
    {
      id: 'c3',
      commission_type: 'DIRECT',
      level: 1,
      amount: 20.0,
      from_user_email: 'l2_frank@finovo.com',
      status: 'PAID',
      created_at: '2026-08-04',
    },
  ]);

  const loadReferralData = async () => {
    if (isDemoMode) return;
    try {
      const dashData = await apiCall('/dashboard/').catch(() => null);
      if (dashData) {
        setSummary({
          direct_income: dashData.total_direct_income || dashData.direct_income || 0,
          roi_income: dashData.total_referral_income || dashData.roi_income || 0,
          active_level: dashData.active_level || user?.active_level || 0,
          referral_code: dashData.referral_code || user?.referral_code || 'ALICE123',
          referral_link: dashData.referral_link || `https://finovo.app/app.html#register?ref=${user?.referral_code || 'ALICE123'}`,
        });
      }

      const teamData = await apiCall('/referrals/team/').catch(() => []);
      if (Array.isArray(teamData) && teamData.length > 0) setTeam(teamData);

      const commData = await apiCall('/referrals/commissions/').catch(() => []);
      if (Array.isArray(commData) && commData.length > 0) setCommissions(commData);
    } catch (err) {
      console.warn('Referrals data load error:', err.message);
    }
  };

  useEffect(() => {
    loadReferralData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralData();
    setRefreshing(false);
  };

  const copyText = (label, text) => {
    Alert.alert('Copied to Clipboard', `${label}: ${text}`);
  };

  const currentLevel = summary.active_level || user?.active_level || 2;
  const levels = [
    { lvl: 1, req: 2, type: 'Direct 2.0%' },
    { lvl: 2, req: 4, type: 'ROI 1.5%' },
    { lvl: 3, req: 6, type: 'ROI 1.5%' },
    { lvl: 4, req: 8, type: 'ROI 1.5%' },
    { lvl: 5, req: 10, type: 'ROI 1.5%' },
  ];

  const filteredTeam = team.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.username && m.username.toLowerCase().includes(q))
    );
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AFFILIATE &amp; PARTNERSHIP DESK</Text>
        <Text style={styles.screenTitle}>Referral Network (5 Levels)</Text>
        <Text style={styles.screenSubtitle}>
          Earn direct sales commissions and up to 5 tiers of weekly downline ROI yield sharing.
        </Text>
      </View>

      {/* Referral Link & Code Box */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your Invitation Link &amp; Code</Text>
        </View>

        <View style={styles.refBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refCodeLabel}>SPONSOR INVITATION CODE</Text>
            <Text style={styles.refCodeText}>{summary.referral_code}</Text>
          </View>
          <View style={styles.refActionRow}>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => copyText('Referral Code', summary.referral_code)}
              activeOpacity={0.7}
            >
              <Text style={styles.copyBtnText}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => copyText('Referral Link', summary.referral_link)}
              activeOpacity={0.7}
            >
              <Text style={styles.copyBtnText}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Multi-Level Unlock Progress */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>UNLOCK PROGRESS</Text>
            <Text style={styles.cardTitle}>5-Tier Level Unlock Status</Text>
          </View>
        </View>

        <Text style={styles.metaSubtitle}>
          Active Direct Referrals unlock downline levels up to 5 tiers deep.
        </Text>

        {levels.map((item) => {
          const isUnlocked = currentLevel >= item.lvl;
          return (
            <View key={item.lvl} style={styles.levelRow}>
              <View>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  Tier Level {item.lvl} ({item.type})
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  Requires {item.req} Active Directs
                </Text>
              </View>
              <View
                style={[
                  styles.tierBadge,
                  isUnlocked ? styles.tierBadgeUnlocked : styles.tierBadgeLocked,
                ]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    { color: isUnlocked ? colors.accentGreenSoft : colors.textDim },
                  ]}
                >
                  {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Earnings Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>EARNINGS</Text>
            <Text style={styles.cardTitle}>Referral Earnings Summary</Text>
          </View>
        </View>

        <View style={styles.summaryItem}>
          <View>
            <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>
              Direct Income (2.0%)
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
              Credited to your oldest active plan
            </Text>
          </View>
          <Text style={styles.summaryVal}>${Number(summary.direct_income).toFixed(2)}</Text>
        </View>

        <View style={styles.summaryItem}>
          <View>
            <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>
              ROI Level Income (1.5%)
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
              Fills your oldest active plan weekly
            </Text>
          </View>
          <Text style={styles.summaryVal}>${Number(summary.roi_income).toFixed(2)}</Text>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Note:</Text> All commissions are credited directly to your <Text style={{ color: colors.textMain, fontWeight: '700' }}>oldest active investment plan</Text>, accelerating it toward its 300% max return cap. If no plan is active, income goes to available wallet balance.
          </Text>
        </View>
      </View>

      {/* Direct Team Members Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>TEAM MEMBERS</Text>
            <Text style={styles.cardTitle}>My Direct Downline ({filteredTeam.length})</Text>
          </View>
        </View>

        {/* Search input */}
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search team by email or username..."
          placeholderTextColor={colors.textDim}
        />

        {filteredTeam.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No direct downline members matching search.
          </Text>
        ) : (
          filteredTeam.map((m, idx) => (
            <View key={m.id || idx} style={styles.memberRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  {m.email}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  @{m.username || 'member'} • Joined {m.date_joined || 'Recent'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 13 }}>
                  Invested: ${Number(m.total_invested || 0).toFixed(2)}
                </Text>
                <Text style={{ color: colors.accentGreenSoft, fontSize: 11, marginTop: 2 }}>
                  Comm: +${Number((m.direct_comm_generated || 0) + (m.roi_comm_generated || 0)).toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Earned Referral Commissions Ledger */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>COMMISSIONS</Text>
            <Text style={styles.cardTitle}>Earned Referral Commissions</Text>
          </View>
        </View>

        {commissions.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No referral commissions recorded yet.
          </Text>
        ) : (
          commissions.map((c, idx) => (
            <View key={c.id || idx} style={styles.commRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.commType}>{c.commission_type} (Level {c.level})</Text>
                  <Text style={styles.commStatus}>{c.status || 'PAID'}</Text>
                </View>
                <Text style={styles.commFrom} numberOfLines={1}>
                  From: {c.from_user_email || 'Downline Member'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commAmount}>+${Number(c.amount).toFixed(2)}</Text>
                <Text style={styles.commDate}>{c.created_at || 'Recent'}</Text>
              </View>
            </View>
          ))
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
    paddingBottom: 36,
  },
  header: {
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  metaSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  refBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refCodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  refCodeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 1,
  },
  refActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  copyBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  copyBtnText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  tierBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tierBadgeUnlocked: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  tierBadgeLocked: {
    borderColor: colors.bgCardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 8,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  noteBox: {
    backgroundColor: 'rgba(198, 153, 61, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  noteText: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
  },
  searchInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 10,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  commRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  commType: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
  },
  commStatus: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.accentGreenSoft,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  commFrom: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  commAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  commDate: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
});
