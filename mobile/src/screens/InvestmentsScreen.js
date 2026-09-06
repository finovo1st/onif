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
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

const DEFAULT_TIERS = [
  {
    id: 'package-1',
    name: 'Package 1',
    cost: 120,
    trading_capital: 100,
    max_return_factor: 3,
    max_total_return: 350,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
  },
  {
    id: 'package-2',
    name: 'Package 2',
    cost: 350,
    trading_capital: 300,
    max_return_factor: 3,
    max_total_return: 1000,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
    is_popular: true,
  },
  {
    id: 'package-3',
    name: 'Package 3',
    cost: 575,
    trading_capital: 500,
    max_return_factor: 3,
    max_total_return: 1700,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
  },
  {
    id: 'package-4',
    name: 'Package 4',
    cost: 1100,
    trading_capital: 1000,
    max_return_factor: 3,
    max_total_return: 3300,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
  },
  {
    id: 'package-5',
    name: 'Package 5',
    cost: 5500,
    trading_capital: 5000,
    max_return_factor: 3,
    max_total_return: 16500,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
  },
  {
    id: 'package-6',
    name: 'Package 6',
    cost: 11000,
    trading_capital: 10000,
    max_return_factor: 3,
    max_total_return: 33000,
    weekly_roi_rate: 2.0,
    duration_weeks: 0,
  },
];

