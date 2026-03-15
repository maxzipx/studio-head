import { StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/ui/tokens';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp5, paddingBottom: 120, gap: spacing.sp4 },
  section: { gap: spacing.sp3 },

  header: { gap: 4, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  title: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subtitle: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted, marginTop: -2 },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentGreen },
  empty: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },
  helpTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary, marginBottom: 4 },
  helpBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

  snapshotRow: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp2 },
  snapshotTile: { flex: 1, alignItems: 'center', paddingVertical: spacing.sp2, flexShrink: 1 },
  snapshotMetricLabel: { letterSpacing: typography.trackingNormal, textTransform: 'none' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: typography.fontDisplayItalic, fontSize: typography.sizeLG, color: colors.textPrimary, flex: 1, marginRight: spacing.sp2, lineHeight: 26 },
  logline: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2, flexWrap: 'wrap' },
  metaText: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  metricRow: { flexDirection: 'row', gap: spacing.sp3 },

  pill: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  pillText: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.goldMid, letterSpacing: 0.4, textTransform: 'capitalize' },

  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  recBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  recText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },

  pressureLabel: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, textTransform: 'uppercase', letterSpacing: 0.6 },
  releaseWeekLine: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary },
  offerPartner: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sp4,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.r4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: spacing.sp3,
    gap: spacing.sp2,
  },
  modalTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeMD,
    color: colors.textPrimary,
  },
  modalBody: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  actions: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp1, flexWrap: 'wrap' },
  flexBtn: { flex: 1 },
});
