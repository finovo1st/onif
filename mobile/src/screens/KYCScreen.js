import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function KYCScreen({ onNavigate }) {
  const { user, updateKYCState, isDemoMode } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [docType, setDocType] = useState('PASSPORT'); // 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'RESIDENCE_PERMIT'
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState(`${user?.first_name || ''} ${user?.last_name || ''}`.trim());
  const [country, setCountry] = useState('United Kingdom');

  const [kycProfile, setKycProfile] = useState({
    kyc_status: user?.kyc_status || 'UNVERIFIED', // 'APPROVED' | 'IN_REVIEW' | 'UNVERIFIED' | 'REJECTED'
    kyc_document_type: user?.kyc_document_type || 'PASSPORT',
    kyc_document_number: user?.kyc_document_number || 'P9842104A',
    kyc_country: user?.kyc_country || 'United Kingdom',
    kyc_rejection_reason: '',
  });

  const loadKYCStatus = async () => {
    if (isDemoMode) return;
    try {
      const profile = await apiCall('/auth/profile/').catch(() => null);
      if (profile) {
        setKycProfile({
          kyc_status: profile.kyc_status || 'UNVERIFIED',
          kyc_document_type: profile.kyc_document_type || 'PASSPORT',
          kyc_document_number: profile.kyc_document_number || '',
          kyc_country: profile.kyc_country || 'United Kingdom',
          kyc_rejection_reason: profile.kyc_rejection_reason || '',
        });
        updateKYCState(profile);
      }
    } catch (err) {
      console.warn('KYC load error:', err.message);
    }
  };

  useEffect(() => {
    loadKYCStatus();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadKYCStatus();
    setRefreshing(false);
  };

  const handleKYCSubmit = async () => {
    if (!docNumber || !fullName || !country) {
      Alert.alert('Validation Error', 'Please fill in your document number, full legal name, and country.');
      return;
    }

    setLoading(true);
    try {
      if (!isDemoMode) {
        await apiCall('/auth/kyc/', 'POST', {
          kyc_document_type: docType,
          kyc_document_number: docNumber,
          kyc_country: country,
          first_name: fullName.split(' ')[0] || user?.first_name,
          last_name: fullName.split(' ').slice(1).join(' ') || user?.last_name,
        });
      }

      setKycProfile({
        kyc_status: 'IN_REVIEW',
        kyc_document_type: docType,
        kyc_document_number: docNumber,
        kyc_country: country,
        kyc_rejection_reason: '',
      });
      updateKYCState({
        kyc_status: 'IN_REVIEW',
        kyc_document_type: docType,
        kyc_document_number: docNumber,
        kyc_country: country,
      });

      Alert.alert('Submission Received', 'Your identity documents have been submitted to our compliance desk for verification.');
    } catch (err) {
      Alert.alert('KYC Submission Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const status = kycProfile.kyc_status || 'UNVERIFIED';

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
        <Text style={styles.eyebrow}>SECURITY &amp; COMPLIANCE</Text>
        <Text style={styles.screenTitle}>Identity Verification (KYC)</Text>
        <Text style={styles.screenSubtitle}>
          To ensure AML compliance and platform protection, all investors must verify government-issued identity before purchasing investment packages.
        </Text>
      </View>

      {/* 1. APPROVED STATE */}
      {status === 'APPROVED' && (
        <View style={styles.cardApproved}>
          <View style={styles.approvedHeroRow}>
            <View style={styles.approvedIconCircle}>
              <Feather name="shield" size={24} color={colors.accentGreenSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeApproved}>
                <Text style={styles.badgeApprovedText}>VERIFIED INVESTOR</Text>
              </View>
              <Text style={styles.approvedTitle}>KYC Identity Verified</Text>
              <Text style={styles.approvedSubtitle}>
                Your identity has been reviewed and approved. Full capital deployment, deposits, and instant withdrawals are active.
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DOCUMENT TYPE</Text>
              <Text style={styles.detailVal}>{kycProfile.kyc_document_type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DOCUMENT ID NUMBER</Text>
              <Text style={[styles.detailVal, { color: colors.goldSoft }]}>{kycProfile.kyc_document_number}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>COUNTRY</Text>
              <Text style={styles.detailVal}>{kycProfile.kyc_country}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>VERIFIED STATUS</Text>
              <Text style={[styles.detailVal, { color: colors.accentGreenSoft }]}>Level 1 Verified</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => onNavigate && onNavigate('investments')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnPrimaryText}>Purchase Investment Plan →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => onNavigate && onNavigate('wallet')}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSecondaryText}>View Wallet &amp; Ledger</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. IN_REVIEW STATE */}
      {status === 'IN_REVIEW' && (
        <View style={styles.cardPending}>
          <View style={styles.approvedHeroRow}>
            <View style={styles.pendingIconCircle}>
              <Feather name="clock" size={24} color={colors.accentWarning} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgePending}>
                <Text style={styles.badgePendingText}>VERIFICATION IN REVIEW</Text>
              </View>
              <Text style={styles.approvedTitle}>Compliance Review in Progress</Text>
              <Text style={styles.approvedSubtitle}>
                Your document submission is in the compliance queue. Tier investment and withdrawals will unlock immediately upon review.
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DOCUMENT TYPE</Text>
              <Text style={styles.detailVal}>{kycProfile.kyc_document_type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DOCUMENT ID</Text>
              <Text style={[styles.detailVal, { color: colors.goldSoft }]}>{kycProfile.kyc_document_number}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>REVIEW STATUS</Text>
              <Text style={[styles.detailVal, { color: colors.accentWarning }]}>Priority Review Queue</Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. UNVERIFIED / REJECTED FORM STATE */}
      {(status === 'UNVERIFIED' || status === 'REJECTED') && (
        <View>
          {status === 'REJECTED' && (
            <View style={styles.rejectionCard}>
              <Text style={styles.rejectionTitle}>Previous Submission Rejected</Text>
              <Text style={styles.rejectionDesc}>
                {kycProfile.kyc_rejection_reason || 'Document could not be verified. Please submit a valid, clear government-issued ID.'}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>STEP-BY-STEP VERIFICATION</Text>
              <Text style={styles.cardTitle}>Submit Identity Details</Text>
            </View>

            <Text style={styles.label}>Government Document Type *</Text>
            <View style={styles.docTypeToggleGrid}>
              {[
                { id: 'PASSPORT', label: 'Passport' },
                { id: 'NATIONAL_ID', label: 'National ID' },
                { id: 'DRIVERS_LICENSE', label: "Driver's License" },
                { id: 'RESIDENCE_PERMIT', label: 'Residence ID' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.docTypeBtn, docType === item.id && styles.docTypeBtnActive]}
                  onPress={() => setDocType(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.docTypeBtnText, docType === item.id && styles.docTypeBtnTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Document Identification Number *</Text>
            <TextInput
              style={styles.input}
              value={docNumber}
              onChangeText={setDocNumber}
              placeholder="e.g. P9842104A or 1234-5678-9012"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>Full Legal Name (as on document) *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Alice Jane Smith"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>Country of Residence *</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="United Kingdom"
              placeholderTextColor={colors.textDim}
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleKYCSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <Text style={styles.btnPrimaryText}>Submit Verification Details →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  cardApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  cardPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  approvedHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  approvedIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeApproved: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeApprovedText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentGreenSoft,
    letterSpacing: 0.6,
  },
  badgePending: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgePendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentWarning,
    letterSpacing: 0.6,
  },
  approvedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMain,
    marginBottom: 2,
  },
  approvedSubtitle: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
  },
  detailsGrid: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 12,
    color: colors.textMain,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 8,
  },
  btnPrimary: {
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
  rejectionCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  rejectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f87171',
    marginBottom: 2,
  },
  rejectionDesc: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  docTypeToggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  docTypeBtn: {
    width: '48.5%',
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  docTypeBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
  },
  docTypeBtnText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  docTypeBtnTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
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
});
