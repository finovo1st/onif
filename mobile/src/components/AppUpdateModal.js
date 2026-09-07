import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function AppUpdateModal({
  visible,
  currentVersion,
  latestVersion,
  releaseNotes,
  downloadUrl,
  isForceUpdate,
  onDismiss,
}) {
  if (!visible) return null;

  const handleDownload = async () => {
    const url = downloadUrl || 'https://finovo1.com';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn('Cannot open download URL:', err.message);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        if (!isForceUpdate && onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top Decorative Icon */}
          <View style={[styles.iconCircle, isForceUpdate && styles.iconCircleForce]}>
            <Feather
              name={isForceUpdate ? 'alert-triangle' : 'download-cloud'}
              size={28}
              color={isForceUpdate ? colors.accentWarning : colors.gold}
            />
          </View>

          {/* Badge */}
          <View style={[styles.badge, isForceUpdate && styles.badgeForce]}>
            <Text style={[styles.badgeText, isForceUpdate && styles.badgeTextForce]}>
              {isForceUpdate ? 'MANDATORY UPDATE REQUIRED' : 'NEW PATCH RELEASE AVAILABLE'}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isForceUpdate ? 'Security & System Update' : 'New Version Available'}
          </Text>

          {/* Version Transition Pills */}
          <View style={styles.versionRow}>
            <View style={styles.versionPill}>
              <Text style={styles.versionPillLabel}>CURRENT</Text>
              <Text style={styles.versionPillVal}>v{currentVersion}</Text>
            </View>
            <Feather name="arrow-right" size={16} color={colors.goldSoft} style={{ marginHorizontal: 8 }} />
            <View style={[styles.versionPill, styles.versionPillActive]}>
              <Text style={[styles.versionPillLabel, { color: colors.goldSoft }]}>LATEST</Text>
              <Text style={[styles.versionPillVal, { color: colors.gold }]}>v{latestVersion}</Text>
            </View>
          </View>

          {/* Release Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesHeader}>WHAT'S NEW IN THIS RELEASE</Text>
            <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.notesText}>
                {releaseNotes || 'This release contains performance enhancements, security updates, and critical system improvements.'}
              </Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnCol}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Feather name="download" size={16} color="#030507" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrimaryText}>Download &amp; Install Update</Text>
            </TouchableOpacity>

            {!isForceUpdate && onDismiss && (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSecondaryText}>Remind Me Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 7, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0A0E15',
    borderWidth: 1,
    borderColor: 'rgba(229, 185, 85, 0.28)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(229, 185, 85, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 185, 85, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircleForce: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  badge: {
    backgroundColor: 'rgba(229, 185, 85, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(229, 185, 85, 0.3)',
    marginBottom: 10,
  },
  badgeForce: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.goldSoft,
  },
  badgeTextForce: {
    color: '#F87171',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMain,
    textAlign: 'center',
    marginBottom: 14,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    width: '100%',
  },
  versionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 85,
  },
  versionPillActive: {
    backgroundColor: 'rgba(229, 185, 85, 0.08)',
    borderColor: 'rgba(229, 185, 85, 0.35)',
  },
  versionPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
    marginBottom: 2,
  },
  versionPillVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMain,
    fontFamily: Platform?.OS === 'ios' ? 'Courier' : 'monospace',
  },
  notesContainer: {
    width: '100%',
    backgroundColor: 'rgba(6, 9, 14, 0.7)',
    borderWidth: 1,
    borderColor: colors.bgCardBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  notesHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: colors.goldSoft,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  btnCol: {
    width: '100%',
    gap: 8,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#030507',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
