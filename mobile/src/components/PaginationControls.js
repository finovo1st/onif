import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

/**
 * FINOVO Institutional Mobile Pagination Controls
 * 
 * Props:
 * - currentPage: number (1-based index)
 * - totalPages: number
 * - totalCount: number
 * - onPageChange: (newPage: number) => void
 * - loading?: boolean
 * - label?: string (e.g. "entries", "records", "transactions")
 * - style?: object
 */
export default function PaginationControls({
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  loading = false,
  label = 'records',
  style,
}) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  // Don't display anything if there are no records
  if (totalCount === 0 && totalPages <= 1) {
    return null;
  }

  // If only 1 page exists with records, show a clean total badge without inactive buttons
  if (totalPages <= 1) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.singlePageInfo}>
          <Text style={styles.singlePageText}>
            Showing all <Text style={styles.highlightText}>{totalCount}</Text> {label}
          </Text>
        </View>
      </View>
    );
  }

  // Generate visible page numbers (up to 5 surrounding current page)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <View style={[styles.container, style]}>
      {/* Top Info Bar */}
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>
          Page <Text style={styles.highlightText}>{currentPage}</Text> of{' '}
          <Text style={styles.highlightText}>{totalPages}</Text>
          {'  '}•{'  '}Total: <Text style={styles.highlightText}>{totalCount}</Text> {label}
        </Text>
        {loading && <ActivityIndicator size="small" color={colors.goldSoft} style={styles.spinner} />}
      </View>

      {/* Navigation Buttons Row */}
      <View style={styles.controlsRow}>
        {/* Previous Button */}
        <TouchableOpacity
          style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
          onPress={() => hasPrev && !loading && onPageChange(currentPage - 1)}
          disabled={!hasPrev || loading}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={hasPrev ? colors.goldSoft : colors.textDim} />
          <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>Prev</Text>
        </TouchableOpacity>

        {/* Page Number Pills */}
        <View style={styles.pagesWrap}>
          {pageNumbers[0] > 1 && (
            <>
              <TouchableOpacity
                style={[styles.pagePill, currentPage === 1 && styles.pagePillActive]}
                onPress={() => !loading && onPageChange(1)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[styles.pagePillText, currentPage === 1 && styles.pagePillTextActive]}>1</Text>
              </TouchableOpacity>
              {pageNumbers[0] > 2 && <Text style={styles.ellipsisText}>…</Text>}
            </>
          )}

          {pageNumbers.map((p) => {
            const isActive = p === currentPage;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.pagePill, isActive && styles.pagePillActive]}
                onPress={() => !loading && onPageChange(p)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[styles.pagePillText, isActive && styles.pagePillTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <Text style={styles.ellipsisText}>…</Text>}
              <TouchableOpacity
                style={[styles.pagePill, currentPage === totalPages && styles.pagePillActive]}
                onPress={() => !loading && onPageChange(totalPages)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[styles.pagePillText, currentPage === totalPages && styles.pagePillTextActive]}>
                  {totalPages}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
          onPress={() => hasNext && !loading && onPageChange(currentPage + 1)}
          disabled={!hasNext || loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnText, !hasNext && styles.navBtnTextDisabled]}>Next</Text>
          <Feather name="chevron-right" size={16} color={hasNext ? colors.goldSoft : colors.textDim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.bgCardBorder,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  highlightText: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  spinner: {
    marginLeft: 8,
  },
  singlePageInfo: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singlePageText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(21, 28, 37, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(198, 153, 61, 0.3)',
    gap: 4,
    minHeight: 34,
  },
  navBtnDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.45,
  },
  navBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.goldSoft,
  },
  navBtnTextDisabled: {
    color: colors.textDim,
  },
  pagesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  pagePill: {
    minWidth: 28,
    height: 28,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
  },
  pagePillActive: {
    backgroundColor: 'rgba(198, 153, 61, 0.22)',
    borderColor: colors.goldSoft,
  },
  pagePillText: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  pagePillTextActive: {
    color: colors.goldSoft,
    fontWeight: '800',
  },
  ellipsisText: {
    fontSize: 11,
    color: colors.textDim,
    paddingHorizontal: 2,
  },
});
