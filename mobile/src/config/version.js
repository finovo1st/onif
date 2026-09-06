/**
 * Mobile App Version Configuration and Semantic Versioning Utilities
 */

export const APP_VERSION = '1.0.0';

/**
 * Compares two semantic version strings (e.g. "1.0.1" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2 (equal)
 */
export function compareSemVer(v1, v2) {
  if (!v1 || !v2) return 0;

  const clean1 = String(v1).replace(/^v/i, '').trim().split('-')[0];
  const clean2 = String(v2).replace(/^v/i, '').trim().split('-')[0];

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}
