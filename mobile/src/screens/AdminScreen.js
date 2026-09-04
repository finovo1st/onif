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
  Image,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function AdminScreen({ onNavigate }) {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'funds' | 'deposits' | 'withdrawals' | 'users' | 'support' | 'settings'
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // ─── 1. OVERVIEW TELEMETRY STATE ───
  const [metrics, setMetrics] = useState({
    vault_balance: 0.0,
    total_system_balance: 0.0,
    total_system_deposited: 0.0,
    total_roi_earned: 0.0,
    total_commissions_paid: 0.0,
    pending_deposits_count: 0,
    pending_deposits_amount: 0.0,
    active_investments_count: 0,
    active_investments_amount: 0.0,
    all_time_investments_amount: 0.0,
    pending_withdrawals_count: 0,
    pending_withdrawals_amount: 0.0,
    total_users_count: 0,
    verified_users_count: 0,
    active_users_count: 0,
    pending_kyc_count: 0,
    open_tickets_count: 0,
    queues: {
      pending_investments: [],
      pending_withdrawals: [],
      recent_tickets: [],
    },
  });

  // ─── 2. CORPORATE TREASURY STATE ───
  const [fundsSummary, setFundsSummary] = useState({
    company_wallet_balance: 0.0,
    total_generation: 0.0,
    net_funds: 0.0,
    total_cash: 0.0,
    total_trading_capital: 0.0,
    remaining_funds: 0.0,
    total_withdrawals: 0.0,
    count: 0,
  });
  const [fundsTransactions, setFundsTransactions] = useState([]);
  const [fundsCategoryFilter, setFundsCategoryFilter] = useState('all');
  const [fundsSearchQuery, setFundsSearchQuery] = useState('');
  const [adjustFundsModalVisible, setAdjustFundsModalVisible] = useState(false);
  const [adjustType, setAdjustType] = useState('CREDIT'); // 'CREDIT' | 'DEBIT' | 'GENERATE'
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // ─── 3. INVESTMENTS & DEPOSITS STATE ───
  const [deposits, setDeposits] = useState([]);
  const [depositFilter, setDepositFilter] = useState('DEPOSIT_PENDING'); // 'all' | 'DEPOSIT_PENDING' | 'ACTIVE' | 'COMPLETED' | 'REJECTED'
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [rejectDepModalVisible, setRejectDepModalVisible] = useState(false);
  const [depRejectReason, setDepRejectReason] = useState('');
  const [proofLightboxVisible, setProofLightboxVisible] = useState(false);
  const [activeProofUrl, setActiveProofUrl] = useState('');

  // ─── 4. WITHDRAWALS QUEUE STATE ───
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState('PENDING'); // 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [withdrawalSearchQuery, setWithdrawalSearchQuery] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [approveWdrModalVisible, setApproveWdrModalVisible] = useState(false);
  const [wdrTxHash, setWdrTxHash] = useState('');
  const [rejectWdrModalVisible, setRejectWdrModalVisible] = useState(false);
  const [wdrRejectReason, setWdrRejectReason] = useState('');

  // ─── 5. USER DIRECTORY & ACCESS CONTROL STATE ───
  const [usersList, setUsersList] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userKycFilter, setUserKycFilter] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Comprehensive Manage User Modal State
  const [manageUserModalVisible, setManageUserModalVisible] = useState(false);
  const [manageUserRole, setManageUserRole] = useState('USER');
  const [manageUserKyc, setManageUserKyc] = useState('UNVERIFIED');
  const [manageUserBypass, setManageUserBypass] = useState(false);
  const [manageUserEmailVerified, setManageUserEmailVerified] = useState(false);
  const [manageUserActive, setManageUserActive] = useState(true);
  const [manageUserBalanceAction, setManageUserBalanceAction] = useState('CREDIT');
  const [manageUserBalanceAmount, setManageUserBalanceAmount] = useState('');
  const [manageUserBalanceReason, setManageUserBalanceReason] = useState('');

  // User Team Modal State
  const [userTeamModalVisible, setUserTeamModalVisible] = useState(false);
  const [userTeamLoading, setUserTeamLoading] = useState(false);
  const [userTeamData, setUserTeamData] = useState(null); // { user, summary, levels }
  const [userTeamSelectedLevel, setUserTeamSelectedLevel] = useState('all'); // 'all' | 1 | 2 | 3 | 4 | 5

  // ─── 6. HELPDESK CONSOLE STATE ───
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportFilter, setSupportFilter] = useState('OPEN'); // 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  const [supportSearchQuery, setSupportSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [staffReplyText, setStaffReplyText] = useState('');
  const [ticketModalVisible, setTicketModalVisible] = useState(false);

  // ─── 7. SETTINGS, PLANS & ROI ENGINE STATE ───
  const [roiModalVisible, setRoiModalVisible] = useState(false);
  const [roiDay, setRoiDay] = useState('ALL');
  const [roiMode, setRoiMode] = useState('full_week'); // 'full_week' | 'by_day'
  const [companyWallets, setCompanyWallets] = useState({
    bep20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    trc20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
  });
  const [plansList, setPlansList] = useState([]);

  // ─── DATA LOADER ───
  const loadAdminData = async () => {
    try {
      // 1. Overview Telemetry
      const overview = await apiCall('/admin-panel/overview/').catch(() => null);
      if (overview) {
        setMetrics({
          vault_balance: overview.finances?.company_wallet_balance || overview.finances?.total_system_balance || 0,
          total_system_balance: overview.finances?.total_system_balance || 0,
          total_system_deposited: overview.finances?.total_system_deposited || 0,
          total_roi_earned: overview.finances?.total_roi_earned || 0,
          total_commissions_paid: overview.finances?.total_commissions_paid !== undefined
            ? overview.finances.total_commissions_paid
            : ((overview.finances?.total_direct_income || 0) + (overview.finances?.total_referral_income || 0)),
          pending_deposits_count: overview.investments?.pending_count || 0,
          pending_deposits_amount: overview.investments?.pending_total || 0,
          active_investments_count: overview.investments?.active_count || 0,
          active_investments_amount: overview.investments?.active_total || 0,
          all_time_investments_amount: overview.investments?.all_time_total || 0,
          pending_withdrawals_count: overview.withdrawals?.pending_count || 0,
          pending_withdrawals_amount: overview.withdrawals?.pending_total || 0,
          total_users_count: overview.users?.total || 0,
          verified_users_count: overview.users?.verified || 0,
          active_users_count: overview.users?.active || 0,
          pending_kyc_count: overview.users?.pending_kyc || 0,
          open_tickets_count: overview.support?.open_tickets || 0,
          queues: overview.queues || {
            pending_investments: [],
            pending_withdrawals: [],
            recent_tickets: [],
          },
        });
      }

      // 2. Corporate Treasury Summary & Ledger
      const summary = await apiCall('/admin-panel/funds/summary/').catch(() => null);
      if (summary) setFundsSummary(summary);

      const fetchedFunds = await apiCall('/admin-panel/funds/').catch(() => []);
      const fundsList = Array.isArray(fetchedFunds) ? fetchedFunds : (fetchedFunds?.results || []);
      setFundsTransactions(fundsList);

      // 3. Investments
      const fetchedDeps = await apiCall('/admin-panel/investments/').catch(() => []);
      const depList = Array.isArray(fetchedDeps) ? fetchedDeps : (fetchedDeps?.results || []);
      setDeposits(depList);

      // 4. Withdrawals
      const fetchedWdrs = await apiCall('/admin-panel/withdrawals/').catch(() => []);
      const wdrList = Array.isArray(fetchedWdrs) ? fetchedWdrs : (fetchedWdrs?.results || []);
      setWithdrawals(wdrList);

      // 5. Users
      const fetchedUsers = await apiCall('/admin-panel/users/').catch(() => []);
      const userList = Array.isArray(fetchedUsers) ? fetchedUsers : (fetchedUsers?.results || []);
      setUsersList(userList);

      // 6. Support Tickets
      const fetchedTickets = await apiCall('/admin-panel/tickets/').catch(() => []);
      const ticketList = Array.isArray(fetchedTickets) ? fetchedTickets : (fetchedTickets?.results || []);
      setSupportTickets(ticketList);

      // 7. Investment Plans
      const plans = await apiCall('/investments/plans/').catch(() => []);
      const pList = Array.isArray(plans) ? plans : (plans?.results || []);
      setPlansList(pList);
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

  // ─── ACTIONS ───

  // Deposit Actions
  const handleApproveDeposit = async (dep) => {
    const amtStr = Number(dep.amount || 0).toFixed(2);
    Alert.alert(
      'Approve Deposit Proof',
      `Confirm approval of $${amtStr} USDT for ${dep.user_email}? This activates the tier and credits 5-level upline commissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Activate',
          onPress: async () => {
            setLoading(true);
            try {
              await apiCall(`/admin-panel/investments/${dep.id}/approve/`, 'POST');
              Alert.alert('Deposit Approved', `Deposit #${dep.id} activated successfully.`);
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
    if (!depRejectReason.trim()) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      if (selectedDeposit) {
        await apiCall(`/admin-panel/investments/${selectedDeposit.id}/reject/`, 'POST', {
          reason: depRejectReason.trim(),
        });
      }
      setRejectDepModalVisible(false);
      Alert.alert('Deposit Rejected', `Deposit #${selectedDeposit.id} rejected.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Withdrawal Actions
  const handleApproveWithdrawalSubmit = async () => {
    if (!wdrTxHash.trim()) {
      Alert.alert('Validation Error', 'Please enter the on-chain payout transaction hash (TxID).');
      return;
    }
    setLoading(true);
    try {
      if (selectedWithdrawal) {
        await apiCall(`/admin-panel/withdrawals/${selectedWithdrawal.id}/approve/`, 'POST', {
          txn_hash: wdrTxHash.trim(),
          payout_txn_hash: wdrTxHash.trim(),
        });
      }
      setApproveWdrModalVisible(false);
      Alert.alert('Payout Broadcasted', `Withdrawal #${selectedWithdrawal.id} marked as paid.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithdrawalSubmit = async () => {
    if (!wdrRejectReason.trim()) {
      Alert.alert('Validation Error', 'Please enter a rejection reason.');
      return;
    }
    setLoading(true);
    try {
      if (selectedWithdrawal) {
        await apiCall(`/admin-panel/withdrawals/${selectedWithdrawal.id}/reject/`, 'POST', {
          reason: wdrRejectReason.trim(),
        });
      }
      setRejectWdrModalVisible(false);
      Alert.alert('Withdrawal Rejected', `Withdrawal #${selectedWithdrawal.id} refunded.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Corporate Funds Action
  const handleAdjustFundsSubmit = async () => {
    const amt = Number(adjustAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid numeric amount.');
      return;
    }
    setLoading(true);
    try {
      if (adjustType === 'GENERATE') {
        await apiCall('/admin-panel/funds/generate/', 'POST', {
          amount: amt,
          description: adjustReason || 'Corporate Generation',
        });
      } else {
        await apiCall('/admin-panel/funds/adjust/', 'POST', {
          action: adjustType,
          amount: amt,
          description: adjustReason || `Corporate Treasury ${adjustType}`,
        });
      }
      setAdjustFundsModalVisible(false);
      setAdjustAmount('');
      setAdjustReason('');
      Alert.alert('Treasury Updated', `Corporate treasury adjusted by $${amt.toFixed(2)} USDT.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Funds Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── USER MANAGEMENT ACTIONS ───
  const handleOpenManageUserModal = async (u) => {
    setSelectedUser(u);
    setManageUserRole((u.role || 'USER').toUpperCase());
    setManageUserKyc((u.kyc_status || 'UNVERIFIED').toUpperCase());
    setManageUserBypass(Boolean(u.bypass_plan_and_level_requirements || u.is_commission_bypassed));
    setManageUserEmailVerified(Boolean(u.is_email_verified));
    setManageUserActive(u.is_active !== false);
    setManageUserBalanceAction('CREDIT');
    setManageUserBalanceAmount('');
    setManageUserBalanceReason('');
    setManageUserModalVisible(true);

    try {
      const fresh = await apiCall(`/admin-panel/users/${u.id}/`).catch(() => null);
      if (fresh) {
        setSelectedUser(fresh);
        setManageUserRole((fresh.role || 'USER').toUpperCase());
        setManageUserKyc((fresh.kyc_status || 'UNVERIFIED').toUpperCase());
        setManageUserBypass(Boolean(fresh.bypass_plan_and_level_requirements || fresh.is_commission_bypassed));
        setManageUserEmailVerified(Boolean(fresh.is_email_verified));
        setManageUserActive(fresh.is_active !== false);
      }
    } catch (e) {}
  };

  const handleQuickKycStatus = async (status) => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await apiCall(`/admin-panel/users/${selectedUser.id}/`, 'PATCH', {
        kyc_status: status,
      });
      setManageUserKyc(status);
      setSelectedUser({ ...selectedUser, kyc_status: status });
      Alert.alert('KYC Updated', `User KYC status updated to ${status}.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('KYC Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManageUserSubmit = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      // 1. Update user role, kyc, bypass, and account state
      await apiCall(`/admin-panel/users/${selectedUser.id}/`, 'PATCH', {
        role: manageUserRole,
        kyc_status: manageUserKyc,
        bypass_plan_and_level_requirements: manageUserBypass,
        is_email_verified: manageUserEmailVerified,
        is_active: manageUserActive,
      });

      // 2. Apply balance adjustment if amount is entered
      const amt = parseFloat(manageUserBalanceAmount);
      if (amt && amt > 0) {
        await apiCall(`/admin-panel/users/${selectedUser.id}/adjust-balance/`, 'POST', {
          action: manageUserBalanceAction,
          amount: amt,
          reason: manageUserBalanceReason || `Admin ${manageUserBalanceAction.toLowerCase()} adjustment`,
        });
      }

      setManageUserModalVisible(false);
      Alert.alert('User Updated', `Account privileges and settings for ${selectedUser.email} saved.`);
      loadAdminData();
    } catch (err) {
      Alert.alert('Update Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUserTeamModal = async (u) => {
    setSelectedUser(u);
    setUserTeamModalVisible(true);
    setUserTeamLoading(true);
    setUserTeamData(null);
    setUserTeamSelectedLevel('all');
    try {
      const res = await apiCall(`/admin-panel/users/${u.id}/team/`).catch(() => null);
      if (res && (res.summary || res.levels || res.user)) {
        setUserTeamData(res);
        // Sync freshest live total_team_members into the user list
        if (res.summary?.total_team_members !== undefined) {
          setUsersList((prev) =>
            prev.map((item) =>
              item.id === u.id
                ? {
                    ...item,
                    team_total_members: res.summary.total_team_members,
                    team_total_investment: res.summary.total_team_investment,
                  }
                : item
            )
          );
        }
      } else if (Array.isArray(res)) {
        setUserTeamData({
          user: u,
          summary: {
            total_team_members: res.length,
            total_team_investment: 0,
            total_direct_income: 0,
            total_referral_roi_income: 0,
          },
          levels: [
            {
              level: 1,
              total_refers: res.length,
              total_investment: 0,
              direct_income: 0,
              roi_income: 0,
              members: res,
            },
          ],
        });
      } else {
        setUserTeamData({
          user: u,
          summary: {
            total_team_members: 0,
            total_team_investment: 0,
            total_direct_income: 0,
            total_referral_roi_income: 0,
          },
          levels: [],
        });
      }
    } catch (err) {
      console.warn('Failed to load user team data:', err);
      setUserTeamData(null);
    } finally {
      setUserTeamLoading(false);
    }
  };

  // ROI Trigger Engine Action
  const handleTriggerROI = async () => {
    Alert.alert(
      'Trigger ROI Calculation Engine',
      `Execute automated ROI distribution (${roiMode === 'full_week' ? 'Full Week' : `Day: ${roiDay}`})? Calculates yields and distributes 5-level referral commissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute ROI Run',
          onPress: async () => {
            setLoading(true);
            try {
              await apiCall('/admin-panel/trigger-roi/', 'POST', {
                day: roiMode === 'full_week' ? 'ALL' : roiDay,
                mode: roiMode,
              });
              setRoiModalVisible(false);
              Alert.alert('ROI Engine Executed', 'Weekly ROI yield calculation and 5-level referral distribution completed.');
              loadAdminData();
            } catch (err) {
              Alert.alert('ROI Error', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Support Reply Action
  const handleStaffReplySubmit = async (newStatus = null) => {
    if (!staffReplyText.trim()) {
      Alert.alert('Validation Error', 'Please enter a response message.');
      return;
    }
    setLoading(true);
    try {
      if (selectedTicket) {
        await apiCall(`/admin-panel/tickets/${selectedTicket.id}/reply/`, 'POST', {
          message: staffReplyText.trim(),
          status: newStatus || selectedTicket.status,
        });
      }
      setStaffReplyText('');
      setTicketModalVisible(false);
      Alert.alert('Reply Sent', 'Staff response sent to user.');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Deposit Wallets Action
  const handleSaveCompanyWallets = async () => {
    setLoading(true);
    try {
      await apiCall('/admin-panel/settings/company-wallets/', 'POST', {
        bep20_address: companyWallets.bep20,
        trc20_address: companyWallets.trc20,
      }).catch(() => null);
      Alert.alert('Wallets Saved', 'Official deposit receiving wallet addresses saved.');
    } catch (err) {
      Alert.alert('Save Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── FILTERING LOGIC (MATCHING FRONTEND) ───
  const filteredDeposits = deposits.filter((d) => {
    const s = String(d.status || '').toUpperCase();
    if (depositFilter === 'DEPOSIT_PENDING' && s !== 'DEPOSIT_PENDING' && s !== 'PENDING') return false;
    if (depositFilter === 'ACTIVE' && s !== 'ACTIVE' && s !== 'APPROVED') return false;
    if (depositFilter === 'COMPLETED' && s !== 'COMPLETED') return false;
    if (depositFilter === 'REJECTED' && s !== 'REJECTED') return false;

    if (depositSearchQuery) {
      const q = depositSearchQuery.toLowerCase();
      const email = String(d.user_email || '').toLowerCase();
      const tx = String(d.deposit_txn_hash || d.txn_hash || '').toLowerCase();
      const id = String(d.id || '').toLowerCase();
      return email.includes(q) || tx.includes(q) || id.includes(q);
    }
    return true;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    const s = String(w.status || '').toUpperCase();
    if (withdrawalFilter === 'PENDING' && s !== 'PENDING') return false;
    if (withdrawalFilter === 'APPROVED' && s !== 'APPROVED' && s !== 'COMPLETED') return false;
    if (withdrawalFilter === 'REJECTED' && s !== 'REJECTED') return false;

    if (withdrawalSearchQuery) {
      const q = withdrawalSearchQuery.toLowerCase();
      const email = String(w.user_email || '').toLowerCase();
      const addr = String(w.wallet_address || '').toLowerCase();
      return email.includes(q) || addr.includes(q);
    }
    return true;
  });

  const filteredUsers = usersList.filter((u) => {
    if (userRoleFilter && String(u.role || '').toUpperCase() !== userRoleFilter.toUpperCase()) return false;
    if (userKycFilter && String(u.kyc_status || '').toUpperCase() !== userKycFilter.toUpperCase()) return false;

    if (userSearchQuery) {
      const q = userSearchQuery.toLowerCase();
      return (
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.first_name || '').toLowerCase().includes(q) ||
        String(u.last_name || '').toLowerCase().includes(q) ||
        String(u.referral_code || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredTickets = supportTickets.filter((t) => {
    const s = String(t.status || '').toUpperCase();
    if (supportFilter === 'OPEN' && s !== 'OPEN') return false;
    if (supportFilter === 'IN_PROGRESS' && s !== 'IN_PROGRESS') return false;
    if (supportFilter === 'RESOLVED' && s !== 'RESOLVED') return false;
    if (supportFilter === 'CLOSED' && s !== 'CLOSED') return false;

    if (supportSearchQuery) {
      const q = supportSearchQuery.toLowerCase();
      const email = String(t.user_email || '').toLowerCase();
      const sub = String(t.subject || '').toLowerCase();
      return email.includes(q) || sub.includes(q);
    }
    return true;
  });

  const filteredFunds = fundsTransactions.filter((tx) => {
    if (fundsCategoryFilter !== 'all' && String(tx.category || tx.action || '').toUpperCase() !== fundsCategoryFilter.toUpperCase()) return false;
    if (fundsSearchQuery) {
      const q = fundsSearchQuery.toLowerCase();
      const desc = String(tx.description || '').toLowerCase();
      const ref = String(tx.reference_id || tx.id || '').toLowerCase();
      return desc.includes(q) || ref.includes(q);
    }
    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* ─── ADMIN HEADER BAR ─── */}
      <View style={styles.adminHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.adminBadgeRow}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>FINOVO COMMAND CENTER</Text>
            </View>
            <Text style={styles.adminRoleText}>Superuser Privileges</Text>
          </View>
          <Text style={styles.screenTitle}>Platform Governance</Text>
        </View>

        {/* Header Action: Trigger ROI Button (Matching Web Topbar) */}
        <TouchableOpacity
          style={styles.headerTriggerRoiBtn}
          onPress={() => setRoiModalVisible(true)}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={12} color="#030507" style={{ marginRight: 4 }} />
          <Text style={styles.headerTriggerRoiBtnText}>Trigger ROI</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 7 SUB-PAGE NAVIGATION PILLS (MATCHING FRONTEND ADMIN) ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.navStrip}
        contentContainerStyle={styles.navStripContent}
      >
        {[
          { id: 'overview', label: 'Overview', icon: 'grid', badge: null },
          { id: 'funds', label: 'Company Treasury', icon: 'dollar-sign', badge: null },
          { id: 'deposits', label: 'Deposits', icon: 'arrow-down-circle', badge: metrics.pending_deposits_count },
          { id: 'withdrawals', label: 'Payouts', icon: 'arrow-up-circle', badge: metrics.pending_withdrawals_count },
          { id: 'users', label: 'Users Directory', icon: 'users', badge: null },
          { id: 'support', label: 'Support Desk', icon: 'message-square', badge: metrics.open_tickets_count },
          { id: 'settings', label: 'Rules & Plans', icon: 'sliders', badge: null },
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
            {Boolean(tab.badge && tab.badge > 0) && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 1: OVERVIEW TELEMETRY & COMMAND CENTER
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <View>
          {/* Main 5 Metric Stat Cards (Matching Frontend Grid-4) */}
          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              {/* 1. Company Wallet */}
              <TouchableOpacity
                style={[styles.statCard, { borderColor: colors.bgCardBorderGold }]}
                onPress={() => setActiveTab('funds')}
                activeOpacity={0.8}
              >
                <Text style={styles.statLabel} numberOfLines={1}>COMPANY WALLET</Text>
                <Text style={[styles.statValue, { color: colors.goldSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                  ${Number(fundsSummary.net_funds || metrics.vault_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.statSub} numberOfLines={1}>Corporate Treasury • View ledger →</Text>
              </TouchableOpacity>

              {/* 2. Platform Registered Users */}
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => setActiveTab('users')}
                activeOpacity={0.8}
              >
                <Text style={styles.statLabel} numberOfLines={1}>REGISTERED USERS</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{metrics.total_users_count}</Text>
                <Text style={styles.statSub} numberOfLines={1}>{metrics.verified_users_count} verified • {metrics.active_users_count} active</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metricRow}>
              {/* 3. Active Investment Capital */}
              <View style={styles.statCard}>
                <Text style={styles.statLabel} numberOfLines={1}>ACTIVE INVESTMENT CAPITAL</Text>
                <Text style={[styles.statValue, { color: colors.goldSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                  ${Number(metrics.active_investments_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.statSub} numberOfLines={1}>{metrics.active_investments_count} active plans</Text>
              </View>

              {/* 4. Pending Deposit Approvals */}
              <TouchableOpacity
                style={[styles.statCard, { borderColor: 'rgba(250, 204, 21, 0.4)' }]}
                onPress={() => setActiveTab('deposits')}
                activeOpacity={0.8}
              >
                <Text style={styles.statLabel} numberOfLines={1}>PENDING DEPOSITS</Text>
                <Text style={[styles.statValue, { color: colors.accentWarning }]} numberOfLines={1} adjustsFontSizeToFit>
                  ${Number(metrics.pending_deposits_amount).toFixed(2)}
                </Text>
                <Text style={styles.statSub} numberOfLines={1}>{metrics.pending_deposits_count} awaiting proof review →</Text>
              </TouchableOpacity>
            </View>

            {/* 5. Pending Withdrawals */}
            <TouchableOpacity
              style={[styles.statCardFull, { borderColor: 'rgba(248, 113, 113, 0.4)' }]}
              onPress={() => setActiveTab('withdrawals')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.statLabel} numberOfLines={1}>QUEUED PAYOUTS</Text>
                  <Text style={[styles.statValue, { color: colors.accentDanger }]} numberOfLines={1} adjustsFontSizeToFit>
                    ${Number(metrics.pending_withdrawals_amount).toFixed(2)} USDT
                  </Text>
                  <Text style={styles.statSub} numberOfLines={1}>{metrics.pending_withdrawals_count} payouts queued in processing</Text>
                </View>
                <Feather name="arrow-right-circle" size={22} color={colors.accentDanger} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Action Queues: Pending Deposits & Withdrawals (Matching Web Queues) */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderBetween}>
              <View>
                <Text style={styles.eyebrow}>ACTION QUEUE</Text>
                <Text style={styles.cardTitle}>Pending Investment Deposits</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('deposits')}>
                <Text style={styles.viewAllLink}>View All ({metrics.pending_deposits_count})</Text>
              </TouchableOpacity>
            </View>

            {metrics.queues?.pending_investments?.length === 0 ? (
              <Text style={styles.emptyNoticeText}>No pending deposits waiting for review.</Text>
            ) : (
              metrics.queues.pending_investments.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.miniQueueItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniItemTitle}>{item.user_email}</Text>
                    <Text style={styles.miniItemSub}>
                      {item.plan_name} • <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>${Number(item.amount).toFixed(2)} USDT</Text> ({item.deposit_network || 'BEP20'})
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.miniBtnPrimary}
                      onPress={() => handleApproveDeposit(item)}
                    >
                      <Text style={styles.miniBtnPrimaryText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.miniBtnDanger}
                      onPress={() => {
                        setSelectedDeposit(item);
                        setDepRejectReason('');
                        setRejectDepModalVisible(true);
                      }}
                    >
                      <Text style={styles.miniBtnDangerText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Pending Withdrawals Queue Preview */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.sectionHeaderBetween}>
              <View>
                <Text style={styles.eyebrow}>PAYOUT QUEUE</Text>
                <Text style={styles.cardTitle}>Pending Withdrawal Requests</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('withdrawals')}>
                <Text style={styles.viewAllLink}>View All ({metrics.pending_withdrawals_count})</Text>
              </TouchableOpacity>
            </View>

            {metrics.queues?.pending_withdrawals?.length === 0 ? (
              <Text style={styles.emptyNoticeText}>No pending payouts queued.</Text>
            ) : (
              metrics.queues.pending_withdrawals.slice(0, 3).map((wdr) => (
                <View key={wdr.id} style={styles.miniQueueItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniItemTitle}>{wdr.user_email}</Text>
                    <Text style={styles.miniItemSub}>
                      {wdr.withdrawal_type} • <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>${Number(wdr.net_amount || wdr.amount).toFixed(2)} USDT</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.miniBtnPrimary}
                    onPress={() => {
                      setSelectedWithdrawal(wdr);
                      setWdrTxHash('');
                      setApproveWdrModalVisible(true);
                    }}
                  >
                    <Text style={styles.miniBtnPrimaryText}>Pay</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Platform Financial Liabilities Breakdown */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>SYSTEM BALANCES</Text>
              <Text style={styles.cardTitle}>Platform Financial Liabilities</Text>
            </View>

            <View style={styles.liabilityRow}>
              <Text style={styles.liabilityLabel}>Company Wallet Balance</Text>
              <Text style={[styles.liabilityVal, { color: colors.goldSoft }]}>
                ${Number(metrics.vault_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </Text>
            </View>
            <View style={styles.liabilityRow}>
              <Text style={styles.liabilityLabel}>Total User Spendable Balances</Text>
              <Text style={styles.liabilityVal}>${Number(metrics.total_system_balance).toFixed(2)} USDT</Text>
            </View>
            <View style={styles.liabilityRow}>
              <Text style={styles.liabilityLabel}>Total Lifetime Platform Deposits</Text>
              <Text style={styles.liabilityVal}>${Number(metrics.total_system_deposited).toFixed(2)} USDT</Text>
            </View>
            <View style={styles.liabilityRow}>
              <Text style={styles.liabilityLabel}>Total ROI Payouts Generated</Text>
              <Text style={[styles.liabilityVal, { color: colors.goldSoft }]}>${Number(metrics.total_roi_earned).toFixed(2)} USDT</Text>
            </View>
            <View style={styles.liabilityRow}>
              <Text style={styles.liabilityLabel}>Total Direct &amp; Level Commissions</Text>
              <Text style={[styles.liabilityVal, { color: colors.goldSoft }]}>${Number(metrics.total_commissions_paid).toFixed(2)} USDT</Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 2: CORPORATE TREASURY & COMPANY FUNDS
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'funds' && (
        <View>
          {/* Header Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderBetween}>
              <View>
                <Text style={styles.eyebrow}>CORPORATE TREASURY</Text>
                <Text style={styles.cardTitle}>Company Funds &amp; Treasury</Text>
              </View>
              <TouchableOpacity
                style={styles.miniBtnGold}
                onPress={() => setAdjustFundsModalVisible(true)}
              >
                <Feather name="plus" size={12} color="#030507" style={{ marginRight: 3 }} />
                <Text style={styles.miniBtnGoldText}>Adjust Funds</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionDesc}>
              Real-time audit trail for platform package spreads, withdrawal fees, and manual treasury adjustments.
            </Text>
          </View>

          {/* 7 KPI Cash Flow Telemetry Grid (Matching Web Admin) */}
          <View style={styles.metricGrid}>
            <View style={[styles.statCard, { borderColor: '#38bdf8' }]}>
              <Text style={styles.statLabel}>TOTAL CASH</Text>
              <Text style={[styles.statValue, { color: '#38bdf8' }]}>
                ${Number(fundsSummary.total_cash || metrics.total_system_deposited).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Gross Plan Inflows</Text>
            </View>

            <View style={[styles.statCard, { borderColor: colors.goldSoft }]}>
              <Text style={styles.statLabel}>TRADING CAPITAL</Text>
              <Text style={[styles.statValue, { color: colors.goldSoft }]}>
                ${Number(fundsSummary.total_trading_capital || metrics.active_investments_amount).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Active &amp; Completed</Text>
            </View>

            <View style={[styles.statCard, { borderColor: '#10b981' }]}>
              <Text style={styles.statLabel}>REMAINING FUNDS</Text>
              <Text style={[styles.statValue, { color: '#10b981' }]}>
                ${Number(fundsSummary.remaining_funds || fundsSummary.net_funds).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Cash − Capital + Gen − Outflow</Text>
            </View>

            <View style={[styles.statCard, { borderColor: colors.goldSoft }]}>
              <Text style={styles.statLabel}>TREASURY BALANCE</Text>
              <Text style={[styles.statValue, { color: colors.goldSoft }]}>
                ${Number(fundsSummary.company_wallet_balance || metrics.vault_balance).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Retained Corporate Profit</Text>
            </View>

            <View style={[styles.statCard, { borderColor: '#60a5fa' }]}>
              <Text style={styles.statLabel}>TOTAL GENERATION</Text>
              <Text style={[styles.statValue, { color: '#60a5fa' }]}>
                ${Number(fundsSummary.total_generation || 0).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Manual Corporate Additions</Text>
            </View>

            <View style={[styles.statCard, { borderColor: '#f87171' }]}>
              <Text style={styles.statLabel}>TOTAL WITHDRAWALS</Text>
              <Text style={[styles.statValue, { color: '#f87171' }]}>
                ${Number(fundsSummary.total_withdrawals || 0).toFixed(2)}
              </Text>
              <Text style={styles.statSub}>Gross Paid Out</Text>
            </View>
          </View>

          {/* Search & Category Filter */}
          <View style={[styles.card, { marginTop: 4, marginBottom: 14 }]}>
            <TextInput
              style={styles.searchInput}
              value={fundsSearchQuery}
              onChangeText={setFundsSearchQuery}
              placeholder="Search by description, reference ID..."
              placeholderTextColor={colors.textDim}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { id: 'all', label: 'All Categories' },
                  { id: 'PLAN_INFLOW', label: 'Plan Inflow (+)' },
                  { id: 'GENERATION', label: 'Generation' },
                  { id: 'WITHDRAWAL_OUTFLOW', label: 'Withdrawal Outflow (-)' },
                  { id: 'ADJUSTMENT', label: 'Admin Adjustment' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterPill, fundsCategoryFilter === item.id && styles.filterPillActive]}
                    onPress={() => setFundsCategoryFilter(item.id)}
                  >
                    <Text style={[styles.filterPillText, fundsCategoryFilter === item.id && styles.filterPillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Treasury Ledger History List */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderBetween}>
              <View>
                <Text style={styles.eyebrow}>AUDIT TRAIL</Text>
                <Text style={styles.cardTitle}>Company Treasury Ledger</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.goldSoft, fontWeight: '700' }}>
                {filteredFunds.length} Entries
              </Text>
            </View>

            {filteredFunds.length === 0 ? (
              <Text style={styles.emptyNoticeText}>No corporate fund transactions found.</Text>
            ) : (
              filteredFunds.map((tx) => (
                <View key={tx.id} style={styles.ledgerItem}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.ledgerType}>{tx.action || tx.category || 'OPERATION'}</Text>
                      <Text style={styles.ledgerDate}>{tx.created_at ? String(tx.created_at).slice(0, 16) : ''}</Text>
                    </View>
                    <Text style={styles.ledgerDesc}>{tx.description || tx.reference_id || 'System corporate transaction'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        { color: tx.action === 'DEBIT' ? colors.accentDanger : colors.accentGreenSoft },
                      ]}
                    >
                      {tx.action === 'DEBIT' ? '-' : '+'}${Number(tx.amount).toFixed(2)} USDT
                    </Text>
                    {tx.balance_after !== undefined && (
                      <Text style={{ fontSize: 10, color: colors.textDim }}>
                        Bal: ${Number(tx.balance_after).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 3: INVESTMENTS & DEPOSITS VERIFICATION
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'deposits' && (
        <View>
          <TextInput
            style={styles.searchInput}
            value={depositSearchQuery}
            onChangeText={setDepositSearchQuery}
            placeholder="Search by email, TxID, or Investment ID..."
            placeholderTextColor={colors.textDim}
          />

          {/* Status Filter Bar (Matching Web Status Select) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { id: 'DEPOSIT_PENDING', label: 'Pending Approval' },
                { id: 'ACTIVE', label: 'Active Plans' },
                { id: 'COMPLETED', label: 'Completed Plans' },
                { id: 'REJECTED', label: 'Rejected Deposits' },
                { id: 'all', label: 'All Statuses' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, depositFilter === f.id && styles.filterPillActive]}
                  onPress={() => setDepositFilter(f.id)}
                >
                  <Text style={[styles.filterPillText, depositFilter === f.id && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredDeposits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No deposit records matching current filters.</Text>
            </View>
          ) : (
            filteredDeposits.map((dep) => {
              const statusStr = String(dep.status || '').toUpperCase();
              const isPending = statusStr === 'PENDING' || statusStr === 'DEPOSIT_PENDING';
              const isApproved = statusStr === 'APPROVED' || statusStr === 'ACTIVE' || statusStr === 'COMPLETED';

              return (
                <View key={dep.id} style={styles.dossierCard}>
                  <View style={styles.dossierHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dossierUser}>{dep.user_full_name || dep.user_email}</Text>
                      <Text style={styles.dossierEmail}>{dep.user_email}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          borderColor: isApproved
                            ? colors.accentGreenSoft
                            : isPending
                            ? colors.accentWarning
                            : colors.accentDanger,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: isApproved
                              ? colors.accentGreenSoft
                              : isPending
                              ? colors.accentWarning
                              : colors.accentDanger,
                          },
                        ]}
                      >
                        {statusStr}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.dossierGrid}>
                    <View style={styles.dossierRow}>
                      <View style={styles.dossierItem}>
                        <Text style={styles.dossierLabel}>PLAN</Text>
                        <Text style={styles.dossierVal}>{dep.plan_name || 'Standard Tier'}</Text>
                      </View>
                      <View style={styles.dossierItem}>
                        <Text style={styles.dossierLabel}>AMOUNT</Text>
                        <Text style={[styles.dossierVal, { color: colors.goldSoft }]}>
                          ${Number(dep.amount).toFixed(2)} USDT ({dep.deposit_network || dep.network || 'BEP20'})
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dossierItemFull}>
                      <Text style={styles.dossierLabel}>TX HASH / PROOF</Text>
                      <Text style={styles.dossierHash} numberOfLines={1}>
                        {dep.deposit_txn_hash || dep.txn_hash || 'Pending On-Chain Proof'}
                      </Text>
                    </View>

                    {dep.deposit_proof_url ? (
                      <View style={[styles.dossierItemFull, { marginTop: 6 }]}>
                        <TouchableOpacity
                          style={styles.proofPreviewBtn}
                          onPress={() => {
                            setActiveProofUrl(dep.deposit_proof_url);
                            setProofLightboxVisible(true);
                          }}
                        >
                          <Feather name="image" size={13} color={colors.goldSoft} style={{ marginRight: 6 }} />
                          <Text style={{ color: colors.goldSoft, fontSize: 11, fontWeight: '700' }}>
                            Inspect Proof Screenshot
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  {isPending && (
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
              );
            })
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 4: WITHDRAWALS & PAYOUTS QUEUE
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'withdrawals' && (
        <View>
          <TextInput
            style={styles.searchInput}
            value={withdrawalSearchQuery}
            onChangeText={setWithdrawalSearchQuery}
            placeholder="Search by email, destination wallet address..."
            placeholderTextColor={colors.textDim}
          />

          {/* Status Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { id: 'PENDING', label: 'Pending Review' },
                { id: 'APPROVED', label: 'Approved & Paid' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'all', label: 'All Statuses' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, withdrawalFilter === f.id && styles.filterPillActive]}
                  onPress={() => setWithdrawalFilter(f.id)}
                >
                  <Text style={[styles.filterPillText, withdrawalFilter === f.id && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredWithdrawals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No withdrawal requests matching current filters.</Text>
            </View>
          ) : (
            filteredWithdrawals.map((wdr) => {
              const statusStr = String(wdr.status || '').toUpperCase();
              const isPending = statusStr === 'PENDING';
              const isCompleted = statusStr === 'COMPLETED' || statusStr === 'APPROVED';

              return (
                <View key={wdr.id} style={styles.dossierCard}>
                  <View style={styles.dossierHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dossierUser}>{wdr.user_full_name || wdr.user_email}</Text>
                      <Text style={styles.dossierEmail}>{wdr.user_email}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          borderColor: isCompleted
                            ? colors.accentGreenSoft
                            : isPending
                            ? colors.accentWarning
                            : colors.accentDanger,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: isCompleted
                              ? colors.accentGreenSoft
                              : isPending
                              ? colors.accentWarning
                              : colors.accentDanger,
                          },
                        ]}
                      >
                        {statusStr}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.dossierGrid}>
                    <View style={styles.dossierRow}>
                      <View style={styles.dossierItem}>
                        <Text style={styles.dossierLabel}>TYPE</Text>
                        <Text style={styles.dossierVal}>{wdr.withdrawal_type || 'PROFIT'}</Text>
                      </View>
                      <View style={styles.dossierItem}>
                        <Text style={styles.dossierLabel}>NET PAYOUT</Text>
                        <Text style={[styles.dossierVal, { color: colors.goldSoft }]}>
                          ${Number(wdr.net_amount || wdr.amount).toFixed(2)} USDT (Fee: ${Number(wdr.fee || 0).toFixed(2)})
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dossierItemFull}>
                      <Text style={styles.dossierLabel}>DESTINATION ({wdr.network || 'BEP20'})</Text>
                      <Text style={styles.dossierHash} numberOfLines={1}>
                        {wdr.wallet_address || 'Not Provided'}
                      </Text>
                    </View>
                  </View>

                  {isPending && (
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
                        <Text style={styles.btnApproveText}>Pay &amp; Broadcast</Text>
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
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 5: USER DIRECTORY & ACCESS CONTROL
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <View>
          <TextInput
            style={styles.searchInput}
            value={userSearchQuery}
            onChangeText={setUserSearchQuery}
            placeholder="Search name, email, username, ref code..."
            placeholderTextColor={colors.textDim}
          />

          {/* Role & KYC Filter Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { id: '', label: 'All Roles' },
                { id: 'ADMIN', label: 'Admin' },
                { id: 'USER', label: 'User' },
                { id: 'SUPPORT', label: 'Support' },
                { id: 'FINANCE', label: 'Finance' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.filterPill, userRoleFilter === r.id && styles.filterPillActive]}
                  onPress={() => setUserRoleFilter(r.id)}
                >
                  <Text style={[styles.filterPillText, userRoleFilter === r.id && styles.filterPillTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No user accounts found matching filters.</Text>
            </View>
          ) : (
            filteredUsers.map((u) => {
              const teamMembersCount = u.team_total_members !== undefined ? u.team_total_members : (u.direct_team_count || 0);
              const totalInvestedAmount = u.total_invested !== undefined ? u.total_invested : (u.total_deposited || 0);

              return (
                <View key={u.id} style={styles.userCard}>
                  <View style={styles.userCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.userName}>{u.first_name ? `${u.first_name} ${u.last_name}` : (u.username || u.email)}</Text>
                        <View
                          style={[
                            styles.roleBadge,
                            String(u.role || '').toUpperCase() === 'ADMIN'
                              ? styles.roleBadgeAdmin
                              : styles.roleBadgeUser,
                          ]}
                        >
                          <Text style={styles.roleBadgeText}>{(u.role || 'USER').toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.userEmail}>{u.email}</Text>
                      {(u.is_commission_bypassed || u.bypass_plan_and_level_requirements || String(u.role || '').toUpperCase() === 'ADMIN') && (
                        <View style={styles.unlimitedBadge}>
                          <Feather name="zap" size={10} color={colors.goldSoft} style={{ marginRight: 3 }} />
                          <Text style={styles.unlimitedBadgeText}>UNLIMITED EARNER (NO PLAN REQ)</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.userBalance}>${Number(u.wallet_balance || 0).toFixed(2)} USDT</Text>
                      <Text style={{ fontSize: 10, color: colors.textDim }}>Level {u.active_level || 1} • {u.kyc_status || 'UNVERIFIED'}</Text>
                    </View>
                  </View>

                  {/* 5-Level Financial Breakdown Strip */}
                  <View style={styles.userStatsMiniGrid}>
                    <View style={styles.userStatMiniItem}>
                      <Text style={styles.userStatMiniLabel}>INVESTED</Text>
                      <Text style={styles.userStatMiniVal}>${Number(totalInvestedAmount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.userStatMiniItem}>
                      <Text style={styles.userStatMiniLabel}>TOTAL ROI</Text>
                      <Text style={[styles.userStatMiniVal, { color: colors.goldSoft }]}>${Number(u.total_roi_earned || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.userStatMiniItem}>
                      <Text style={styles.userStatMiniLabel}>DIRECT INC</Text>
                      <Text style={[styles.userStatMiniVal, { color: colors.accentGreenSoft }]}>${Number(u.total_direct_income || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.userStatMiniItem}>
                      <Text style={styles.userStatMiniLabel}>TEAM</Text>
                      <Text style={styles.userStatMiniVal}>{teamMembersCount} members</Text>
                    </View>
                  </View>

                  {/* Action Buttons: Prominent Manage & Team (Matching Web Frontend) */}
                  <View style={styles.userCardActionRow}>
                    <TouchableOpacity
                      style={[styles.userActionBtn, styles.userActionBtnManage]}
                      onPress={() => handleOpenManageUserModal(u)}
                      activeOpacity={0.8}
                    >
                      <Feather name="settings" size={12} color="#030507" style={{ marginRight: 4 }} />
                      <Text style={styles.userActionBtnManageText}>Manage</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.userActionBtn}
                      onPress={() => handleOpenUserTeamModal(u)}
                      activeOpacity={0.8}
                    >
                      <Feather name="git-branch" size={12} color={colors.accentGreenSoft} style={{ marginRight: 4 }} />
                      <Text style={styles.userActionBtnText}>Team ({teamMembersCount})</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 6: HELPDESK & SUPPORT TICKETS
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'support' && (
        <View>
          <TextInput
            style={styles.searchInput}
            value={supportSearchQuery}
            onChangeText={setSupportSearchQuery}
            placeholder="Search ticket subject, user email..."
            placeholderTextColor={colors.textDim}
          />

          {/* Status Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { id: 'OPEN', label: 'Open' },
                { id: 'IN_PROGRESS', label: 'In Progress' },
                { id: 'RESOLVED', label: 'Resolved' },
                { id: 'CLOSED', label: 'Closed' },
                { id: 'all', label: 'All Tickets' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterPill, supportFilter === f.id && styles.filterPillActive]}
                  onPress={() => setSupportFilter(f.id)}
                >
                  <Text style={[styles.filterPillText, supportFilter === f.id && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredTickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: colors.textMuted }}>No support tickets matching filters.</Text>
            </View>
          ) : (
            filteredTickets.map((t) => (
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
            ))
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SUB-PAGE 7: RULES, PLANS & COMPANY WALLETS SETTINGS
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <View>
          {/* Automated ROI Batch Trigger (Matching Web Topbar Action) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>BATCH CALCULATION ENGINE</Text>
              <Text style={styles.cardTitle}>Automated Weekly ROI Trigger</Text>
            </View>

            <Text style={styles.roiDesc}>
              Calculates weekly yield returns for active investor plans and automatically disburses 5-level referral upline commissions.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={() => {
                  setRoiMode('full_week');
                  setRoiModalVisible(true);
                }}
              >
                <Feather name="zap" size={13} color="#030507" style={{ marginRight: 4 }} />
                <Text style={styles.btnPrimaryText}>Trigger Full Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => {
                  setRoiMode('by_day');
                  setRoiModalVisible(true);
                }}
              >
                <Feather name="calendar" size={13} color={colors.textMain} style={{ marginRight: 4 }} />
                <Text style={styles.btnSecondaryText}>Trigger By Day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Official Company Deposit Wallets Configuration */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>OFFICIAL RECEIVING CHANNELS</Text>
              <Text style={styles.cardTitle}>Company Deposit Wallets</Text>
            </View>

            <Text style={styles.label}>BSC (BEP20) Official Address</Text>
            <TextInput
              style={styles.input}
              value={companyWallets.bep20}
              onChangeText={(t) => setCompanyWallets({ ...companyWallets, bep20: t })}
              placeholder="0x..."
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>TRON (TRC20) Official Address</Text>
            <TextInput
              style={styles.input}
              value={companyWallets.trc20}
              onChangeText={(t) => setCompanyWallets({ ...companyWallets, trc20: t })}
              placeholder="T..."
              placeholderTextColor={colors.textDim}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveCompanyWallets}>
              <Text style={styles.btnPrimaryText}>Save Receiving Wallets</Text>
            </TouchableOpacity>
          </View>

          {/* Investment Plans Architecture List */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>TIER ARCHITECTURE</Text>
              <Text style={styles.cardTitle}>Active Investment Plans</Text>
            </View>

            {plansList.length === 0 ? (
              <Text style={styles.emptyNoticeText}>Loading platform tier plans...</Text>
            ) : (
              plansList.map((plan) => (
                <View key={plan.id} style={styles.planCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planSub}>
                      Cost: ${Number(plan.price || plan.cost || 0).toFixed(2)} • Capital: ${Number(plan.trading_capital || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planRoi}>{Number(plan.weekly_roi_percentage || plan.roi_percentage || 0).toFixed(2)}% ROI</Text>
                    <Text style={{ fontSize: 10, color: colors.textDim }}>Weekly yield</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Platform Business Rules & Caps */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>PARAMETERS</Text>
              <Text style={styles.cardTitle}>System Rules &amp; Caps</Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Maximum Return Cap</Text>
              <Text style={styles.ruleVal}>300.00% (Capital + ROI + Comm)</Text>
            </View>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleKey}>Direct Sales Commission (5 Levels)</Text>
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

      {/* ═══════════════════════════════════════════════════════════════
          MODALS & INSPECTORS
         ═══════════════════════════════════════════════════════════════ */}

      {/* COMPREHENSIVE MODAL: Manage User (Matching Frontend Manage User Modal) */}
      <Modal visible={manageUserModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>USER ACCOUNT DOSSIER</Text>
                  <Text style={styles.modalTitle}>
                    {selectedUser?.first_name ? `${selectedUser.first_name} ${selectedUser.last_name}` : (selectedUser?.username || selectedUser?.email)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>
                    {selectedUser?.email} • Sponsor Level {selectedUser?.active_level || 1}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setManageUserModalVisible(false)} style={{ padding: 4 }}>
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Current Wallet Balance Card */}
              <View style={styles.manageUserStatCard}>
                <View>
                  <Text style={{ fontSize: 10, color: colors.textDim, fontWeight: '700' }}>CURRENT WALLET BALANCE</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.goldSoft, marginTop: 2 }}>
                    ${Number(selectedUser?.wallet_balance || 0).toFixed(2)} USDT
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: colors.textDim, fontWeight: '700' }}>TOTAL INVESTED</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain, marginTop: 2 }}>
                    ${Number(selectedUser?.total_invested !== undefined ? selectedUser.total_invested : (selectedUser?.total_deposited || 0)).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.accentGreenSoft, fontWeight: '600', marginTop: 2 }}>
                    Team: {selectedUser?.team_total_members !== undefined ? selectedUser.team_total_members : (selectedUser?.direct_team_count || 0)} members
                  </Text>
                </View>
              </View>

              {/* 1. Role Selection */}
              <Text style={styles.label}>Account Role</Text>
              <View style={styles.toggleRow}>
                {['USER', 'ADMIN', 'SUPPORT', 'FINANCE'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.toggleBtn, manageUserRole === r && styles.toggleBtnActive]}
                    onPress={() => setManageUserRole(r)}
                  >
                    <Text style={[styles.toggleBtnText, manageUserRole === r && styles.toggleBtnTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. KYC Status & Actions */}
              <Text style={styles.label}>KYC Verification Status</Text>
              <View style={styles.toggleRow}>
                {[
                  { id: 'APPROVED', label: 'Approved' },
                  { id: 'IN_REVIEW', label: 'Review' },
                  { id: 'UNVERIFIED', label: 'Unverified' },
                  { id: 'REJECTED', label: 'Rejected' },
                ].map((k) => (
                  <TouchableOpacity
                    key={k.id}
                    style={[styles.toggleBtn, manageUserKyc === k.id && styles.toggleBtnActive]}
                    onPress={() => setManageUserKyc(k.id)}
                  >
                    <Text style={[styles.toggleBtnText, manageUserKyc === k.id && styles.toggleBtnTextActive]}>
                      {k.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick 1-Tap KYC Approve / Reject Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.btnApprove, { paddingVertical: 8 }]}
                  onPress={() => handleQuickKycStatus('APPROVED')}
                >
                  <Feather name="check-circle" size={12} color="#030507" style={{ marginRight: 4 }} />
                  <Text style={styles.btnApproveText}>Quick Approve KYC</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnReject, { paddingVertical: 8 }]}
                  onPress={() => handleQuickKycStatus('REJECTED')}
                >
                  <Feather name="x-circle" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.btnRejectText}>Reject KYC</Text>
                </TouchableOpacity>
              </View>

              {/* KYC Document Proof Review (if documents exist) */}
              {(selectedUser?.kyc_document_front_url || selectedUser?.kyc_document_back_url) && (
                <View style={styles.kycReviewBox}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.goldSoft, marginBottom: 6 }}>
                    Attached Government Identity Documents
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 8 }}>
                    {selectedUser?.kyc_document_type || 'ID Card'} • ID: {selectedUser?.kyc_document_number || 'N/A'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {selectedUser?.kyc_document_front_url && (
                      <TouchableOpacity
                        style={styles.kycDocThumbWrap}
                        onPress={() => {
                          setActiveProofUrl(selectedUser.kyc_document_front_url);
                          setProofLightboxVisible(true);
                        }}
                      >
                        <Image source={{ uri: selectedUser.kyc_document_front_url }} style={styles.kycDocThumb} />
                        <Text style={styles.kycDocThumbLabel}>Front (Tap to zoom)</Text>
                      </TouchableOpacity>
                    )}
                    {selectedUser?.kyc_document_back_url && (
                      <TouchableOpacity
                        style={styles.kycDocThumbWrap}
                        onPress={() => {
                          setActiveProofUrl(selectedUser.kyc_document_back_url);
                          setProofLightboxVisible(true);
                        }}
                      >
                        <Image source={{ uri: selectedUser.kyc_document_back_url }} style={styles.kycDocThumb} />
                        <Text style={styles.kycDocThumbLabel}>Back (Tap to zoom)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* 3. Unlimited Earning Privilege Switch */}
              <Text style={styles.label}>Privileges &amp; Flags</Text>
              <TouchableOpacity
                style={[
                  styles.bypassToggleBtn,
                  (manageUserBypass || manageUserRole === 'ADMIN') && styles.bypassToggleBtnActive,
                ]}
                onPress={() => {
                  if (manageUserRole !== 'ADMIN') {
                    setManageUserBypass(!manageUserBypass);
                  }
                }}
              >
                <Feather
                  name={(manageUserBypass || manageUserRole === 'ADMIN') ? 'check-circle' : 'circle'}
                  size={16}
                  color={(manageUserBypass || manageUserRole === 'ADMIN') ? colors.goldSoft : colors.textDim}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bypassToggleTitle}>
                    {(manageUserBypass || manageUserRole === 'ADMIN')
                      ? 'Unlimited Earning Enabled (Bypass Active)'
                      : 'Standard Plan & Direct Requirements'}
                  </Text>
                  <Text style={styles.bypassToggleDesc}>
                    Earns unlimited direct and ROI referral commissions from all 5 levels without needing active investments or direct sponsor unlock counts.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Account Status Switches: Email Verified & Active */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.statusTogglePill, manageUserEmailVerified && styles.statusTogglePillActive]}
                  onPress={() => setManageUserEmailVerified(!manageUserEmailVerified)}
                >
                  <Feather name={manageUserEmailVerified ? 'check-circle' : 'circle'} size={13} color={manageUserEmailVerified ? colors.accentGreenSoft : colors.textDim} style={{ marginRight: 6 }} />
                  <Text style={[styles.statusTogglePillText, manageUserEmailVerified && { color: colors.accentGreenSoft }]}>
                    Email Verified
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.statusTogglePill, manageUserActive && styles.statusTogglePillActive]}
                  onPress={() => setManageUserActive(!manageUserActive)}
                >
                  <Feather name={manageUserActive ? 'check-circle' : 'circle'} size={13} color={manageUserActive ? colors.accentGreenSoft : colors.textDim} style={{ marginRight: 6 }} />
                  <Text style={[styles.statusTogglePillText, manageUserActive && { color: colors.accentGreenSoft }]}>
                    Account Active
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4. Balance Adjustment Section */}
              <Text style={[styles.label, { marginTop: 14 }]}>Adjust Spendable Balance (Optional)</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, manageUserBalanceAction === 'CREDIT' && styles.toggleBtnActive]}
                  onPress={() => setManageUserBalanceAction('CREDIT')}
                >
                  <Text style={[styles.toggleBtnText, manageUserBalanceAction === 'CREDIT' && styles.toggleBtnTextActive]}>
                    + Credit Balance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, manageUserBalanceAction === 'DEBIT' && styles.toggleBtnActive]}
                  onPress={() => setManageUserBalanceAction('DEBIT')}
                >
                  <Text style={[styles.toggleBtnText, manageUserBalanceAction === 'DEBIT' && styles.toggleBtnTextActive]}>
                    - Debit Balance
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={manageUserBalanceAmount}
                onChangeText={setManageUserBalanceAmount}
                keyboardType="numeric"
                placeholder="Amount in USDT (leave empty if not adjusting)"
                placeholderTextColor={colors.textDim}
              />

              <TextInput
                style={styles.input}
                value={manageUserBalanceReason}
                onChangeText={setManageUserBalanceReason}
                placeholder="Adjustment description or audit reason"
                placeholderTextColor={colors.textDim}
              />

              {/* Save & Team Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setManageUserModalVisible(false)}
                >
                  <Text style={{ color: colors.textMuted }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalBtnConfirm}
                  onPress={handleSaveManageUserSubmit}
                >
                  <Text style={styles.modalBtnConfirmText}>Save Changes</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btnSecondary, { marginTop: 10 }]}
                onPress={() => {
                  setManageUserModalVisible(false);
                  if (selectedUser) handleOpenUserTeamModal(selectedUser);
                }}
              >
                <Feather name="git-branch" size={13} color={colors.goldSoft} style={{ marginRight: 6 }} />
                <Text style={[styles.btnSecondaryText, { color: colors.goldSoft }]}>
                  View 5-Level Downline Team Network ({selectedUser?.team_total_members !== undefined ? selectedUser.team_total_members : (selectedUser?.direct_team_count || 0)})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Corporate Funds Adjustment */}
      <Modal visible={adjustFundsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manual Treasury Adjustment</Text>
            <Text style={styles.label}>Operation Type</Text>
            <View style={styles.toggleRow}>
              {[
                { id: 'CREDIT', label: '+ Credit' },
                { id: 'DEBIT', label: '- Debit' },
                { id: 'GENERATE', label: '⚡ Generate' },
              ].map((btn) => (
                <TouchableOpacity
                  key={btn.id}
                  style={[styles.toggleBtn, adjustType === btn.id && styles.toggleBtnActive]}
                  onPress={() => setAdjustType(btn.id)}
                >
                  <Text style={[styles.toggleBtnText, adjustType === btn.id && styles.toggleBtnTextActive]}>
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              keyboardType="numeric"
              placeholder="Amount in USDT (e.g. 5000.00)"
              placeholderTextColor={colors.textDim}
            />
            <TextInput
              style={styles.input}
              value={adjustReason}
              onChangeText={setAdjustReason}
              placeholder="Description (e.g. Cold wallet replenishment)"
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setAdjustFundsModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleAdjustFundsSubmit}
              >
                <Text style={styles.modalBtnConfirmText}>Execute Adjustment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              placeholder="Enter on-chain payout transaction hash"
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

      {/* MODAL: Reject Withdrawal */}
      <Modal visible={rejectWdrModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject &amp; Refund Withdrawal</Text>
            <Text style={styles.label}>Rejection Reason *</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={wdrRejectReason}
              onChangeText={setWdrRejectReason}
              placeholder="e.g. Invalid destination wallet address"
              placeholderTextColor={colors.textDim}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRejectWdrModalVisible(false)}
              >
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: colors.accentDanger }]}
                onPress={handleRejectWithdrawalSubmit}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: User Downline Team Network (5 Levels) */}
      <Modal visible={userTeamModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', padding: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.modalTitle, { marginBottom: 2 }]}>
                  Team Network: {userTeamData?.user?.full_name || selectedUser?.full_name || selectedUser?.email}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 10.5 }}>
                  {userTeamData?.user?.email || selectedUser?.email} • Ref: {userTeamData?.user?.referral_code || selectedUser?.referral_code || 'N/A'} • Direct: Lvl {userTeamData?.user?.active_level ?? selectedUser?.active_level ?? 0} • ROI: Lvl {userTeamData?.user?.active_roi_level ?? selectedUser?.active_roi_level ?? 0}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setUserTeamModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {userTeamLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.goldSoft} size="large" />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 12 }}>
                  Loading 5-level downline hierarchy...
                </Text>
              </View>
            ) : !userTeamData ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Text style={{ color: colors.accentDanger, fontSize: 13, marginBottom: 8 }}>
                  Failed to load team data.
                </Text>
                <TouchableOpacity
                  style={[styles.modalBtnCancel, { width: 120 }]}
                  onPress={() => handleOpenUserTeamModal(selectedUser)}
                >
                  <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {/* 4 Summary Stat Cards */}
                <View style={styles.teamSummaryGrid}>
                  <View style={styles.teamSummaryRow}>
                    <View style={styles.teamSummaryCard}>
                      <Text style={styles.teamSummaryLabel} numberOfLines={1}>TOTAL REFERS (5 LVL)</Text>
                      <Text style={styles.teamSummaryValue} numberOfLines={1} adjustsFontSizeToFit>
                        {userTeamData.summary?.total_team_members || 0}
                      </Text>
                    </View>
                    <View style={styles.teamSummaryCard}>
                      <Text style={styles.teamSummaryLabel} numberOfLines={1}>TEAM INVESTMENT</Text>
                      <Text style={[styles.teamSummaryValue, { color: colors.goldSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                        ${Number(userTeamData.summary?.total_team_investment || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.teamSummaryRow}>
                    <View style={styles.teamSummaryCard}>
                      <Text style={styles.teamSummaryLabel} numberOfLines={1}>DIRECT INCOME</Text>
                      <Text style={[styles.teamSummaryValue, { color: colors.accentGreenSoft }]} numberOfLines={1} adjustsFontSizeToFit>
                        ${Number(userTeamData.summary?.total_direct_income || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.teamSummaryCard}>
                      <Text style={styles.teamSummaryLabel} numberOfLines={1}>REFERRAL ROI</Text>
                      <Text style={styles.teamSummaryValue} numberOfLines={1} adjustsFontSizeToFit>
                        ${Number(userTeamData.summary?.total_referral_roi_income || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Level Filter Tabs (All, Level 1..5) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        userTeamSelectedLevel === 'all' && styles.filterPillActive,
                      ]}
                      onPress={() => setUserTeamSelectedLevel('all')}
                    >
                      <Text style={[
                        styles.filterPillText,
                        userTeamSelectedLevel === 'all' && styles.filterPillTextActive,
                      ]}>
                        All Levels ({userTeamData.summary?.total_team_members || 0})
                      </Text>
                    </TouchableOpacity>
                    {(userTeamData.levels || []).map((lvl) => (
                      <TouchableOpacity
                        key={lvl.level}
                        style={[
                          styles.filterPill,
                          userTeamSelectedLevel === lvl.level && styles.filterPillActive,
                        ]}
                        onPress={() => setUserTeamSelectedLevel(lvl.level)}
                      >
                        <Text style={[
                          styles.filterPillText,
                          userTeamSelectedLevel === lvl.level && styles.filterPillTextActive,
                        ]}>
                          Level {lvl.level} ({lvl.total_refers || 0})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Level Breakdown & Member List */}
                {(() => {
                  const filteredLevels = (userTeamData.levels || []).filter((lvl) =>
                    userTeamSelectedLevel === 'all' ? true : lvl.level === userTeamSelectedLevel
                  );

                  const totalMembersAcross = userTeamData.summary?.total_team_members || 0;
                  if (totalMembersAcross === 0 && filteredLevels.every((l) => (l.total_refers || 0) === 0)) {
                    return (
                      <View style={[styles.emptyCard, { paddingVertical: 28 }]}>
                        <Feather name="users" size={32} color={colors.textDim} style={{ marginBottom: 8 }} />
                        <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>
                          No Downline Members Yet
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                          This user currently has no team members registered under any of the 5 referral levels.
                        </Text>
                      </View>
                    );
                  }

                  return filteredLevels.map((lvl) => {
                    const members = lvl.members || [];
                    return (
                      <View key={lvl.level} style={styles.teamLevelCard}>
                        {/* Level Header Strip */}
                        <View style={styles.teamLevelHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.levelNumberBadge}>
                              <Text style={styles.levelNumberBadgeText}>LVL {lvl.level}</Text>
                            </View>
                            <Text style={styles.teamLevelTitle}>
                              {lvl.total_refers || 0} {lvl.total_refers === 1 ? 'member' : 'members'}
                            </Text>
                          </View>
                          <Text style={styles.teamLevelInv}>
                            Vol: ${Number(lvl.total_investment || 0).toFixed(2)} USDT
                          </Text>
                        </View>

                        {/* Level Financial Row */}
                        <View style={styles.teamLevelFinanceRow}>
                          <Text style={styles.teamLevelFinanceItem}>
                            Direct Earned: <Text style={{ color: colors.accentGreenSoft, fontWeight: '700' }}>${Number(lvl.direct_income || 0).toFixed(2)}</Text>
                          </Text>
                          <Text style={styles.teamLevelFinanceItem}>
                            ROI Earned: <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>${Number(lvl.roi_income || 0).toFixed(2)}</Text>
                          </Text>
                        </View>

                        {/* Members in this level */}
                        {members.length === 0 ? (
                          <Text style={{ color: colors.textDim, fontSize: 11, fontStyle: 'italic', paddingVertical: 6 }}>
                            No downlines in Level {lvl.level}.
                          </Text>
                        ) : (
                          members.map((m) => (
                            <View key={m.id} style={styles.teamMemberItem}>
                              <View style={styles.teamMemberAvatar}>
                                <Text style={styles.teamMemberAvatarText}>
                                  {(m.full_name || m.email || 'U')[0].toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1, marginRight: 6 }}>
                                <Text style={styles.teamMemberName} numberOfLines={1}>
                                  {m.full_name || m.email}
                                </Text>
                                <Text style={styles.teamMemberEmail} numberOfLines={1}>
                                  {m.email}
                                </Text>
                                <Text style={styles.teamMemberJoined}>
                                  Joined: {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <View style={styles.memberRankBadge}>
                                  <Text style={styles.memberRankBadgeText}>
                                    Level {m.active_level || 0}
                                  </Text>
                                </View>
                                {m.active_roi_level > 0 && (
                                  <Text style={{ fontSize: 9, color: colors.goldSoft, marginTop: 2 }}>
                                    ROI Lvl {m.active_roi_level}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  });
                })()}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalBtnCancel, { marginTop: 12 }]}
              onPress={() => setUserTeamModalVisible(false)}
            >
              <Text style={{ color: colors.textMuted, textAlign: 'center', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Proof Screenshot Lightbox */}
      <Modal visible={proofLightboxVisible} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setProofLightboxVisible(false)}
          >
            <Feather name="x" size={24} color="#ffffff" />
          </TouchableOpacity>

          {activeProofUrl ? (
            <Image
              source={{ uri: activeProofUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ color: colors.textMuted }}>No proof image available.</Text>
          )}
        </View>
      </Modal>

      {/* MODAL: Trigger ROI Batch */}
      <Modal visible={roiModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Execute Automated ROI Yields</Text>
            <Text style={styles.roiDesc}>
              Select the calculation mode. This will credit weekly ROI directly to active investment plans and distribute referral upline commissions.
            </Text>

            <Text style={styles.label}>Execution Mode</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, roiMode === 'full_week' && styles.toggleBtnActive]}
                onPress={() => setRoiMode('full_week')}
              >
                <Text style={[styles.toggleBtnText, roiMode === 'full_week' && styles.toggleBtnTextActive]}>
                  Full Week (100% Yield)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, roiMode === 'by_day' && styles.toggleBtnActive]}
                onPress={() => setRoiMode('by_day')}
              >
                <Text style={[styles.toggleBtnText, roiMode === 'by_day' && styles.toggleBtnTextActive]}>
                  By Day (Mon–Fri)
                </Text>
              </TouchableOpacity>
            </View>

            {roiMode === 'by_day' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.label}>Select Day Period</Text>
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
              </View>
            )}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerTriggerRoiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerTriggerRoiBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#030507',
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
  tabBadge: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#030507',
  },
  metricGrid: {
    gap: 10,
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    minHeight: 74,
  },
  statCardFull: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 17,
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
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
  sectionDesc: {
    fontSize: 11.5,
    color: colors.textDim,
    lineHeight: 16,
    marginTop: 2,
  },
  viewAllLink: {
    fontSize: 11.5,
    color: colors.goldSoft,
    fontWeight: '700',
  },
  emptyNoticeText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 14,
  },
  miniQueueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  miniItemTitle: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 12.5,
  },
  miniItemSub: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  miniBtnPrimary: {
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  miniBtnPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11,
  },
  miniBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  miniBtnDangerText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 11,
  },
  miniBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  miniBtnGoldText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11,
  },
  liabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  liabilityLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  liabilityVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
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
    marginBottom: 10,
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
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 6,
  },
  btnSecondaryText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 13,
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
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  ledgerType: {
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
    color: colors.textDim,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 12.5,
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
    gap: 8,
  },
  dossierRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dossierItem: {
    flex: 1,
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
  proofPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(198, 153, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
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
  userStatsMiniGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  userStatMiniItem: {
    alignItems: 'center',
  },
  userStatMiniLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.textDim,
  },
  userStatMiniVal: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMain,
    marginTop: 1,
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
    paddingVertical: 8,
    borderRadius: 6,
  },
  userActionBtnText: {
    fontSize: 11.5,
    color: colors.textMain,
    fontWeight: '600',
  },
  userActionBtnManage: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  userActionBtnManageText: {
    fontSize: 11.5,
    color: '#030507',
    fontWeight: '800',
  },
  manageUserStatCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(198, 153, 61, 0.08)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  teamSummaryGrid: {
    gap: 8,
    marginBottom: 12,
  },
  teamSummaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  teamSummaryLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  teamSummaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMain,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  teamLevelCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  teamLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelNumberBadge: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelNumberBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  teamLevelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
  },
  teamLevelInv: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldSoft,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  teamLevelFinanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  teamLevelFinanceItem: {
    fontSize: 10.5,
    color: colors.textDim,
  },
  teamMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  teamMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(198, 153, 61, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  teamMemberAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  teamMemberName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textMain,
  },
  teamMemberEmail: {
    fontSize: 10,
    color: colors.textDim,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  teamMemberJoined: {
    fontSize: 9.5,
    color: colors.textDim,
    marginTop: 1,
  },
  memberRankBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  memberRankBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accentGreenSoft,
  },
  statusTogglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statusTogglePillActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusTogglePillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  kycReviewBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  kycDocThumbWrap: {
    flex: 1,
    alignItems: 'center',
  },
  kycDocThumb: {
    width: '100%',
    height: 70,
    borderRadius: 4,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  kycDocThumbLabel: {
    fontSize: 9.5,
    color: colors.goldSoft,
    fontWeight: '600',
    marginTop: 4,
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
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  planName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
  },
  planSub: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  planRoi: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.goldSoft,
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
  roleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderColor: colors.bgCardBorderGold,
  },
  roleBadgeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: colors.bgCardBorder,
  },
  roleBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.5,
  },
  unlimitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  unlimitedBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.accentGreenSoft,
    letterSpacing: 0.4,
  },
  bypassToggleBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  bypassToggleBtnActive: {
    backgroundColor: 'rgba(198, 153, 61, 0.1)',
    borderColor: colors.bgCardBorderGold,
  },
  bypassToggleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 2,
  },
  bypassToggleDesc: {
    fontSize: 10,
    color: colors.textDim,
    lineHeight: 14,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '100%',
    height: '75%',
  },
});
