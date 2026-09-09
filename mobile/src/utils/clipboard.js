import { Platform, Alert } from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';

/**
 * Robust cross-platform clipboard copy helper for mobile (iOS/Android) and Web.
 * Uses expo-clipboard, with fallbacks to react-native Clipboard and web navigator.clipboard.
 *
 * @param {string|number} text - The text to copy to the clipboard.
 * @param {string} [label] - Optional label description (e.g., "Referral Code", "Wallet Address").
 * @param {boolean} [showAlert=true] - Whether to show an Alert confirming the copy.
 * @returns {Promise<boolean>} - Resolves to true if copying succeeded.
 */
export async function copyToClipboard(text, label = '', showAlert = true) {
  if (text === null || text === undefined || text === '') {
    return false;
  }

  const str = String(text);
  let copied = false;

  // 1. Primary: expo-clipboard
  try {
    if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === 'function') {
      await ExpoClipboard.setStringAsync(str);
      copied = true;
    } else if (ExpoClipboard && typeof ExpoClipboard.setString === 'function') {
      ExpoClipboard.setString(str);
      copied = true;
    }
  } catch (err) {
    console.warn('ExpoClipboard setStringAsync failed:', err);
  }

  // 2. Fallback: react-native core Clipboard (if present)
  if (!copied) {
    try {
      const RN = require('react-native');
      if (RN.Clipboard && typeof RN.Clipboard.setString === 'function') {
        RN.Clipboard.setString(str);
        copied = true;
      }
    } catch (err) {
      // react-native Clipboard unavailable
    }
  }

  // 3. Fallback: Web browser navigator.clipboard
  if (!copied && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(str);
      copied = true;
    } catch (err) {
      // web clipboard failed
    }
  }

  // User feedback
  if (showAlert) {
    const alertTitle = copied ? 'Copied to Clipboard' : 'Copy Failed';
    const alertMsg = copied
      ? (label ? `${label}: ${str}` : `${str}`)
      : 'Could not copy to clipboard. Please select and copy manually.';

    Alert.alert(alertTitle, alertMsg);
  }

  return copied;
}

export default copyToClipboard;
