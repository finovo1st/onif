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
import { apiCall, APP_DOMAIN } from '../config/api';
import colors from '../theme/colors';

export default function ReferralsScreen() {
  const { user } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    direct_income: 0.0,
    roi_income: 0.0,
    active_level: 0,
    referral_code: '',
    referral_link: '',
  });

  const [team, setTeam] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [levelStats, setLevelStats] = useState([]);

  const loadReferralData = async () => {
    try {
      const dashData = await apiCall('/dashboard/').catch(() => null);
      const refCode = dashData?.referral_code || user?.referral_code || '';
      const refLink = dashData?.referral_link || (refCode ? `${APP_DOMAIN}/app.html#register?ref=${refCode}` : '');
      if (dashData) {
        setSummary({
          direct_income: dashData.total_direct_income || dashData.direct_income || 0,
          roi_income: dashData.total_referral_income || dashData.roi_income || 0,
          active_level: dashData.active_level || user?.active_level || 0,
          referral_code: refCode,
          referral_link: refLink,
        });
      }

      const teamData = await apiCall('/referrals/team/').catch(() => []);
      const teamList = Array.isArray(teamData) ? teamData : (teamData?.results || []);
      setTeam(teamList);

      const commData = await apiCall('/referrals/commissions/').catch(() => []);
      const commList = Array.isArray(commData) ? commData : (commData?.results || []);
      setCommissions(commList);

      const levelsData = await apiCall('/referrals/levels/').catch(() => []);
      const levelsList = Array.isArray(levelsData) ? levelsData : (levelsData?.results || []);
      setLevelStats(levelsList);
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

  const currentDirLevel = summary.active_level || user?.active_level || 0;
  const currentRoiLevel = summary.active_roi_level || user?.active_roi_level || 0;
  const defaultLevels = [
    { lvl: 1, dirReq: 0, roiReq: 2 },
    { lvl: 2, dirReq: 2, roiReq: 4 },
    { lvl: 3, dirReq: 4, roiReq: 6 },
    { lvl: 4, dirReq: 6, roiReq: 8 },
    { lvl: 5, dirReq: 8, roiReq: 10 },
  ];

  const levelsToRender = levelStats.length > 0
    ? levelStats.map(s => ({
      lvl: s.level,
      dirReq: s.dir_req !== undefined ? s.dir_req : (s.level === 1 ? 0 : (s.level - 1) * 2),
      roiReq: s.roi_req !== undefined ? s.roi_req : s.level * 2,
      isDirUnlocked: s.is_direct_unlocked !== undefined ? s.is_direct_unlocked : (currentDirLevel >= s.level),
      isRoiUnlocked: s.is_roi_unlocked !== undefined ? s.is_roi_unlocked : (currentRoiLevel >= s.level),
    }))
    : defaultLevels.map(item => ({
      ...item,
      isDirUnlocked: currentDirLevel >= item.lvl,
      isRoiUnlocked: currentRoiLevel >= item.lvl,
    }));

  const filteredTeam = team.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.username && m.username.toLowerCase().includes(q));
    const matchesLevel = selectedLevel === 'all' || String(m.level || 1) === String(selectedLevel);
    return matchesQuery && matchesLevel;
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
          Earn direct sales commissions (0, 2, 4, 6, 8 directs) and up to 5 tiers of weekly downline ROI yield (2, 4, 6, 8, 10 directs).
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

        {levelsToRender.map((item) => {
          const isDirUnlocked = item.isDirUnlocked;
          const isRoiUnlocked = item.isRoiUnlocked;
          return (
            <View key={item.lvl} style={styles.levelRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  Tier Level {item.lvl}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  Direct: {item.dirReq} Directs • ROI: {item.roiReq} Directs
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View
                  style={[
                    styles.tierBadge,
                    isDirUnlocked ? styles.tierBadgeUnlocked : styles.tierBadgeLocked,
                    { paddingHorizontal: 6, paddingVertical: 3 }
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      { color: isDirUnlocked ? colors.accentGreenSoft : colors.textDim, fontSize: 10 },
                    ]}
                  >
                    DIR {isDirUnlocked ? 'UNLOCKED' : 'LOCKED'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.tierBadge,
                    isRoiUnlocked ? styles.tierBadgeUnlocked : styles.tierBadgeLocked,
                    { paddingHorizontal: 6, paddingVertical: 3 }
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      { color: isRoiUnlocked ? colors.goldSoft : colors.textDim, fontSize: 10 },
                    ]}
                  >
                    ROI {isRoiUnlocked ? 'UNLOCKED' : 'LOCKED'}
                  </Text>
                </View>
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
              Direct Income
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
              ROI Level Income
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

      {/* Downline Team Members Table */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>TEAM NETWORK</Text>
            <Text style={styles.cardTitle}>My Downline Team ({filteredTeam.length})</Text>
          </View>
        </View>

        {/* Level Filter Horizontal Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {['all', '1', '2', '3', '4', '5'].map((lvl) => {
            const isSel = selectedLevel === lvl;
            const label = lvl === 'all' ? 'All Levels' : `Level ${lvl}`;
            return (
              <TouchableOpacity
                key={lvl}
                onPress={() => setSelectedLevel(lvl)}
                style={{
                  backgroundColor: isSel ? colors.goldSoft : 'rgba(255,255,255,0.06)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginRight: 6,
                }}
              >
                <Text
                  style={{
                    color: isSel ? '#000' : colors.textMain,
                    fontSize: 12,
                    fontWeight: isSel ? '700' : '500',
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
            No downline members found for this level/search.
          </Text>
        ) : (
          filteredTeam.map((m, idx) => (
            <View key={m.id || idx} style={styles.memberRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                    {m.email}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.goldSoft, backgroundColor: 'rgba(198,153,61,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                    L{m.level || 1}
                  </Text>
                </View>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  @{m.username || 'member'} • Sponsor: {m.sponsor_name || m.sponsor_email || (m.level === 1 ? 'Direct' : 'Sponsor')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 13 }}>
                  ${Number(m.investment_sum || m.total_invested || 0).toFixed(2)}
                </Text>
                <Text style={{ color: colors.accentGreenSoft, fontSize: 11, marginTop: 2 }}>
                  Comm: +${Number((m.direct_income_sum || m.direct_comm_generated || 0) + (m.roi_income_sum || m.roi_comm_generated || 0)).toFixed(2)}
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
