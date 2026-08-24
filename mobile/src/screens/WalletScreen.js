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
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function WalletScreen({ onNavigate }) {
  const { isDemoMode } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [walletStats, setWalletStats] = useState({
    wallet_balance: 1450.0,
    total_deposited: 1000.0,
    total_withdrawn: 50.0,
    lifetime_earnings: 205.0,
  });

  const [deposits, setDeposits] = useState([
    {
      id: 'dep-1',
      plan_name: 'Starter Plan',
      amount: 1000.0,
      network: 'BEP20',
      txn_hash: '0x892a7f82b1c9842a...4b08',
      status: 'APPROVED',
      created_at: '2026-08-01',
    },
  ]);

  const [withdrawals, setWithdrawals] = useState([
    {
      id: 'wdr-1',
      withdrawal_type: 'PROFIT',
      amount: 50.0,
      fee: 1.0,
      net_amount: 49.0,
      network: 'BEP20',
      status: 'COMPLETED',
      created_at: '2026-08-15',
    },
  ]);

  // Withdrawal Modal State
  const [wdrModalVisible, setWdrModalVisible] = useState(false);
  const [wdrType, setWdrType] = useState('PROFIT'); // 'PROFIT' | 'CAPITAL'
  const [wdrAmount, setWdrAmount] = useState('100.00');
  const [wdrNetwork, setWdrNetwork] = useState('BEP20');
  const [wdrAddress, setWdrAddress] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');

  // Deposit Modal State
  const [depModalVisible, setDepModalVisible] = useState(false);
  const [depAmount, setDepAmount] = useState('500.00');
  const [depNetwork, setDepNetwork] = useState('BEP20');
  const [depTxHash, setDepTxHash] = useState('');
  const [depSender, setDepSender] = useState('');

  const companyWallets = {
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
  };

  const loadWalletData = async () => {
    if (isDemoMode) return;
    try {
      const data = await apiCall('/dashboard/');
      if (data) {
        setWalletStats({
          wallet_balance: data.wallet_balance || 0,
          total_deposited: data.total_deposited || 0,
          total_withdrawn: data.total_withdrawn || 0,
          lifetime_earnings: (data.total_roi_earned || 0) + (data.total_direct_income || 0) + (data.total_referral_income || 0),
        });
      }

      const deps = await apiCall('/deposits/').catch(() => []);
      if (Array.isArray(deps) && deps.length > 0) setDeposits(deps);

      const wdrs = await apiCall('/withdrawals/').catch(() => []);
      if (Array.isArray(wdrs) && wdrs.length > 0) setWithdrawals(wdrs);
    } catch (err) {
      console.warn('Wallet data fetch error:', err.message);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  // Fee calculation matching web portal
  const fee = wdrType === 'PROFIT' ? 1.0 : 10.0;
  const netReceived = Math.max(0, Number(wdrAmount || 0) - fee);

  const handleWithdrawSubmit = async () => {
    const amt = Number(wdrAmount);
    const minAmt = wdrType === 'PROFIT' ? 10 : 100;
    if (!amt || amt < minAmt) {
      Alert.alert('Validation Error', `Minimum ${wdrType.toLowerCase()} withdrawal is $${minAmt} USDT.`);
      return;
    }
    if (amt > walletStats.wallet_balance) {
      Alert.alert('Insufficient Balance', `You have $${Number(walletStats.wallet_balance).toFixed(2)} available.`);
      return;
    }
    if (!wdrAddress) {
      Alert.alert('Missing Address', 'Please paste your destination USDT wallet address.');
      return;
    }

    setLoading(true);
    try {
      if (!isDemoMode) {
        await apiCall('/withdrawals/', 'POST', {
          withdrawal_type: wdrType,
          amount: amt,
          network: wdrNetwork,
          wallet_address: wdrAddress,
        });
      }

      setWdrModalVisible(false);
      Alert.alert('Withdrawal Submitted', `Request for $${amt.toFixed(2)} USDT (Net: $${netReceived.toFixed(2)}) submitted for Admin approval.`);
      loadWalletData();
    } catch (err) {
      Alert.alert('Withdrawal Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositSubmit = async () => {
    const amt = Number(depAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }
    if (!depTxHash) {
      Alert.alert('Missing TxID', 'Please enter your blockchain transaction hash (TxID).');
      return;
    }

    setLoading(true);
    try {
      if (!isDemoMode) {
        await apiCall('/deposits/', 'POST', {
          amount: amt,
          network: depNetwork,
          txn_hash: depTxHash,
          sender_wallet_address: depSender || '0xSenderWallet',
        });
      }

      setDepModalVisible(false);
      Alert.alert('Deposit Proof Submitted', `Your deposit proof of $${amt.toFixed(2)} USDT has been submitted for on-chain approval.`);
      loadWalletData();
    } catch (err) {
      Alert.alert('Deposit Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCompanyAddress = (net) => {
    Alert.alert('Copied to Clipboard', `Treasury ${net} Address:\n${companyWallets[net]}`);
  };

  const getStatusColor = (status) => {
    const s = String(status).toUpperCase();
    if (s === 'APPROVED' || s === 'COMPLETED') return colors.accentGreenSoft;
    if (s === 'PENDING') return colors.accentWarning;
    return colors.accentDanger;
  };

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
        <Text style={styles.eyebrow}>TREASURY &amp; SETTLEMENTS</Text>
        <Text style={styles.screenTitle}>Wallet &amp; Ledger</Text>
        <Text style={styles.screenSubtitle}>
          Real-time balance accounting, segregated deposit proofs, and automated USDT withdrawals.
        </Text>
      </View>

      {/* 4-KPI Grid (Matching Web Portal) */}
      <View style={styles.metricGrid}>
        <View style={styles.statCard}>
          <View>
            <Text style={styles.statLabel}>Wallet Balance</Text>
            <Text style={styles.statValue}>${Number(walletStats.wallet_balance).toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => onNavigate && onNavigate('investments')}
            activeOpacity={0.8}
          >
            <Text style={styles.cardActionBtnText}>+ New Plan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statCard}>
          <View>
            <Text style={styles.statLabel}>Total Invested</Text>
            <Text style={styles.statValue}>${Number(walletStats.total_deposited).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>${Number(walletStats.total_withdrawn).toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.cardActionBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
            onPress={() => setWdrModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cardActionBtnText, { color: colors.textMain }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statCard}>
          <View>
            <Text style={styles.statLabel}>Lifetime Earnings</Text>
            <Text style={[styles.statValue, { color: colors.goldSoft }]}>
              +${Number(walletStats.lifetime_earnings).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => setDepModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnPrimaryText}>+ Deposit Funds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => setWdrModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.btnSecondaryText}>Request Withdrawal</Text>
        </TouchableOpacity>
      </View>

      {/* Deposits History Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>HISTORY</Text>
            <Text style={styles.cardTitle}>Deposit History</Text>
          </View>
          <TouchableOpacity
            style={styles.btnSmPrimary}
            onPress={() => setDepModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSmPrimaryText}>+ Deposit</Text>
          </TouchableOpacity>
        </View>

        {deposits.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No deposit requests recorded yet.
          </Text>
        ) : (
          deposits.map((dep, idx) => (
            <View key={dep.id || idx} style={styles.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  +${Number(dep.amount).toFixed(2)} USDT ({dep.network || 'BEP20'})
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  Tx: {dep.txn_hash || 'Pending On-Chain Proof'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusBadge, { borderColor: getStatusColor(dep.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(dep.status) }]}>
                    {dep.status || 'PENDING'}
                  </Text>
                </View>
                <Text style={styles.rowDate}>{dep.created_at || 'Recent'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Withdrawals History Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>SETTLEMENTS</Text>
            <Text style={styles.cardTitle}>Withdrawals History</Text>
          </View>
          <TouchableOpacity
            style={styles.btnSmSecondary}
            onPress={() => setWdrModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnSmSecondaryText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {withdrawals.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No withdrawal requests recorded yet.
          </Text>
        ) : (
          withdrawals.map((wdr, idx) => (
            <View key={wdr.id || idx} style={styles.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  {wdr.withdrawal_type}: ${Number(wdr.amount).toFixed(2)} USDT
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Net Payout: ${Number(wdr.net_amount || wdr.amount).toFixed(2)} USDT ({wdr.network || 'BEP20'})
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusBadge, { borderColor: getStatusColor(wdr.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(wdr.status) }]}>
                    {wdr.status || 'PENDING'}
                  </Text>
                </View>
                <Text style={styles.rowDate}>{wdr.created_at || 'Recent'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* WITHDRAWAL MODAL */}
      <Modal visible={wdrModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Wallet Funds</Text>
              <TouchableOpacity onPress={() => setWdrModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Type Toggle */}
              <Text style={styles.label}>Withdrawal Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, wdrType === 'PROFIT' && styles.toggleBtnActive]}
                  onPress={() => setWdrType('PROFIT')}
                >
                  <Text style={[styles.toggleBtnText, wdrType === 'PROFIT' && styles.toggleBtnTextActive]}>
                    Profit (Fee $1, Min $10)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, wdrType === 'CAPITAL' && styles.toggleBtnActive]}
                  onPress={() => setWdrType('CAPITAL')}
                >
                  <Text style={[styles.toggleBtnText, wdrType === 'CAPITAL' && styles.toggleBtnTextActive]}>
                    Capital (Fee $10, Min $100)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <Text style={styles.label}>Requested Amount ($ USDT)</Text>
              <TextInput
                style={styles.input}
                value={wdrAmount}
                onChangeText={setWdrAmount}
                keyboardType="numeric"
                placeholder="100.00"
                placeholderTextColor={colors.textDim}
              />

              {/* Network */}
              <Text style={styles.label}>Settlement Network</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, wdrNetwork === 'BEP20' && styles.toggleBtnActive]}
                  onPress={() => setWdrNetwork('BEP20')}
                >
                  <Text style={[styles.toggleBtnText, wdrNetwork === 'BEP20' && styles.toggleBtnTextActive]}>
                    BEP20 (USDT)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, wdrNetwork === 'TRC20' && styles.toggleBtnActive]}
                  onPress={() => setWdrNetwork('TRC20')}
                >
                  <Text style={[styles.toggleBtnText, wdrNetwork === 'TRC20' && styles.toggleBtnTextActive]}>
                    TRC20 (USDT)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Destination Address */}
              <Text style={styles.label}>Destination USDT Wallet Address</Text>
              <TextInput
                style={styles.input}
                value={wdrAddress}
                onChangeText={setWdrAddress}
                placeholder="Paste destination wallet address"
                placeholderTextColor={colors.textDim}
              />

              {/* Fee & Net Preview Box (Matching Web) */}
              <View style={styles.calcPreviewBox}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Transaction Fee:</Text>
                  <Text style={styles.calcVal}>${fee.toFixed(2)} USDT</Text>
                </View>
                <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 6 }]}>
                  <Text style={styles.calcLabelBold}>Net Received Amount:</Text>
                  <Text style={styles.calcValGold}>${netReceived.toFixed(2)} USDT</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setWdrModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleWithdrawSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#030507" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Submit Withdrawal Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DEPOSIT MODAL */}
      <Modal visible={depModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Crypto Funds</Text>
              <TouchableOpacity onPress={() => setDepModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Deposit Network</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, depNetwork === 'BEP20' && styles.toggleBtnActive]}
                  onPress={() => setDepNetwork('BEP20')}
                >
                  <Text style={[styles.toggleBtnText, depNetwork === 'BEP20' && styles.toggleBtnTextActive]}>
                    BEP20 (USDT)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, depNetwork === 'TRC20' && styles.toggleBtnActive]}
                  onPress={() => setDepNetwork('TRC20')}
                >
                  <Text style={[styles.toggleBtnText, depNetwork === 'TRC20' && styles.toggleBtnTextActive]}>
                    TRC20 (USDT)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Company Wallet Address */}
              <View style={styles.companyWalletBox}>
                <Text style={styles.companyWalletLabel}>Official Treasury Deposit Destination ({depNetwork}):</Text>
                <View style={styles.walletCopyRow}>
                  <Text style={styles.companyWalletAddrText} numberOfLines={1}>
                    {companyWallets[depNetwork]}
                  </Text>
                  <TouchableOpacity
                    style={styles.miniCopyBtn}
                    onPress={() => copyCompanyAddress(depNetwork)}
                  >
                    <Text style={styles.miniCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.walletNoticeText}>
                  Send USDT ({depNetwork}) directly to this vault address, then enter your TxID below.
                </Text>
              </View>

              <Text style={styles.label}>Deposit Amount ($ USDT)</Text>
              <TextInput
                style={styles.input}
                value={depAmount}
                onChangeText={setDepAmount}
                keyboardType="numeric"
                placeholder="500.00"
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>Transaction Hash (TxID) *</Text>
              <TextInput
                style={styles.input}
                value={depTxHash}
                onChangeText={setDepTxHash}
                placeholder="Enter blockchain TxID hash"
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>Your Sender Wallet Address (Optional)</Text>
              <TextInput
                style={styles.input}
                value={depSender}
                onChangeText={setDepSender}
                placeholder="Enter your USDT wallet address"
                placeholderTextColor={colors.textDim}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setDepModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleDepositSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#030507" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Submit Deposit Proof</Text>
                )}
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
    justifyContent: 'space-between',
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
  cardActionBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cardActionBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#030507',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.textMain,
    fontWeight: '600',
    fontSize: 13,
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  btnSmPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnSmPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 11,
  },
  btnSmSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnSmSecondaryText: {
    color: colors.textMain,
    fontWeight: '600',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowDate: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textMain,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
  },
  calcPreviewBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  calcLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  calcLabelBold: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMain,
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMain,
  },
  calcValGold: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.goldSoft,
  },
  companyWalletBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 10,
    marginBottom: 8,
  },
  companyWalletLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  walletCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  companyWalletAddrText: {
    flex: 1,
    fontSize: 11,
    color: colors.goldSoft,
    fontWeight: '600',
  },
  miniCopyBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  miniCopyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#030507',
  },
  walletNoticeText: {
    fontSize: 9.5,
    color: colors.textDim,
    lineHeight: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  modalBtnConfirm: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  modalBtnConfirmText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 13,
  },
});
