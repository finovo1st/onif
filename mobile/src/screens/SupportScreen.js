import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiCall } from '../config/api';
import colors from '../theme/colors';

export default function SupportScreen({ onNavigate }) {
  const { isDemoMode } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL'); // 'GENERAL' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFERRAL'
  const [message, setMessage] = useState('');

  const [tickets, setTickets] = useState([
    {
      id: 't-1',
      subject: 'Deposit Confirmation Assistance',
      category: 'DEPOSIT',
      status: 'OPEN',
      created_at: '2026-08-18',
      messages: [
        {
          id: 'm-1',
          sender_name: 'Alice Smith',
          is_staff: false,
          message: 'Hello, I submitted a deposit of $1000 USDT on BEP20 with hash 0x892a...4b08. Can you confirm activation?',
          created_at: '2026-08-18 10:24',
        },
        {
          id: 'm-2',
          sender_name: 'Compliance Desk',
          is_staff: true,
          message: 'Hi Alice, our desk is currently verifying on bscscan. It will be credited within 10 minutes.',
          created_at: '2026-08-18 10:32',
        },
      ],
    },
    {
      id: 't-2',
      subject: 'Referral Level 2 Inquiry',
      category: 'REFERRAL',
      status: 'RESOLVED',
      created_at: '2026-08-10',
      messages: [
        {
          id: 'm-3',
          sender_name: 'Alice Smith',
          is_staff: false,
          message: 'How many active downline members are required to unlock Level 3 ROI?',
          created_at: '2026-08-10 14:10',
        },
        {
          id: 'm-4',
          sender_name: 'Finovo Support',
          is_staff: true,
          message: 'Level 3 requires 6 active direct referrals with an active investment plan.',
          created_at: '2026-08-10 14:22',
        },
      ],
    },
  ]);

  // Thread Modal State
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [threadModalVisible, setThreadModalVisible] = useState(false);

  const loadTickets = async () => {
    if (isDemoMode) return;
    try {
      const data = await apiCall('/support/tickets/').catch(() => []);
      if (Array.isArray(data) && data.length > 0) setTickets(data);
    } catch (err) {
      console.warn('Support ticket load error:', err.message);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  };

  const handleSubmitTicket = async () => {
    if (!subject || !message) {
      Alert.alert('Validation Error', 'Please enter a ticket subject and message.');
      return;
    }

    setLoading(true);
    try {
      if (!isDemoMode) {
        await apiCall('/support/tickets/', 'POST', {
          subject,
          category,
          message,
        });
      } else {
        const newT = {
          id: `t-${Date.now()}`,
          subject,
          category,
          status: 'OPEN',
          created_at: 'Just now',
          messages: [
            {
              id: `m-${Date.now()}`,
              sender_name: 'You',
              is_staff: false,
              message,
              created_at: 'Just now',
            },
          ],
        };
        setTickets([newT, ...tickets]);
      }

      setSubject('');
      setMessage('');
      Alert.alert('Ticket Created', 'Your inquiry has been routed to our institutional support desk.');
      loadTickets();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openThreadModal = async (ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage('');
    setThreadModalVisible(true);

    if (!isDemoMode && ticket.id) {
      try {
        const detail = await apiCall(`/support/tickets/${ticket.id}/`).catch(() => null);
        if (detail) setSelectedTicket(detail);
      } catch (e) {}
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage || !selectedTicket) return;

    setLoading(true);
    try {
      if (!isDemoMode && selectedTicket.id) {
        await apiCall(`/support/tickets/${selectedTicket.id}/reply/`, 'POST', {
          message: replyMessage,
        });
      }

      const newMsg = {
        id: `r-${Date.now()}`,
        sender_name: 'You',
        is_staff: false,
        message: replyMessage,
        created_at: 'Just now',
      };

      const updated = {
        ...selectedTicket,
        messages: [...(selectedTicket.messages || []), newMsg],
      };
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setReplyMessage('');
    } catch (err) {
      Alert.alert('Reply Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const s = String(status).toUpperCase();
    if (s === 'RESOLVED' || s === 'CLOSED') return colors.textDim;
    if (s === 'IN_REVIEW') return colors.accentWarning;
    return colors.goldSoft;
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
        <Text style={styles.eyebrow}>24/7 INSTITUTIONAL HELPDESK</Text>
        <Text style={styles.screenTitle}>Support &amp; Inquiries</Text>
        <Text style={styles.screenSubtitle}>
          Direct member support line for deposits, yield queries, account security, and affiliate tracking.
        </Text>
      </View>

      {/* KYC Shortcut Banner */}
      <TouchableOpacity
        style={styles.kycBanner}
        onPress={() => onNavigate && onNavigate('kyc')}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.kycBannerTitle}>Need Identity Verification (KYC)?</Text>
          <Text style={styles.kycBannerSubtitle}>
            Submit your government document details directly on our compliance desk.
          </Text>
        </View>
        <View style={styles.kycBannerAction}>
          <Text style={styles.kycBannerArrow}>Open KYC</Text>
          <Feather name="arrow-right" size={12} color={colors.textMain} style={{ marginLeft: 3 }} />
        </View>
      </TouchableOpacity>

      {/* New Ticket Form */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>NEW TICKET</Text>
          <Text style={styles.cardTitle}>Create Support Ticket</Text>
        </View>

        <Text style={styles.label}>Inquiry Subject *</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="How can our desk assist you?"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.label}>Inquiry Category *</Text>
        <View style={styles.categoryToggleGrid}>
          {[
            { id: 'GENERAL', label: 'General Question' },
            { id: 'DEPOSIT', label: 'Deposit Query' },
            { id: 'WITHDRAWAL', label: 'Withdrawal Issue' },
            { id: 'REFERRAL', label: 'Affiliate & ROI' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.catBtn, category === item.id && styles.catBtnActive]}
              onPress={() => setCategory(item.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catBtnText, category === item.id && styles.catBtnTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Detailed Inquiry Message *</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Describe your inquiry or transaction details..."
          placeholderTextColor={colors.textDim}
        />

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleSubmitTicket}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#030507" />
          ) : (
            <Text style={styles.btnPrimaryText}>Submit Support Ticket →</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tickets History */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>HISTORY</Text>
          <Text style={styles.cardTitle}>Your Support Tickets ({tickets.length})</Text>
        </View>

        {tickets.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
            No previous support tickets recorded.
          </Text>
        ) : (
          tickets.map((t, idx) => (
            <TouchableOpacity
              key={t.id || idx}
              style={styles.ticketRow}
              onPress={() => openThreadModal(t)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <Text style={styles.ticketCategory}>
                  Category: {t.category} • Tap to view ({t.messages ? t.messages.length : 1} msgs)
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusBadge, { borderColor: getStatusColor(t.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(t.status) }]}>
                    {t.status || 'OPEN'}
                  </Text>
                </View>
                <Text style={styles.ticketDate}>{t.created_at || 'Recent'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Ticket Thread & Reply Modal */}
      <Modal visible={threadModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedTicket?.subject}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
                  <Text style={{ color: colors.goldSoft, fontSize: 10, fontWeight: '700' }}>
                    {selectedTicket?.status || 'OPEN'}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 10 }}>• {selectedTicket?.created_at}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setThreadModalVisible(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Conversation Messages */}
            <ScrollView style={{ maxHeight: 240, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
              {selectedTicket?.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((m, idx) => {
                  const isStaff = m.is_staff;
                  return (
                    <View
                      key={m.id || idx}
                      style={[
                        styles.messageBubble,
                        isStaff ? styles.messageStaff : styles.messageUser,
                      ]}
                    >
                      <View style={styles.msgHeaderRow}>
                        <Text style={styles.msgSender}>
                          {isStaff ? 'Compliance Staff' : m.sender_name || 'You'}
                        </Text>
                        <Text style={styles.msgTime}>{m.created_at || 'Recent'}</Text>
                      </View>
                      <Text style={styles.msgBody}>{m.message}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 12, paddingVertical: 10 }}>
                  No messages recorded in this inquiry thread.
                </Text>
              )}
            </ScrollView>

            {/* Reply Input Box */}
            <Text style={styles.label}>Add Follow-up Reply</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={replyMessage}
              onChangeText={setReplyMessage}
              multiline
              placeholder="Type your response to support..."
              placeholderTextColor={colors.textDim}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setThreadModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={handleSendReply}
                disabled={loading || !replyMessage}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#030507" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Send Reply</Text>
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
    marginBottom: 14,
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
  kycBanner: {
    backgroundColor: 'rgba(198, 153, 61, 0.08)',
    borderWidth: 1,
    borderColor: colors.bgCardBorderGold,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kycBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  kycBannerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  kycBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  kycBannerArrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMain,
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
  categoryToggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  catBtn: {
    width: '48.5%',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  catBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(198, 153, 61, 0.15)',
  },
  catBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimaryText: {
    color: '#030507',
    fontWeight: '700',
    fontSize: 13,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  ticketSubject: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
  },
  ticketCategory: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 3,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ticketDate: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 3,
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
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.bgCardBorder,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMain,
  },
  messageBubble: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  messageUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: colors.bgCardBorder,
    alignSelf: 'stretch',
  },
  messageStaff: {
    backgroundColor: 'rgba(198, 153, 61, 0.08)',
    borderColor: 'rgba(198, 153, 61, 0.25)',
    alignSelf: 'stretch',
  },
  msgHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  msgSender: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.goldSoft,
  },
  msgTime: {
    fontSize: 10,
    color: colors.textDim,
  },
  msgBody: {
    fontSize: 12,
    color: colors.textMain,
    lineHeight: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
  },
  modalBtnConfirm: {
    flex: 2,
    paddingVertical: 11,
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