export default function InvestmentsScreen({ onNavigate }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [plans, setPlans] = useState(DEFAULT_TIERS);
  const [investments, setInvestments] = useState([]);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [investAmount, setInvestAmount] = useState('');
  const [depositNetwork, setDepositNetwork] = useState('BEP20');
  const [txHash, setTxHash] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  // Platform treasury deposit addresses
  const [companyWallets, setCompanyWallets] = useState({
    BEP20: '0x71C8bf7B67295F2797e883FffFa7617bFF524b08',
    TRC20: 'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',
  });

  const loadPlansAndInvestments = async () => {
    try {
      const fetchedPlans = await apiCall('/investments/plans/').catch(() => []);
      const planList = Array.isArray(fetchedPlans) ? fetchedPlans : (fetchedPlans?.results || []);
      if (planList.length > 0) {
        setPlans(planList);
      } else {
        setPlans(DEFAULT_TIERS);
      }

      const fetchedInvestments = await apiCall('/investments/').catch(() => []);
      const invList = Array.isArray(fetchedInvestments) ? fetchedInvestments : (fetchedInvestments?.results || []);
      setInvestments(invList);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlansAndInvestments();
    setRefreshing(false);
  };

  const openInvestModal = (plan) => {
    const cost = Number(plan.cost || plan.package_cost || plan.minimum_amount || 120);
    setSelectedPlan(plan);
    setInvestAmount(String(cost));
    setTxHash('');
    setSenderAddress('');
    setProofFileName('');
    setProofFile(null);
    setModalVisible(true);
  };

  const handlePickProof = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access photo library is required to select payment receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || asset.uri.split('/').pop() || `deposit_receipt_${Date.now()}.jpg`;
        const fileType = asset.mimeType || 'image/jpeg';
        setProofFile({
          uri: asset.uri,
          name: fileName,
          type: fileType,
        });
        setProofFileName(fileName);
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Could not select image: ' + err.message);
    }
  };

  const handleConfirmInvestment = async () => {
    const cost = Number(selectedPlan?.cost || selectedPlan?.package_cost || investAmount || 120);
    if (!txHash && !proofFile) {
      Alert.alert('Missing Deposit Proof', 'Please enter your blockchain transaction hash (TxID) or upload a payment screenshot.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('plan', selectedPlan.id);
      formData.append('cost', String(cost));
      formData.append('amount', String(cost));
      formData.append('deposit_network', depositNetwork);
      formData.append('network', depositNetwork);
      if (txHash) {
        formData.append('deposit_txn_hash', txHash);
        formData.append('txn_hash', txHash);
      }
      if (senderAddress) {
        formData.append('deposit_sender_address', senderAddress);
        formData.append('sender_wallet_address', senderAddress);
      }
      if (proofFile) {
        formData.append('deposit_proof', {
          uri: Platform.OS === 'android' ? proofFile.uri : proofFile.uri.replace('file://', ''),
          name: proofFile.name,
          type: proofFile.type,
        });
      }

      await apiCall('/investments/', 'POST', formData, true);

      setModalVisible(false);
      setProofFile(null);
      setProofFileName('');
      setTxHash('');
      setSenderAddress('');
      Alert.alert(
        'Investment Submitted',
        `Deposit proof for $${cost.toFixed(2)} USDT (${selectedPlan.name}) submitted successfully. Admin compliance desk will verify on-chain and activate your plan.`
      );
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.goldSoft} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PACKAGES &amp; TIERS</Text>
        <Text style={styles.screenTitle}>Institutional Investment Plans</Text>
        <Text style={styles.screenSubtitle}>
          Choose your desired investment tier, complete USDT deposit to platform treasury, and receive trading capital allocation upon confirmation.
        </Text>
      </View>

      {/* KYC Lock Banner (Shown if user is unverified) */}
      {!isKycApproved && (
        <View style={styles.kycLockCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kycLockTitle}>Identity Verification Required to Buy Plans</Text>
            <Text style={styles.kycLockDesc}>
              You must complete your KYC identity verification before you can invest in packages or activate deposits.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.kycLockBtn}
            onPress={() => onNavigate && onNavigate('kyc')}
            activeOpacity={0.8}
          >
            <Text style={styles.kycLockBtnText}>Verify Identity (KYC)</Text>
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
          <Text style={styles.guideStepBold}>Step 1:</Text> Choose a plan &amp; review terms →{' '}
          <Text style={styles.guideStepBold}>Step 2:</Text> Send exact USDT to platform treasury wallet and paste TxID hash →{' '}
          <Text style={styles.guideStepBold}>Step 3:</Text> Admin verifies deposit and activates plan →{' '}
          <Text style={styles.guideStepBold}>Step 4:</Text> Weekly automated ROI credited to your wallet.
        </Text>
      </View>

      {/* Luxury Package Tier Cards Grid */}
      {plans.map((plan, idx) => {
        const pkgNum = plan.name ? (plan.name.replace(/[^0-9]/g, '') || (idx + 1)) : (idx + 1);
        const cost = Number(plan.cost || plan.package_cost || plan.minimum_amount || 120);
        const tradingCap = Number(plan.trading_capital || cost);
        const maxFactor = Number(plan.max_return_factor || 3);
        const maxReturn = Number(plan.max_total_return || (tradingCap * maxFactor));
        const profitCap = `${maxFactor}X`;
        const duration = plan.duration_weeks ? `${plan.duration_weeks} WEEKS` : 'FLEXIBLE';
        const isPopular = plan.is_popular;

        return (
          <View key={plan.id || idx} style={[styles.pkgCard, isPopular && styles.pkgCardPopular]}>
            {/* Top Right Gold Ribbon */}
            <View style={styles.pkgRibbon}>
              <Text style={styles.pkgRibbonSub}>PACKAGE</Text>
              <Text style={styles.pkgRibbonNum}>{pkgNum}</Text>
            </View>

            {/* Header: Brand Logo & Tagline */}
            <View style={styles.pkgHeader}>
              <View style={styles.pkgBrandRow}>
                <View style={styles.pkgLogoIconWrap}>
                  <Feather name="layers" size={15} color={colors.goldSoft} />
                </View>
                <Text style={styles.pkgBrandTitle}>FINOVO</Text>
              </View>
              <Text style={styles.pkgBrandTagline}>Trade Smart. Grow Together.</Text>
            </View>

            {/* Subheading */}
            <Text style={styles.pkgSubheading}>INVESTMENT PLAN</Text>

            {/* Main Invest -> You Get (Max) Box */}
            <View style={styles.pkgInvestBox}>
              <View style={styles.pkgInvestCol}>
                <Text style={styles.pkgInvestLbl}>INVEST</Text>
                <Text style={styles.pkgInvestVal}>${cost.toLocaleString()}</Text>
              </View>
              <View style={styles.pkgArrowWrap}>
                <Text style={styles.pkgArrow}>➔</Text>
              </View>
              <View style={styles.pkgInvestCol}>
                <Text style={styles.pkgInvestLbl}>YOU GET (MAX)</Text>
                <Text style={[styles.pkgInvestVal, styles.pkgInvestValGold]}>${maxReturn.toLocaleString()}</Text>
              </View>
            </View>

            {/* 3-Column Stats Row */}
            <View style={styles.pkgStatsRow}>
              <View style={styles.pkgStatItem}>
                <Feather name="shield" size={13} color={colors.goldSoft} style={styles.pkgStatIcon} />
                <View>
                  <Text style={styles.pkgStatTitle}>TRADING CAPITAL</Text>
                  <Text style={styles.pkgStatValue}>${tradingCap.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.pkgStatItem}>
                <Feather name="trending-up" size={13} color={colors.goldSoft} style={styles.pkgStatIcon} />
                <View>
                  <Text style={styles.pkgStatTitle}>PROFIT CAP</Text>
                  <Text style={styles.pkgStatValue}>{profitCap}</Text>
                </View>
              </View>
              <View style={styles.pkgStatItem}>
                <Feather name="clock" size={13} color={colors.goldSoft} style={styles.pkgStatIcon} />
                <View>
                  <Text style={styles.pkgStatTitle}>DURATION</Text>
                  <Text style={styles.pkgStatValue}>{duration}</Text>
                </View>
              </View>
            </View>

            {/* Profit Payout Gold Banner */}
            <View style={styles.pkgPayoutBanner}>
              <Text style={styles.pkgPayoutBannerText}>PROFIT PAYOUT : WEEKLY</Text>
            </View>

            {/* Trust Badges Row */}
            <View style={styles.pkgTrustRow}>
              <View style={styles.pkgTrustItem}>
                <Feather name="check-circle" size={11} color={colors.goldSoft} />
                <Text style={styles.pkgTrustText}>SECURE PLATFORM</Text>
              </View>
              <View style={styles.pkgTrustItem}>
                <Feather name="eye" size={11} color={colors.goldSoft} />
                <Text style={styles.pkgTrustText}>TRANSPARENT</Text>
              </View>
              <View style={styles.pkgTrustItem}>
                <Feather name="headphones" size={11} color={colors.goldSoft} />
                <Text style={styles.pkgTrustText}>24/7 SUPPORT</Text>
              </View>
            </View>

            {/* Deploy Capital Action Button */}
            <TouchableOpacity
              style={styles.btnInvest}
              onPress={() => openInvestModal(plan)}
              activeOpacity={0.85}
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
                  {inv.plan_name || 'Package'}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  Credited: ${Number(inv.total_credited || 0).toFixed(2)} / Max: ${Number(inv.max_return || (Number(inv.amount || inv.cost || 120) * 3)).toFixed(2)}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 2 }}>
                  Started: {inv.created_at ? String(inv.created_at).slice(0, 10) : 'Recent'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700', fontSize: 14 }}>
                  ${Number(inv.cost || inv.amount || 120).toFixed(2)}
                </Text>
                <Text
                  style={{
                    color: inv.status === 'ACTIVE' ? colors.accentGreenSoft : inv.status === 'PENDING' || inv.status === 'DEPOSIT_PENDING' ? colors.accentWarning : colors.textDim,
                    fontSize: 10,
                    fontWeight: '700',
                    marginTop: 2,
                  }}
                >
                  {inv.status ? inv.status.replace('_', ' ') : 'ACTIVE'}
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

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* Step 1: Package Overview */}
              <Text style={styles.stepTitle}>STEP 1 — PACKAGE OVERVIEW</Text>
              <View style={styles.step1Box}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Selected Package:</Text>
                  <Text style={styles.previewValGold}>{selectedPlan?.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Package Purchase Cost:</Text>
                  <Text style={styles.previewValGold}>
                    ${Number(selectedPlan?.cost || selectedPlan?.package_cost || investAmount || 120).toFixed(2)} USDT
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Trading Capital Allocation:</Text>
                  <Text style={{ color: colors.accentGreenSoft, fontWeight: '700', fontSize: 12 }}>
                    ${Number(selectedPlan?.trading_capital || selectedPlan?.cost || 100).toFixed(2)} USDT
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Profit Cap Multiplier:</Text>
                  <Text style={styles.previewVal}>{selectedPlan?.max_return_factor || 3}X (300%)</Text>
                </View>
                <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 6 }]}>
                  <Text style={styles.previewLabel}>Maximum Total Return (Max):</Text>
                  <Text style={{ color: colors.goldSoft, fontWeight: '800', fontSize: 13 }}>
                    ${Number(selectedPlan?.max_total_return || (Number(selectedPlan?.trading_capital || 100) * (selectedPlan?.max_return_factor || 3))).toFixed(2)} USDT
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Profit Distribution:</Text>
                  <Text style={styles.previewVal}>Weekly Automated</Text>
                </View>
              </View>

              {/* Step 2: Send Crypto & Provide Proof */}
              <Text style={styles.stepTitle}>STEP 2 — SEND CRYPTO &amp; PROVIDE PROOF</Text>
              <Text style={styles.step2Desc}>
                Send the exact package amount (${Number(selectedPlan?.cost || selectedPlan?.package_cost || investAmount || 120).toFixed(2)} USDT) to the platform treasury wallet, then paste your transaction hash below.
              </Text>

              {/* Network Toggle */}
              <Text style={styles.label}>Deposit Network *</Text>
              <View style={styles.networkToggleRow}>
                <TouchableOpacity
                  style={[styles.networkBtn, depositNetwork === 'BEP20' && styles.networkBtnActive]}
                  onPress={() => setDepositNetwork('BEP20')}
                >
                  <Text style={[styles.networkBtnText, depositNetwork === 'BEP20' && styles.networkBtnTextActive]}>
                    BEP20 (Binance Smart Chain - USDT)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.networkBtn, depositNetwork === 'TRC20' && styles.networkBtnActive]}
                  onPress={() => setDepositNetwork('TRC20')}
                >
                  <Text style={[styles.networkBtnText, depositNetwork === 'TRC20' && styles.networkBtnTextActive]}>
                    TRC20 (TRON - USDT)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Company Wallet Destination Box with QR */}
              <View style={styles.companyWalletBox}>
                <View style={styles.walletBoxTop}>
                  <Text style={styles.companyWalletLabel}>Official Deposit Destination ({depositNetwork}):</Text>
                  <View style={styles.badgeNetwork}>
                    <Text style={styles.badgeNetworkText}>USDT {depositNetwork}</Text>
                  </View>
                </View>

                <View style={styles.walletCopyRow}>
                  <Text style={styles.companyWalletAddrText} numberOfLines={1}>
                    {companyWallets[depositNetwork]}
                  </Text>
                  <TouchableOpacity style={styles.miniCopyBtn} onPress={copyAddress}>
                    <Feather name="copy" size={11} color="#030507" style={{ marginRight: 3 }} />
                    <Text style={styles.miniCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.qrZoomRow}
                  onPress={() => setLightboxVisible(true)}
                  activeOpacity={0.7}
                >
                  <Feather name="maximize-2" size={12} color={colors.goldSoft} />
                  <Text style={styles.qrZoomText}>Tap to enlarge Deposit QR Code</Text>
                </TouchableOpacity>

                <Text style={styles.walletNoticeText}>
                  Send only <Text style={{ color: colors.textMain, fontWeight: '700' }}>USDT ({depositNetwork})</Text> to this address. Funds are verified by compliance before activation.
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
                autoCapitalize="none"
              />

              <Text style={styles.label}>Your Sender Wallet Address (Optional)</Text>
              <TextInput
                style={styles.input}
                value={senderAddress}
                onChangeText={setSenderAddress}
                placeholder="Enter your sender USDT wallet address"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Upload Payment Screenshot (Optional)</Text>
              <TouchableOpacity
                style={[styles.uploadBox, proofFile && { borderColor: colors.accentGreenSoft, backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}
                onPress={handlePickProof}
                activeOpacity={0.7}
              >
                <Feather name={proofFile ? "check-circle" : "upload-cloud"} size={16} color={proofFile ? colors.accentGreenSoft : colors.goldSoft} style={{ marginRight: 6 }} />
                <Text style={[styles.uploadBoxText, proofFile && { color: colors.accentGreenSoft, fontWeight: '600' }]}>
                  {proofFileName ? `Attached: ${proofFileName}` : 'Select Screenshot (JPG, PNG)'}
                </Text>
              </TouchableOpacity>
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

      {/* QR Code Lightbox Modal */}
      <Modal visible={lightboxVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxVisible(false)}
        >
          <View style={styles.lightboxCard}>
            <Text style={styles.lightboxTitle}>Deposit QR Code ({depositNetwork})</Text>
            <View style={styles.qrPlaceholder}>
              <Feather name="grid" size={90} color={colors.goldSoft} />
            </View>
            <Text style={styles.lightboxAddr} numberOfLines={2}>
              {companyWallets[depositNetwork]}
            </Text>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setLightboxVisible(false)}>
              <Text style={styles.lightboxCloseBtnText}>Close Window</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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

  /* Luxury Package Card Styles */
  pkgCard: {
    backgroundColor: '#090D14',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  pkgCardPopular: {
    borderColor: 'rgba(247, 213, 122, 0.55)',
    backgroundColor: '#0A0F18',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  pkgRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderBottomLeftRadius: 12,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: 'center',
  },
  pkgRibbonSub: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pkgRibbonNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  pkgHeader: {
    marginBottom: 4,
  },
  pkgBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pkgLogoIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgBrandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.goldSoft,
    letterSpacing: 1.2,
  },
  pkgBrandTagline: {
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  pkgSubheading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  pkgInvestBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pkgInvestCol: {
    flex: 1,
  },
  pkgInvestLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pkgInvestVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  pkgInvestValGold: {
    color: colors.goldSoft,
  },
  pkgArrowWrap: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgArrow: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  pkgStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  pkgStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  pkgStatIcon: {
    marginRight: 1,
  },
  pkgStatTitle: {
    fontSize: 7.5,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pkgStatValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  pkgPayoutBanner: {
    backgroundColor: 'rgba(198, 153, 61, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.45)',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pkgPayoutBannerText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.goldSoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pkgTrustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.15)',
    marginBottom: 10,
  },
  pkgTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pkgTrustText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  btnInvest: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnInvestText: {
    color: '#030507',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
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
  step2Desc: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 10,
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
    flexDirection: 'column',
    gap: 6,
    marginBottom: 10,
  },
  networkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    fontSize: 11,
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
    padding: 12,
    marginBottom: 8,
  },
  walletBoxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  companyWalletLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  badgeNetwork: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeNetworkText: {
    fontSize: 9.5,
    color: colors.accentGreenSoft,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
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
  qrZoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
    paddingVertical: 4,
  },
  qrZoomText: {
    fontSize: 11,
    color: colors.goldSoft,
    fontWeight: '600',
  },
  walletNoticeText: {
    fontSize: 9.5,
    color: colors.textDim,
    lineHeight: 14,
    marginTop: 4,
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
  uploadBox: {
    backgroundColor: '#0E131A',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bgCardBorderGold,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxText: {
    fontSize: 11.5,
    color: colors.goldSoft,
    fontWeight: '600',
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
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lightboxCard: {
    backgroundColor: '#070A0E',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  lightboxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  lightboxAddr: {
    fontSize: 11,
    color: colors.goldSoft,
    textAlign: 'center',
    marginBottom: 16,
  },
  lightboxCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  lightboxCloseBtnText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 12,
  },
});
