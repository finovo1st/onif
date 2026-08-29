import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function AdminScreen({ onNavigate }) {
  const { user, isDemoMode } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'funds' | 'deposits' | 'withdrawals' | 'users' | 'support' | 'rules'
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Overview / Metrics State
  const [metrics, setMetrics] = useState({
    vault_balance: 245800.0,
    pending_deposits_count: 2,
    pending_deposits_amount: 3500.0,
    pending_withdrawals_count: 1,
    pending_withdrawals_amount: 150.0,
    open_tickets_count: 1,
    total_users_count: 14,
  });

  // Company Wallets State
  const [companyWallets, setCompanyWallets] = useState({
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
  });

  // Adjust Funds State
  const [adjustType, setAdjustType] = useState('CREDIT');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Deposits & Investments State
  const [deposits, setDeposits] = useState([
    {
      id: 'dep-101',
      user_email: 'l2_emma@finovo.com',
      user_name: 'Emma Watson',
      plan_name: 'Pro Trader Tier',
      amount: 1000.0,
      network: 'BEP20',
      txn_hash: '0x71c82894ba9842104a...8902f',
      sender_address: '0xEmmaSenderWalletAddressBEP20',
      status: 'PENDING',
      created_at: '2026-08-20 14:20',
    },
    {
      id: 'dep-102',
      user_email: 'l2_frank@finovo.com',
      user_name: 'Frank Ocean',
      plan_name: 'Elite Institutional',
      amount: 5000.0,
      network: 'TRC20',
      txn_hash: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9tx',
      sender_address: 'TYDSenderFrankWalletTRC20',
      status: 'PENDING',
      created_at: '2026-08-20 15:45',
    },
  ]);
  const [depositFilter, setDepositFilter] = useState('ALL');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [rejectDepModalVisible, setRejectDepModalVisible] = useState(false);
  const [depRejectReason, setDepRejectReason] = useState('');

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([
    {
      id: 'wdr-201',
      user_email: 'l1_alice@finovo.com',
      user_name: 'Alice Smith',
      withdrawal_type: 'PROFIT',
      amount: 150.0,
      fee: 1.0,
      net_amount: 149.0,
      network: 'BEP20',
      wallet_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      status: 'PENDING',
      created_at: '2026-08-20 16:10',
    },
  ]);
  const [withdrawalFilter, setWithdrawalFilter] = useState('ALL');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [approveWdrModalVisible, setApproveWdrModalVisible] = useState(false);
  const [wdrTxHash, setWdrTxHash] = useState('');
  const [rejectWdrModalVisible, setRejectWdrModalVisible] = useState(false);
  const [wdrRejectReason, setWdrRejectReason] = useState('');

  // Users Management State
  const [usersList, setUsersList] = useState([
    {
      id: 'u-1',
      email: 'l1_alice@finovo.com',
      username: 'alicesmith',
      first_name: 'Alice',
      last_name: 'Smith',
      wallet_balance: 1450.0,
      kyc_status: 'APPROVED',
      active_level: 2,
      role: 'investor',
      is_staff: false,
      direct_team_count: 4,
    },
    {
      id: 'u-2',
      email: 'l2_emma@finovo.com',
      username: 'l2emma',
      first_name: 'Emma',
      last_name: 'Watson',
      wallet_balance: 820.0,
      kyc_status: 'IN_REVIEW',
      active_level: 1,
      role: 'investor',
      is_staff: false,
      direct_team_count: 2,
    },
    {
      id: 'u-3',
      email: 'admin@finovo.com',
      username: 'superadmin',
      first_name: 'Platform',
      last_name: 'Administrator',
      wallet_balance: 99999.0,
      kyc_status: 'APPROVED',
      active_level: 5,
      role: 'admin',
      is_staff: true,
      direct_team_count: 10,
    },
  ]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [manageBalanceModalVisible, setManageBalanceModalVisible] = useState(false);
  const [userBalanceType, setUserBalanceType] = useState('CREDIT');
  const [userBalanceAmount, setUserBalanceAmount] = useState('');
  const [userBalanceReason, setUserBalanceReason] = useState('');
  const [userTeamModalVisible, setUserTeamModalVisible] = useState(false);

  // Support Desk State
  const [supportTickets, setSupportTickets] = useState([
    {
      id: 't-101',
      user_email: 'l2_emma@finovo.com',
      subject: 'Deposit Confirmation Assistance',
      category: 'DEPOSIT',
      status: 'OPEN',
      created_at: '2026-08-20 14:30',
      messages: [
        {
          id: 'm-1',
          sender_name: 'Emma Watson',
          is_staff: false,
          message: 'Hello, I submitted a deposit of $1000 USDT on BEP20 with hash 0x71c8...8902f. Can you confirm activation?',
          created_at: '2026-08-20 14:30',
        },
      ],
    },
  ]);
  const [supportFilter, setSupportFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [staffReplyText, setStaffReplyText] = useState('');
  const [ticketModalVisible, setTicketModalVisible] = useState(false);

  // ROI Engine Trigger Modal
  const [roiModalVisible, setRoiModalVisible] = useState(false);
  const [roiDay, setRoiDay] = useState('ALL');

  const loadAdminData = async () => {
    if (isDemoMode) return;
    try {
      const overview = await apiCall('/admin-panel/overview/').catch(() => null);
      if (overview) setMetrics(overview);

      const fetchedDeps = await apiCall('/admin-panel/investments/').catch(() => []);
      const depList = Array.isArray(fetchedDeps) ? fetchedDeps : (fetchedDeps?.results || []);
      if (depList.length > 0) setDeposits(depList);

      const fetchedWdrs = await apiCall('/admin-panel/withdrawals/').catch(() => []);
      const wdrList = Array.isArray(fetchedWdrs) ? fetchedWdrs : (fetchedWdrs?.results || []);
      if (wdrList.length > 0) setWithdrawals(wdrList);

      const fetchedUsers = await apiCall('/admin-panel/users/').catch(() => []);
      const userList = Array.isArray(fetchedUsers) ? fetchedUsers : (fetchedUsers?.results || []);
      if (userList.length > 0) setUsersList(userList);

      const fetchedTickets = await apiCall('/admin-panel/tickets/').catch(() => []);
      const ticketList = Array.isArray(fetchedTickets) ? fetchedTickets : (fetchedTickets?.results || []);
      if (ticketList.length > 0) setSupportTickets(ticketList);
    } catch (err) {
      console.warn('Admin load error:', err.message);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  // Deposit Actions
  const handleApproveDeposit = async (dep) => {
    Alert.alert(
      'Approve Deposit Proof',
      `Confirm approval of $${Number(dep.amount).toFixed(2)} USDT for ${dep.user_email}? This will activate their investment plan and distribute upline commissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Activate',
          onPress: async () => {
            setLoading(true);
            try {
              if (!isDemoMode) {
                await apiCall(`/admin-panel/investments/${dep.id}/approve/`, 'POST');
              }
              setDeposits((prev) =>
                prev.map((d) => (d.id === dep.id ? { ...d, status: 'APPROVED' } : d))
              );
              Alert.alert('Deposit Approved', `Deposit #${dep.id} has been approved and activated.`);
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectDepositSubmit = async () => {
    if (!depRejectReason) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      if (!isDemoMode && selectedDeposit) {
        await apiCall(`/admin-panel/investments/${selectedDeposit.id}/reject/`, 'POST', {
          reason: depRejectReason,
        });
      }
      setDeposits((prev) =>
        prev.map((d) => (d.id === selectedDeposit.id ? { ...d, status: 'REJECTED' } : d))
      );
      setRejectDepModalVisible(false);
      Alert.alert('Deposit Rejected', `Deposit #${selectedDeposit.id} marked as rejected.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Withdrawal Actions
  const handleApproveWithdrawalSubmit = async () => {
    if (!wdrTxHash) {
      Alert.alert('Validation Error', 'Please enter the blockchain payout transaction hash (TxID).');
      return;
    }
    setLoading(true);
    try {
      if (!isDemoMode && selectedWithdrawal) {
        await apiCall(`/admin-panel/withdrawals/${selectedWithdrawal.id}/approve/`, 'POST', {
          txn_hash: wdrTxHash,
          payout_txn_hash: wdrTxHash,
        });
      }
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === selectedWithdrawal.id ? { ...w, status: 'COMPLETED' } : w))
      );
      setApproveWdrModalVisible(false);
      Alert.alert('Withdrawal Processed', `Withdrawal #${selectedWithdrawal.id} marked as completed.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithdrawalSubmit = async () => {
    if (!wdrRejectReason) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      if (!isDemoMode && selectedWithdrawal) {
        await apiCall(`/admin-panel/withdrawals/${selectedWithdrawal.id}/reject/`, 'POST', {
          reason: wdrRejectReason,
        });
      }
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === selectedWithdrawal.id ? { ...w, status: 'REJECTED' } : w))
      );
      setRejectWdrModalVisible(false);
      Alert.alert('Withdrawal Rejected', `Withdrawal #${selectedWithdrawal.id} rejected and refunded.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Adjust User Balance
  const handleUserBalanceSubmit = async () => {
    const amt = Number(userBalanceAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }
    setLoading(true);
    try {
      if (!isDemoMode && selectedUser) {
        await apiCall(`/admin-panel/users/${selectedUser.id}/adjust-balance/`, 'POST', {
          action: userBalanceType,
          amount: amt,
          reason: userBalanceReason || 'Admin adjustment',
        });
      }
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.id === selectedUser.id) {
            const newBal =
              userBalanceType === 'CREDIT'
                ? u.wallet_balance + amt
                : Math.max(0, u.wallet_balance - amt);
            return { ...u, wallet_balance: newBal };
          }
          return u;
        })
      );
      setManageBalanceModalVisible(false);
      Alert.alert('Balance Updated', `${userBalanceType} of $${amt.toFixed(2)} USDT applied to ${selectedUser.email}.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger ROI Engine
  const handleTriggerROI = async () => {
    Alert.alert(
      'Trigger ROI Calculation Engine',
      `Execute automated weekly ROI distribution for ${roiDay === 'ALL' ? 'the entire week' : roiDay}? This will calculate ROI yields and distribute multi-level referral commissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute ROI Run',
          onPress: async () => {
            setLoading(true);
            try {
              if (!isDemoMode) {
                await apiCall('/admin-panel/trigger-roi/', 'POST', { day: roiDay });
              }
              setRoiModalVisible(false);
              Alert.alert('ROI Engine Complete', 'Weekly ROI yield calculation and 5-level referral distribution executed successfully.');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  // Staff Ticket Reply
  const handleStaffReplySubmit = async (newStatus = null) => {
    if (!staffReplyText) {
      Alert.alert('Validation Error', 'Please enter a reply message.');
      return;
    }
    setLoading(true);
    try {
      if (!isDemoMode && selectedTicket) {
        await apiCall(`/admin-panel/tickets/${selectedTicket.id}/reply/`, 'POST', {
          message: staffReplyText,
          status: newStatus || selectedTicket.status,
        });
      }
      setStaffReplyText('');
      setTicketModalVisible(false);
      Alert.alert('Reply Dispatched', 'Staff response sent to the user.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists
  const filteredDeposits = deposits.filter((d) => {
    if (depositFilter === 'PENDING') return d.status === 'PENDING';
    if (depositFilter === 'APPROVED') return d.status === 'APPROVED';
    if (depositFilter === 'REJECTED') return d.status === 'REJECTED';
    return true;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === 'PENDING') return w.status === 'PENDING';
    if (withdrawalFilter === 'COMPLETED') return w.status === 'COMPLETED';
    if (withdrawalFilter === 'REJECTED') return w.status === 'REJECTED';
    return true;
  });

  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return (
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q))
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
      {/* Admin Header Strip */}
      <View style={styles.adminHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.adminBadgeRow}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN CONTROL CONSOLE</Text>
            </View>
            <Text style={styles.adminRoleText}>Superuser Access</Text>
          </View>
          <Text style={styles.screenTitle}>Platform Governance</Text>
        </View>
      </View>

      {/* Admin Navigation Pills Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.navStrip}
        contentContainerStyle={styles.navStripContent}
      >
        {[
          { id: 'overview', label: 'Overview', icon: 'grid' },
          { id: 'funds', label: 'Company Funds', icon: 'dollar-sign' },
          { id: 'deposits', label: 'Investments & Deposits', icon: 'arrow-down-circle' },
          { id: 'withdrawals', label: 'Withdrawals Queue', icon: 'arrow-up-circle' },
          { id: 'users', label: 'Users Management', icon: 'users' },
          { id: 'support', label: 'Support Desk', icon: 'message-square' },
          { id: 'rules', label: 'Rules & ROI Engine', icon: 'cpu' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.navPill, activeTab === tab.id && styles.navPillActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon}
              size={13}
              color={activeTab === tab.id ? colors.goldSoft : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.navPillText, activeTab === tab.id && styles.navPillTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 1. OVERVIEW (COMMAND CENTER) */}
      {activeTab === 'overview' && (
        <View>
          <View style={styles.metricGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TREASURY VAULT</Text>
              <Text style={[styles.statValue, { color: colors.goldSoft }]}>
                ${Number(metrics.vault_balance).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>USDT Segregated</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PENDING DEPOSITS</Text>
              <Text style={[styles.statValue, { color: colors.accentWarning }]}>
                {metrics.pending_deposits_count} requests
              </Text>
              <Text style={styles.statSub}>${Number(metrics.pending_deposits_amount).toFixed(2)} USDT</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PENDING WITHDRAWALS</Text>
              <Text style={[styles.statValue, { color: colors.accentDanger }]}>
                {metrics.pending_withdrawals_count} requests
              </Text>
              <Text style={styles.statSub}>${Number(metrics.pending_withdrawals_amount).toFixed(2)} USDT</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TOTAL INVESTORS</Text>
              <Text style={styles.statValue}>{metrics.total_users_count} accounts</Text>
              <Text style={styles.statSub}>{metrics.open_tickets_count} open tickets</Text>
            </View>
          </View>

          {/* Quick Actions Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>OPERATIONS</Text>
              <Text style={styles.cardTitle}>Quick Governance Actions</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setActiveTab('deposits')}
              >
                <Feather name="check-circle" size={15} color={colors.accentGreenSoft} />
                <Text style={styles.quickActionBtnText}>Review Deposits ({metrics.pending_deposits_count})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setActiveTab('withdrawals')}
              >
                <Feather name="send" size={15} color={colors.goldSoft} />
                <Text style={styles.quickActionBtnText}>Review Payouts ({metrics.pending_withdrawals_count})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setRoiModalVisible(true)}
              >
                <Feather name="play-circle" size={15} color={colors.goldSoft} />
                <Text style={styles.quickActionBtnText}>Trigger ROI Engine</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 2. COMPANY FUNDS (TREASURY MANAGEMENT) */}
      {activeTab === 'funds' && (
        <View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>TREASURY MANAGEMENT</Text>
              <Text style={styles.cardTitle}>Platform Liquidity Vault</Text>
            </View>

            <View style={styles.treasuryHero}>
              <Text style={styles.statLabel}>TOTAL VAULT BALANCE</Text>
              <Text style={styles.treasuryAmount}>${Number(metrics.vault_balance).toFixed(2)} USDT</Text>
              <Text style={styles.treasurySub}>
                Segregated liquidity pool for investor ROI payouts and capital withdrawals.
              </Text>
            </View>

            <Text style={styles.label}>Adjust Treasury Funds</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, adjustType === 'CREDIT' && styles.toggleBtnActive]}
                onPress={() => setAdjustType('CREDIT')}
              >
                <Text style={[styles.toggleBtnText, adjustType === 'CREDIT' && styles.toggleBtnTextActive]}>
                  + Credit Vault
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, adjustType === 'DEBIT' && styles.toggleBtnActive]}
                onPress={() => setAdjustType('DEBIT')}
              >
                <Text style={[styles.toggleBtnText, adjustType === 'DEBIT' && styles.toggleBtnTextActive]}>
                  - Debit Vault
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              keyboardType="numeric"
              placeholder="Amount in USDT (e.g. 10000.00)"
              placeholderTextColor={colors.textDim}
            />

            <TextInput
              style={styles.input}
              value={adjustReason}
              onChangeText={setAdjustReason}
              placeholder="Reason for adjustment (e.g. Trading arbitrage profit)"
              placeholderTextColor={colors.textDim}
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                const amt = Number(adjustAmount);
                if (!amt) return;
                setMetrics((prev) => ({
                  ...prev,
                  vault_balance:
                    adjustType === 'CREDIT'
                      ? prev.vault_balance + amt
                      : Math.max(0, prev.vault_balance - amt),
                }));
                setAdjustAmount('');
                setAdjustReason('');
                Alert.alert('Vault Updated', `Vault ${adjustType.toLowerCase()}ed by $${amt.toFixed(2)} USDT.`);
              }}
            >
              <Text style={styles.btnPrimaryText}>Execute Vault Adjustment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3. INVESTMENTS & DEPOSITS */}
      {activeTab === 'deposits' && (
        <View>
          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, depositFilter === f && styles.filterPillActive]}
                onPress={() => setDepositFilter(f)}
              >
                <Text style={[styles.filterPillText, depositFilter === f && styles.filterPillTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredDeposits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No deposits matching filter.</Text>
            </View>
          ) : (
            filteredDeposits.map((dep) => (
              <View key={dep.id} style={styles.dossierCard}>
                <View style={styles.dossierHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dossierUser}>{dep.user_name || dep.user_email}</Text>
                    <Text style={styles.dossierEmail}>{dep.user_email}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        borderColor:
                          dep.status === 'APPROVED'
                            ? colors.accentGreenSoft
                            : dep.status === 'PENDING'
                            ? colors.accentWarning
                            : colors.accentDanger,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            dep.status === 'APPROVED'
                              ? colors.accentGreenSoft
                              : dep.status === 'PENDING'
                              ? colors.accentWarning
                              : colors.accentDanger,
                        },
                      ]}
                    >
                      {dep.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.dossierGrid}>
                  <View style={styles.dossierItem}>
                    <Text style={styles.dossierLabel}>PLAN TIER</Text>
                    <Text style={styles.dossierVal}>{dep.plan_name}</Text>
                  </View>
                  <View style={styles.dossierItem}>
                    <Text style={styles.dossierLabel}>AMOUNT</Text>
                    <Text style={[styles.dossierVal, { color: colors.goldSoft }]}>
                      ${Number(dep.amount).toFixed(2)} USDT ({dep.network})
                    </Text>
                  </View>
                  <View style={styles.dossierItemFull}>
                    <Text style={styles.dossierLabel}>BLOCKCHAIN TXID HASH</Text>
                    <Text style={styles.dossierHash} numberOfLines={1}>
                      {dep.txn_hash}
                    </Text>
                  </View>
                  <View style={styles.dossierItemFull}>
                    <Text style={styles.dossierLabel}>SENDER ADDRESS</Text>
                    <Text style={styles.dossierHash} numberOfLines={1}>
                      {dep.sender_address || 'Not Provided'}
                    </Text>
                  </View>
                </View>

                {dep.status === 'PENDING' && (
                  <View style={styles.dossierBtnRow}>
                    <TouchableOpacity
                      style={styles.btnApprove}
                      onPress={() => handleApproveDeposit(dep)}
                    >
                      <Feather name="check" size={13} color="#030507" style={{ marginRight: 4 }} />
                      <Text style={styles.btnApproveText}>Approve &amp; Activate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnReject}
                      onPress={() => {
                        setSelectedDeposit(dep);
                        setDepRejectReason('');
                        setRejectDepModalVisible(true);
                      }}
                    >
                      <Feather name="x" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.btnRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* 4. WITHDRAWALS QUEUE */}
      {activeTab === 'withdrawals' && (
        <View>
          <View style={styles.filterRow}>
            {['ALL', 'PENDING', 'COMPLETED', 'REJECTED'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, withdrawalFilter === f && styles.filterPillActive]}
                onPress={() => setWithdrawalFilter(f)}
              >
                <Text style={[styles.filterPillText, withdrawalFilter === f && styles.filterPillTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredWithdrawals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No withdrawals matching filter.</Text>
            </View>
          ) : (
            filteredWithdrawals.map((wdr) => (
              <View key={wdr.id} style={styles.dossierCard}>
                <View style={styles.dossierHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dossierUser}>{wdr.user_name || wdr.user_email}</Text>
                    <Text style={styles.dossierEmail}>{wdr.user_email}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        borderColor:
                          wdr.status === 'COMPLETED'
                            ? colors.accentGreenSoft
                            : wdr.status === 'PENDING'
                            ? colors.accentWarning
                            : colors.accentDanger,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            wdr.status === 'COMPLETED'
                              ? colors.accentGreenSoft
                              : wdr.status === 'PENDING'
                              ? colors.accentWarning
                              : colors.accentDanger,
                        },
                      ]}
                    >
                      {wdr.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.dossierGrid}>
                  <View style={styles.dossierItem}>
                    <Text style={styles.dossierLabel}>TYPE</Text>
                    <Text style={styles.dossierVal}>{wdr.withdrawal_type}</Text>
                  </View>
                  <View style={styles.dossierItem}>
                    <Text style={styles.dossierLabel}>NET PAYOUT</Text>
                    <Text style={[styles.dossierVal, { color: colors.goldSoft }]}>
                      ${Number(wdr.net_amount || wdr.amount).toFixed(2)} USDT (Fee: ${Number(wdr.fee || 0).toFixed(2)})
                    </Text>
                  </View>
                  <View style={styles.dossierItemFull}>
                    <Text style={styles.dossierLabel}>DESTINATION WALLET ({wdr.network})</Text>
                    <Text style={styles.dossierHash} numberOfLines={1}>
                      {wdr.wallet_address}
                    </Text>
                  </View>
                </View>

                {wdr.status === 'PENDING' && (
                  <View style={styles.dossierBtnRow}>
                    <TouchableOpacity
                      style={styles.btnApprove}
                      onPress={() => {
                        setSelectedWithdrawal(wdr);
                        setWdrTxHash('');
                        setApproveWdrModalVisible(true);
                      }}
                    >
                      <Feather name="send" size={13} color="#030507" style={{ marginRight: 4 }} />
                      <Text style={styles.btnApproveText}>Approve &amp; Broadcast</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnReject}
                      onPress={() => {
                        setSelectedWithdrawal(wdr);
                        setWdrRejectReason('');
                        setRejectWdrModalVisible(true);
                      }}
                    >
                      <Feather name="x" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.btnRejectText}>Reject &amp; Refund</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* 5. USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <View>
          <TextInput
            style={styles.searchInput}
            value={userSearchQuery}
            onChangeText={setUserSearchQuery}
            placeholder="Search users by name, email, or username..."
            placeholderTextColor={colors.textDim}
          />

          {filteredUsers.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.username}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.userBalance}>${Number(u.wallet_balance).toFixed(2)} USDT</Text>
                  <Text style={{ fontSize: 10, color: colors.textDim }}>Level {u.active_level || 1} • {u.kyc_status}</Text>
                </View>
              </View>

              <View style={styles.userCardActionRow}>
                <TouchableOpacity
                  style={styles.userActionBtn}
                  onPress={() => {
                    setSelectedUser(u);
                    setUserBalanceAmount('');
                    setUserBalanceReason('');
                    setManageBalanceModalVisible(true);
                  }}
                >
                  <Feather name="dollar-sign" size={12} color={colors.goldSoft} style={{ marginRight: 3 }} />
                  <Text style={styles.userActionBtnText}>Manage Balance</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.userActionBtn}
                  onPress={() => {
                    setSelectedUser(u);
                    setUserTeamModalVisible(true);
                  }}
                >
                  <Feather name="git-branch" size={12} color={colors.accentGreenSoft} style={{ marginRight: 3 }} />
                  <Text style={styles.userActionBtnText}>Downlines ({u.direct_team_count || 0})</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 6. SUPPORT DESK (STAFF) */}
      {activeTab === 'support' && (
        <View>
          {supportTickets.map((t) => (
            <View key={t.id} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketSubject}>{t.subject}</Text>
                  <Text style={styles.ticketUser}>{t.user_email} • {t.category}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { borderColor: t.status === 'RESOLVED' ? colors.accentGreenSoft : colors.accentWarning },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: t.status === 'RESOLVED' ? colors.accentGreenSoft : colors.accentWarning },
                    ]}
                  >
                    {t.status}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.ticketViewBtn}
                onPress={() => {
                  setSelectedTicket(t);
                  setStaffReplyText('');
                  setTicketModalVisible(true);
                }}
              >
                <Feather name="message-square" size={13} color="#030507" style={{ marginRight: 4 }} />
                <Text style={styles.ticketViewBtnText}>Inspect &amp; Reply</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 7. RULES & ROI ENGINE */}
      {activeTab === 'rules' && (
        <View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>BATCH EXECUTION</Text>
              <Text style={styles.cardTitle}>Automated ROI Engine</Text>
            </View>

            <Text style={styles.roiDesc}>
              The FINOVO ROI Engine calculates weekly returns for all active investment tiers and distributes 5-level referral commissions to qualified uplines.
            </Text>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setRoiModalVisible(true)}
            >
              <Feather name="play" size={14} color="#030507" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrimaryText}>Trigger ROI Batch Distribution</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>PARAMETERS</Text>
              <Text style={styles.cardTitle}>System Rules &amp; Caps</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Maximum Return Cap</Text>
              <Text style={styles.ruleVal}>300.00% (Capital + ROI + Commissions)</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Direct Sales Commission</Text>
              <Text style={styles.ruleVal}>L1: 5%, L2: 3%, L3: 2%, L4: 1%, L5: 0.5%</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Direct Income Unlock Directs</Text>
              <Text style={styles.ruleVal}>0, 2, 4, 6, 8 Directs</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>ROI Level Income Unlock Directs</Text>
              <Text style={styles.ruleVal}>2, 4, 6, 8, 10 Directs</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Profit Withdrawal Fee</Text>
              <Text style={styles.ruleVal}>$1.00 USDT (Min: $10.00)</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Capital Withdrawal Fee</Text>
              <Text style={styles.ruleVal}>$10.00 USDT (Min: $100.00)</Text>
            </View>
          </View>
        </View>
      )}

      {/* MODAL: Reject Deposit */}
      <Modal visible={rejectDepModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Deposit Submission</Text>
            <Text style={styles.label}>Rejection Reason *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={depRejectReason}
              onChangeText={setDepRejectReason}
              placeholder="e.g. Transaction hash not found on blockchain explorer"
              placeholderTextColor={colors.textDim}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRejectDepModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: colors.accentDanger }]}
                onPress={handleRejectDepositSubmit}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Approve Withdrawal */}
      <Modal visible={approveWdrModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Approve &amp; Broadcast Payout</Text>
            <Text style={styles.label}>Blockchain Payout TxID Hash *</Text>
            <TextInput
              style={styles.input}
              value={wdrTxHash}
              onChangeText={setWdrTxHash}
              placeholder="Enter on-chain transaction hash"
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setApproveWdrModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleApproveWithdrawalSubmit}
              >
                <Text style={styles.modalBtnConfirmText}>Broadcast Payout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Manage User Balance */}
      <Modal visible={manageBalanceModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust User Balance ({selectedUser?.email})</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, userBalanceType === 'CREDIT' && styles.toggleBtnActive]}
                onPress={() => setUserBalanceType('CREDIT')}
              >
                <Text style={[styles.toggleBtnText, userBalanceType === 'CREDIT' && styles.toggleBtnTextActive]}>
                  + Credit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, userBalanceType === 'DEBIT' && styles.toggleBtnActive]}
                onPress={() => setUserBalanceType('DEBIT')}
              >
                <Text style={[styles.toggleBtnText, userBalanceType === 'DEBIT' && styles.toggleBtnTextActive]}>
                  - Debit
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={userBalanceAmount}
              onChangeText={setUserBalanceAmount}
              keyboardType="numeric"
              placeholder="Amount in USDT"
              placeholderTextColor={colors.textDim}
            />
            <TextInput
              style={styles.input}
              value={userBalanceReason}
              onChangeText={setUserBalanceReason}
              placeholder="Reason for adjustment"
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setManageBalanceModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleUserBalanceSubmit}
              >
                <Text style={styles.modalBtnConfirmText}>Apply Balance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Trigger ROI Batch */}
      <Modal visible={roiModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Execute Automated ROI Yields</Text>
            <Text style={styles.roiDesc}>
              Select the calculation period. This will credit weekly ROI directly to active investment plans and distribute referral upline commissions.
            </Text>
            <View style={styles.toggleRow}>
              {['ALL', 'MON', 'WED', 'FRI'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.toggleBtn, roiDay === d && styles.toggleBtnActive]}
                  onPress={() => setRoiDay(d)}
                >
                  <Text style={[styles.toggleBtnText, roiDay === d && styles.toggleBtnTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRoiModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleTriggerROI}
              >
                <Text style={styles.modalBtnConfirmText}>Run ROI Calculation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Inspect & Reply Support Ticket */}
      <Modal visible={ticketModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>
                Ticket #{selectedTicket?.id ? String(selectedTicket.id).slice(0, 8) : ''}
              </Text>
              <TouchableOpacity onPress={() => setTicketModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
              {selectedTicket?.subject}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 11, marginBottom: 10 }}>
              From: {selectedTicket?.user_email} • Status: {selectedTicket?.status}
            </Text>

            <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
              {(() => {
                const replies = selectedTicket?.replies || selectedTicket?.messages || [];
                if (replies.length === 0) {
                  return <Text style={{ color: colors.textMuted, fontSize: 12 }}>No messages in thread.</Text>;
                }
                return replies.map((m, idx) => (
                  <View
                    key={m.id || idx}
                    style={{
                      backgroundColor: m.is_staff || m.is_staff_reply ? 'rgba(198,153,61,0.1)' : 'rgba(255,255,255,0.04)',
                      padding: 8,
                      borderRadius: 6,
                      marginBottom: 6,
                      borderLeftWidth: 2,
                      borderLeftColor: m.is_staff || m.is_staff_reply ? colors.goldSoft : colors.accentBlue,
                    }}
                  >
                    <Text style={{ color: colors.textDim, fontSize: 10, marginBottom: 2 }}>
                      {m.is_staff || m.is_staff_reply ? 'Staff Reply' : (m.user_email || m.sender_name || 'User')}
                    </Text>
                    <Text style={{ color: colors.textMain, fontSize: 12 }}>{m.message}</Text>
                  </View>
                ));
              })()}
            </ScrollView>

            <Text style={styles.label}>Staff Response *</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={staffReplyText}
              onChangeText={setStaffReplyText}
              placeholder="Type official reply to the user..."
              placeholderTextColor={colors.textDim}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: colors.accentGreenSoft, flex: 1 }]}
                onPress={() => handleStaffReplySubmit('RESOLVED')}
              >
                <Text style={{ color: '#030507', fontWeight: '700', fontSize: 12 }}>Reply &amp; Resolve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { flex: 1 }]}
                onPress={() => handleStaffReplySubmit('IN_PROGRESS')}
              >
                <Text style={[styles.modalBtnConfirmText, { fontSize: 12 }]}>Send Reply</Text>
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
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  adminHeader: {
    marginBottom: 14,
  },
  adminBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adminBadge: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.8,
  },
  adminRoleText: {
    fontSize: 10,
    color: colors.textDim,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textMain,
    letterSpacing: -0.3,
  },
  navStrip: {
    marginBottom: 16,
  },
  navStripContent: {
    gap: 8,
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navPillActive: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderColor: colors.gold,
  },
  navPillText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  navPillTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
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
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textMain,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  statSub: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  cardHeader: {
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1.2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMain,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flex: 1,
    minWidth: '47%',
  },
  quickActionBtnText: {
    fontSize: 11.5,
    color: colors.textMain,
    fontWeight: '600',
  },
  treasuryHero: {
    backgroundColor: 'rgba(198, 153, 61, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.2)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  treasuryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.goldSoft,
    marginVertical: 4,
  },
  treasurySub: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  toggleBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
  },
  toggleBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#0E131A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 10,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 11,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: 12,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 6,
  },
  btnPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  filterPillActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
  },
  filterPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  dossierCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 12,
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dossierUser: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMain,
  },
  dossierEmail: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 1,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  dossierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dossierItem: {
    width: '48%',
  },
  dossierItemFull: {
    width: '100%',
    marginTop: 4,
  },
  dossierLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.5,
  },
  dossierVal: {
    fontSize: 12,
    color: colors.textMain,
    fontWeight: '600',
    marginTop: 2,
  },
  dossierHash: {
    fontSize: 11,
    color: colors.goldSoft,
    fontWeight: '500',
    marginTop: 2,
  },
  dossierBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btnApprove: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingVertical: 9,
  },
  btnApproveText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11.5,
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 6,
    paddingVertical: 9,
  },
  btnRejectText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 11.5,
  },
  userCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 10,
  },
  userCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMain,
  },
  userEmail: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 1,
  },
  userBalance: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  userCardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  userActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    paddingVertical: 7,
    borderRadius: 6,
  },
  userActionBtnText: {
    fontSize: 11,
    color: colors.textMain,
    fontWeight: '600',
  },
  ticketCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 10,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ticketSubject: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textMain,
  },
  ticketUser: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  ticketViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingVertical: 8,
  },
  ticketViewBtnText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11.5,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  ruleKey: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  ruleVal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.goldSoft,
  },
  roiDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#070A0E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  modalBtnConfirm: {
    flex: 2,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: colors.gold,
  },
  modalBtnConfirmText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 12.5,
  },
});
