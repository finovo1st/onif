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
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function KYCScreen({ onNavigate }) {
  const { user, updateKYCState } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State - Clean Live Defaults
  const [docType, setDocType] = useState('PASSPORT'); // 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'RESIDENCE_PERMIT'
  const [docNumber, setDocNumber] = useState('');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [country, setCountry] = useState(user?.kyc_country || user?.country || '');
  const [dob, setDob] = useState(user?.date_of_birth || '');
  const [frontDocName, setFrontDocName] = useState('');
  const [backDocName, setBackDocName] = useState('');
  const [frontDoc, setFrontDoc] = useState(null);
  const [backDoc, setBackDoc] = useState(null);

  const [kycProfile, setKycProfile] = useState({
    kyc_status: user?.kyc_status || 'UNVERIFIED', // 'APPROVED' | 'IN_REVIEW' | 'UNVERIFIED' | 'REJECTED'
    kyc_document_type: user?.kyc_document_type || 'PASSPORT',
    kyc_document_number: user?.kyc_document_number || '',
    kyc_country: user?.kyc_country || user?.country || '',
    kyc_rejection_reason: '',
  });

  const loadKYCStatus = async () => {
    try {
      const profile = await apiCall('/auth/profile/').catch(() => null);
      if (profile) {
        setKycProfile({
          kyc_status: profile.kyc_status || 'UNVERIFIED',
          kyc_document_type: profile.kyc_document_type || 'PASSPORT',
          kyc_document_number: profile.kyc_document_number || '',
          kyc_country: profile.kyc_country || profile.country || '',
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

  const pickDocumentImage = async (side) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access photo library is required to upload identity documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || asset.uri.split('/').pop() || `id_${side}_${Date.now()}.jpg`;
        const fileType = asset.mimeType || 'image/jpeg';
        const docItem = {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        };

        if (side === 'front') {
          setFrontDoc(docItem);
          setFrontDocName(fileName);
        } else {
          setBackDoc(docItem);
          setBackDocName(fileName);
        }
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Could not access image: ' + err.message);
    }
  };

  const handlePickFront = () => pickDocumentImage('front');
  const handlePickBack = () => pickDocumentImage('back');

  const handleKYCSubmit = async () => {
    if (!docNumber || !firstName || !lastName || !country) {
      Alert.alert('Validation Error', 'Please fill in your document number, first name, last name, and issuing country.');
      return;
    }
    if (!frontDoc || !backDoc) {
      Alert.alert('Documents Missing', 'Please select both front and back photos of your identity document.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('kyc_document_type', docType);
      formData.append('kyc_document_number', docNumber);
      formData.append('kyc_country', country);
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      if (dob) formData.append('date_of_birth', dob);

      formData.append('kyc_document_front', {
        uri: Platform.OS === 'android' ? frontDoc.uri : frontDoc.uri.replace('file://', ''),
        name: frontDoc.name,
        type: frontDoc.type,
      });
      formData.append('kyc_document_back', {
        uri: Platform.OS === 'android' ? backDoc.uri : backDoc.uri.replace('file://', ''),
        name: backDoc.name,
        type: backDoc.type,
      });

      await apiCall('/auth/kyc/', 'POST', formData, true);

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

  const getHeaderBadgeStyle = () => {
    if (status === 'APPROVED') return { bg: colors.badgeApprovedBg, border: colors.badgeApprovedBorder, text: colors.accentGreenSoft, label: 'APPROVED' };
    if (status === 'IN_REVIEW') return { bg: colors.badgePendingBg, border: colors.badgePendingBorder, text: colors.accentWarning, label: 'IN REVIEW' };
    if (status === 'REJECTED') return { bg: colors.badgeRejectedBg, border: colors.badgeRejectedBorder, text: colors.accentDanger, label: 'REJECTED' };
    return { bg: 'rgba(255,255,255,0.06)', border: colors.bgCardBorder, text: colors.textMuted, label: 'UNVERIFIED' };
  };

  const badgeStyle = getHeaderBadgeStyle();

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.eyebrow}>SECURITY &amp; REGULATORY COMPLIANCE</Text>
            <Text style={styles.screenTitle}>Identity Verification (KYC)</Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
            <Text style={[styles.headerBadgeText, { color: badgeStyle.text }]}>{badgeStyle.label}</Text>
          </View>
        </View>
        <Text style={styles.screenSubtitle}>
          To ensure AML compliance, identity safety, and platform protection, all investors must verify their government-issued identity before purchasing investment packages or activating fund deposits.
        </Text>
      </View>

      {/* 1. APPROVED STATE */}
      {status === 'APPROVED' && (
        <View style={styles.cardApproved}>
          <View style={styles.approvedHeroRow}>
            <View style={styles.approvedIconCircle}>
              <Feather name="shield" size={26} color={colors.accentGreenSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeApproved}>
                <Text style={styles.badgeApprovedText}>VERIFIED INVESTOR ACCOUNT</Text>
              </View>
              <Text style={styles.approvedTitle}>KYC Identity Verified</Text>
              <Text style={styles.approvedSubtitle}>
                Your government ID has been reviewed and verified by our compliance team. You have full access to all investment plans, deposits, weekly ROI earnings, and instant withdrawals.
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
              <Feather name="trending-up" size={14} color="#030507" style={{ marginRight: 4 }} />
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
              <Feather name="clock" size={26} color={colors.accentWarning} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgePending}>
                <Text style={styles.badgePendingText}>VERIFICATION IN REVIEW</Text>
              </View>
              <Text style={styles.approvedTitle}>KYC Submission Under Compliance Review</Text>
              <Text style={styles.approvedSubtitle}>
                Your document submission has been received. Our compliance team is currently reviewing your identity. Investment package purchases will unlock immediately upon approval.
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>SUBMITTED DOCUMENT</Text>
              <Text style={styles.detailVal}>{kycProfile.kyc_document_type}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DOCUMENT NUMBER</Text>
              <Text style={[styles.detailVal, { color: colors.goldSoft }]}>{kycProfile.kyc_document_number}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>REVIEW QUEUE</Text>
              <Text style={[styles.detailVal, { color: colors.goldSoft }]}>Priority Review Queue</Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. UNVERIFIED / REJECTED FORM STATE */}
      {(status === 'UNVERIFIED' || status === 'REJECTED') && (
        <View>
          {status === 'REJECTED' && (
            <View style={styles.rejectionCard}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Feather name="alert-circle" size={16} color="#f87171" />
                <Text style={styles.rejectionTitle}>Previous KYC Submission Was Rejected</Text>
              </View>
              <Text style={styles.rejectionDesc}>
                {kycProfile.kyc_rejection_reason || 'Your document could not be verified. Please review the requirements below and upload a clear, unexpired government-issued ID.'}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>STEP-BY-STEP VERIFICATION</Text>
              <Text style={styles.cardTitle}>Submit Verification Details</Text>
            </View>

            <Text style={styles.label}>Government Document Type *</Text>
            <View style={styles.docTypeToggleGrid}>
              <View style={styles.docTypeRow}>
                <TouchableOpacity
                  style={[styles.docTypeBtn, docType === 'PASSPORT' && styles.docTypeBtnActive]}
                  onPress={() => setDocType('PASSPORT')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.docTypeBtnText, docType === 'PASSPORT' && styles.docTypeBtnTextActive]}>
                    Passport
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.docTypeBtn, docType === 'NATIONAL_ID' && styles.docTypeBtnActive]}
                  onPress={() => setDocType('NATIONAL_ID')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.docTypeBtnText, docType === 'NATIONAL_ID' && styles.docTypeBtnTextActive]}>
                    National ID
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.docTypeRow}>
                <TouchableOpacity
                  style={[styles.docTypeBtn, docType === 'DRIVERS_LICENSE' && styles.docTypeBtnActive]}
                  onPress={() => setDocType('DRIVERS_LICENSE')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.docTypeBtnText, docType === 'DRIVERS_LICENSE' && styles.docTypeBtnTextActive]}>
                    Driver's License
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.docTypeBtn, docType === 'RESIDENCE_PERMIT' && styles.docTypeBtnActive]}
                  onPress={() => setDocType('RESIDENCE_PERMIT')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.docTypeBtnText, docType === 'RESIDENCE_PERMIT' && styles.docTypeBtnTextActive]}>
                    Residence ID
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Document Identification Number (ID / Passport No.) *</Text>
            <TextInput
              style={styles.input}
              value={docNumber}
              onChangeText={setDocNumber}
              placeholder="Enter document number"
              placeholderTextColor={colors.textDim}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Legal First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Legal Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Issuing Country *</Text>
                <TextInput
                  style={styles.input}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="Issuing country"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date of Birth</Text>
                <TextInput
                  style={styles.input}
                  value={dob}
                  onChangeText={setDob}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            {/* Front & Back Document Upload Dropzones */}
            <Text style={styles.label}>Document Verification Photos *</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.docDropzone, frontDoc && { borderColor: colors.accentGreenSoft, backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}
                onPress={handlePickFront}
                activeOpacity={0.7}
              >
                <Feather name={frontDoc ? "check-circle" : "upload-cloud"} size={20} color={frontDoc ? colors.accentGreenSoft : colors.goldSoft} />
                <Text style={[styles.dropzoneTitle, frontDoc && { color: colors.accentGreenSoft }]}>
                  {frontDoc ? 'Front Attached' : 'Front Photo'}
                </Text>
                <Text style={styles.dropzoneSub} numberOfLines={1}>
                  {frontDocName || 'Tap to choose photo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docDropzone, backDoc && { borderColor: colors.accentGreenSoft, backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}
                onPress={handlePickBack}
                activeOpacity={0.7}
              >
                <Feather name={backDoc ? "check-circle" : "upload-cloud"} size={20} color={backDoc ? colors.accentGreenSoft : colors.goldSoft} />
                <Text style={[styles.dropzoneTitle, backDoc && { color: colors.accentGreenSoft }]}>
                  {backDoc ? 'Back Attached' : 'Back Photo'}
                </Text>
                <Text style={styles.dropzoneSub} numberOfLines={1}>
                  {backDocName || 'Tap to choose photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleKYCSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#030507" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="shield" size={14} color="#030507" style={{ marginRight: 6 }} />
                  <Text style={styles.btnPrimaryText}>Submit Identity Documents for Verification</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* KYC Guidelines & Verification Criteria Card */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>DOCUMENT REQUIREMENTS</Text>
              <Text style={styles.cardTitle}>Verification Criteria</Text>
            </View>

            <View style={styles.criteriaItem}>
              <Feather name="check" size={15} color={colors.accentGreenSoft} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.criteriaTitle}>Government-Issued &amp; Valid</Text>
                <Text style={styles.criteriaDesc}>
                  Document must be an official government-issued ID (Passport, National ID, or Driver's License) with a valid expiration date.
                </Text>
              </View>
            </View>

            <View style={styles.criteriaItem}>
              <Feather name="check" size={15} color={colors.accentGreenSoft} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.criteriaTitle}>Clear &amp; Fully Legible</Text>
                <Text style={styles.criteriaDesc}>
                  All four corners must be visible with no blur, glare, reflections, or cropped edges. Text and photo must be crisp.
                </Text>
              </View>
            </View>

            <View style={styles.criteriaItem}>
              <Feather name="check" size={15} color={colors.accentGreenSoft} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.criteriaTitle}>Original &amp; Unaltered</Text>
                <Text style={styles.criteriaDesc}>
                  Photoshopped images, black-and-white photocopies, or edited photos will be rejected by the compliance review team.
                </Text>
              </View>
            </View>

            <View style={styles.privacyNoticeBox}>
              <Text style={styles.privacyNoticeText}>
                <Text style={{ color: colors.goldSoft, fontWeight: '700' }}>Privacy &amp; Encryption: </Text>
                Your identity documents are stored in an encrypted vault and accessed solely for regulatory compliance purposes.
              </Text>
            </View>
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
  headerBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
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
    padding: 14,
    marginBottom: 16,
  },
  rejectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f87171',
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
    gap: 8,
    marginBottom: 10,
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  docTypeBtn: {
    flex: 1,
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
  docDropzone: {
    flex: 1,
    backgroundColor: '#0E131A',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bgCardBorderGold,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textMain,
    marginTop: 4,
  },
  dropzoneSub: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  criteriaItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  criteriaTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textMain,
  },
  criteriaDesc: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  privacyNoticeBox: {
    backgroundColor: 'rgba(198, 153, 61, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  privacyNoticeText: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 16,
  },
});

