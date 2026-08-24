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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function InvestmentsScreen({ onNavigate }) {
  const { user, isDemoMode } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const [plans, setPlans] = useState([
    {
      id: 'starter',
      name: 'Starter Tier',
      package_cost: 100,
      trading_capital: 100,
      weekly_roi_rate: 2.5,
      minimum_amount: 100,
      maximum_amount: 1000,
      max_return_cap: 300,
    },
    {
      id: 'pro',
      name: 'Pro Trader Tier',
      package_cost: 1000,
      trading_capital: 1000,
      weekly_roi_rate: 3.5,
      minimum_amount: 1000,
      maximum_amount: 5000,
      max_return_cap: 300,
      is_popular: true,
    },
    {
      id: 'elite',
      name: 'Elite Institutional',
      package_cost: 5000,
      trading_capital: 5000,
      weekly_roi_rate: 4.5,
      minimum_amount: 5000,
      maximum_amount: 25000,
      max_return_cap: 300,
    },
    {
      id: 'whale',
      name: 'Whale Multi-Strategy',
      package_cost: 10000,
      trading_capital: 10000,
      weekly_roi_rate: 5.0,
      minimum_amount: 10000,
      maximum_amount: 50000,
      max_return_cap: 300,
    },
  ]);

  const [investments, setInvestments] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [investAmount, setInvestAmount] = useState('100');
  const [depositNetwork, setDepositNetwork] = useState('BEP20');
  const [txHash, setTxHash] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Platform treasury deposit addresses
  const [companyWallets, setCompanyWallets] = useState({
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
  });

  const loadPlansAndInvestments = async () => {
    if (isDemoMode) return;
    try {
      const fetchedPlans = await apiCall('/investments/plans/').catch(() => []);
      if (Array.isArray(fetchedPlans) && fetchedPlans.length > 0) setPlans(fetchedPlans);

      const fetchedInvestments = await apiCall('/investments/').catch(() => []);
      if (Array.isArray(fetchedInvestments)) setInvestments(fetchedInvestments);

      const walletData = await apiCall('/dashboard/deposit-wallets/').catch(() => null);
      if (walletData) {
        setCompanyWallets({
          BEP20: walletData.BEP20 || companyWallets.BEP20,
          TRC20: walletData.TRC20 || companyWallets.TRC20,
        });
      }
    } catch (err) {
      console.warn('Investments load error:', err.message);
    }
  };

  useEffect(() => {
    loadPlansAndInvestments();
  }, []);

  const openInvestModal = (plan) => {
    setSelectedPlan(plan);
    setInvestAmount(String(plan.package_cost || plan.minimum_amount || 100));
    setTxHash('');
    setSenderAddress('');
    setModalVisible(true);
  };

  const handleConfirmInvestment = async () => {
    const amt = Number(investAmount);
    if (!amt || amt < (selectedPlan?.minimum_amount || 100)) {
      Alert.alert('Invalid Amount', `Minimum allocation for ${selectedPlan?.name} is $${selectedPlan?.minimum_amount || 100} USDT.`);
      return;
    }
    if (!txHash) {
      Alert.alert('Missing TxID', 'Please enter your blockchain transaction hash (TxID) to submit deposit proof.');
      return;
    }

    setLoading(true);
    try {
      if (!isDemoMode) {
        await apiCall('/investments/', 'POST', {
          plan: selectedPlan.id,
          amount: amt,
          network: depositNetwork,
          txn_hash: txHash,
          sender_wallet_address: senderAddress || '0xUserMobileSender',
        });
      }

      setModalVisible(false);
      Alert.alert('Investment Submitted', `Deposit proof for $${amt.toFixed(2)} USDT submitted successfully. Admin will verify on-chain and activate your plan.`);
      loadPlansAndInvestments();
    } catch (err) {
      Alert.alert('Investment Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    const addr = companyWallets[depositNetwork];
    Alert.alert('Copied to Clipboard', `Company ${depositNetwork} Deposit Address:\n${addr}`);
  };

  const isKycApproved = user?.kyc_status === 'APPROVED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PACKAGES &amp; TIERS</Text>
        <Text style={styles.screenTitle}>Institutional Investment Plans</Text>
        <Text style={styles.screenSubtitle}>
          Choose your investment tier, complete USDT deposit to treasury, and receive trading capital allocation upon confirmation.
        </Text>
      </View>

      {/* KYC Lock Banner (Shown if user is unverified) */}
      {!isKycApproved && (
        <View style={styles.kycLockCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kycLockTitle}>Identity Verification (KYC) Required</Text>
            <Text style={styles.kycLockDesc}>
              Complete your KYC identity verification to unlock full capital deployment and automated weekly ROI distributions.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.kycLockBtn}
            onPress={() => onNavigate && onNavigate('kyc')}
            activeOpacity={0.8}
          >
            <Text style={styles.kycLockBtnText}>Verify KYC →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* How Investment Works 4-Step Guide */}
      <View style={styles.guideCard}>
        <View style={styles.guideHeaderRow}>
          <Feather name="zap" size={14} color={colors.goldSoft} />
          <Text style={styles.guideTitle}>How Investment Works</Text>
        </View>
        <Text style={styles.guideStep}>
          <Text style={styles.guideStepBold}>1. Choose Tier:</Text> Select an institutional plan and amount.
        </Text>
        <Text style={styles.guideStep}>
          <Text style={styles.guideStepBold}>2. Send USDT:</Text> Transfer crypto to the verified treasury wallet address.
        </Text>
        <Text style={styles.guideStep}>
          <Text style={styles.guideStepBold}>3. Admin Verifies:</Text> Your transaction hash is verified on-chain.
        </Text>
        <Text style={styles.guideStep}>
          <Text style={styles.guideStepBold}>4. Automated Yield:</Text> Weekly ROI and referral income are credited directly.
        </Text>
      </View>

      {/* Package Tier Cards Grid */}
      {plans.map((plan) => {
        const isPopular = plan.is_popular;
        return (
          <View key={plan.id} style={[styles.planCard, isPopular && styles.planCardPopular]}>
            {isPopular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
              </View>
            )}

            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.roiRow}>
              <Text style={styles.planRoi}>{Number(plan.weekly_roi_rate).toFixed(2)}%</Text>
              <Text style={styles.planRoiSub}> / weekly ROI</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Package Cost</Text>
              <Text style={styles.featureValue}>${Number(plan.package_cost || plan.minimum_amount).toFixed(2)} USDT</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Trading Capital</Text>
              <Text style={[styles.featureValue, { color: colors.accentGreenSoft }]}>
                ${Number(plan.trading_capital || plan.package_cost || plan.minimum_amount).toFixed(2)} USDT
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Max Cumulative Return</Text>
              <Text style={[styles.featureValue, { color: colors.goldSoft }]}>
                300.00% Profit Cap
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Payout Schedule</Text>
              <Text style={styles.featureValue}>Weekly Automated</Text>
            </View>

            <TouchableOpacity
              style={styles.btnInvest}
              onPress={() => openInvestModal(plan)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnInvestText}>Deploy Capital →</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* My Investments History */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Investments History</Text>
        </View>

        {investments.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No investments recorded yet.
          </Text>
        ) : (
          investments.map((inv, idx) => (
            <View key={inv.id || idx} style={styles.invRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>
                  {inv.plan_name || 'Tier'}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  Credited: ${Number(inv.total_credited || 0).toFixed(2)} / Max: ${Number(inv.max_return || inv.amount * 3).toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 14 }}>
                  ${Number(inv.amount).toFixed(2)}
                </Text>
                <Text style={{ color: colors.accentGreenSoft, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                  {inv.status || 'ACTIVE'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 2-Step Buy Investment Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buy Investment Plan</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Step 1: Package Overview */}
              <Text style={styles.stepTitle}>STEP 1 — PACKAGE OVERVIEW</Text>
              <View style={styles.step1Box}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Selected Package:</Text>
                  <Text style={styles.previewValGold}>{selectedPlan?.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Weekly ROI Rate:</Text>
                  <Text style={styles.previewValGold}>{Number(selectedPlan?.weekly_roi_rate || 0).toFixed(2)}% / wk</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Allocation Amount ($):</Text>
                  <Text style={styles.previewVal}>${Number(investAmount || 0).toFixed(2)} USDT</Text>
                </View>
                <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 6 }]}>
                  <Text style={styles.previewLabel}>300% Maximum Return Cap:</Text>
                  <Text style={{ color: colors.accentGreenSoft, fontWeight: '800' }}>
                    ${(Number(investAmount || 0) * 3).toFixed(2)} USDT
                  </Text>
                </View>
              </View>

              {/* Step 2: Send Crypto & Provide Proof */}
              <Text style={styles.stepTitle}>STEP 2 — SEND CRYPTO &amp; PROVIDE PROOF</Text>

              {/* Network Toggle */}
              <Text style={styles.label}>Deposit Network</Text>
              <View style={styles.networkToggleRow}>
                <TouchableOpacity
                  style={[styles.networkBtn, depositNetwork === 'BEP20' && styles.networkBtnActive]}
                  onPress={() => setDepositNetwork('BEP20')}
                >
                  <Text style={[styles.networkBtnText, depositNetwork === 'BEP20' && styles.networkBtnTextActive]}>
                    BEP20 (USDT)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.networkBtn, depositNetwork === 'TRC20' && styles.networkBtnActive]}
                  onPress={() => setDepositNetwork('TRC20')}
                >
                  <Text style={[styles.networkBtnText, depositNetwork === 'TRC20' && styles.networkBtnTextActive]}>
                    TRC20 (USDT)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Company Wallet Box */}
              <View style={styles.companyWalletBox}>
                <Text style={styles.companyWalletLabel}>Official Treasury Deposit Address ({depositNetwork}):</Text>
                <View style={styles.walletCopyRow}>
                  <Text style={styles.companyWalletAddrText} numberOfLines={1}>
                    {companyWallets[depositNetwork]}
                  </Text>
                  <TouchableOpacity style={styles.miniCopyBtn} onPress={copyAddress}>
                    <Text style={styles.miniCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.walletNoticeText}>
                  Send exact amount in USDT ({depositNetwork}). Verified by admin on-chain.
                </Text>
              </View>

              {/* Inputs */}
              <Text style={styles.label}>Transaction Hash (TxID) *</Text>
              <TextInput
                style={styles.input}
                value={txHash}
                onChangeText={setTxHash}
                placeholder="Enter blockchain TxID hash"
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>Your Sender Wallet Address (Optional)</Text>
              <TextInput
                style={styles.input}
                value={senderAddress}
                onChangeText={setSenderAddress}
                placeholder="Enter your USDT wallet address"
                placeholderTextColor={colors.textDim}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleConfirmInvestment}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#030507" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Submit Proof &amp; Activate</Text>
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
  kycLockCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kycLockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f87171',
    marginBottom: 3,
  },
  kycLockDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  kycLockBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kycLockBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  guideCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  guideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
  },
  guideStep: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 18,
    marginVertical: 1,
  },
  guideStepBold: {
    color: colors.textMain,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginBottom: 16,
    position: 'relative',
  },
  planCardPopular: {
    borderColor: colors.bgCardBorderGold,
    backgroundColor: 'rgba(14, 19, 26, 0.95)',
  },
  popularBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMain,
  },
  roiRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 6,
  },
  planRoi: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: -0.5,
  },
  planRoiSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  featureLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  featureValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMain,
  },
  btnInvest: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  btnInvestText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    marginTop: 4,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
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
  stepTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
  },
  step1Box: {
    backgroundColor: 'rgba(198, 153, 61, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  previewLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  previewVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMain,
  },
  previewValGold: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  networkToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  networkBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  networkBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
  },
  networkBtnText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  networkBtnTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
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
  input: {
    backgroundColor: '#0E131A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 10,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: 6,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
