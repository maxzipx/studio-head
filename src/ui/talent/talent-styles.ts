import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp5, paddingBottom: 120, gap: spacing.sp4 },

  header: { gap: 4, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  title: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subtitle: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted, marginTop: -2 },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentGreen },
  empty: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },
  body: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary, lineHeight: 20 },
  bodyStrong: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  muted: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  alert: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },
  signal: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },

  helpTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary, marginBottom: 4 },
  helpBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sp2, marginTop: spacing.sp2, flexWrap: 'wrap' },
  snapshotTile: { flexBasis: '31%', minWidth: 92, alignItems: 'center', paddingVertical: spacing.sp2, paddingHorizontal: spacing.sp1 },
  snapshotValue: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeLG, letterSpacing: typography.trackingTight },
  snapshotLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 10, color: colors.textMuted, letterSpacing: typography.trackingWide, textAlign: 'center' },

  targetRow: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },

  activeTitle: { fontFamily: typography.fontDisplay, fontSize: typography.sizeLG, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },

  // Negotiation
  negHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chancePill: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  chanceText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },
  offerRow: { flexDirection: 'row', gap: spacing.sp2 },
  offerCol: { flex: 1, gap: 3, padding: spacing.sp2 },
  offerLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest, textTransform: 'uppercase' },
  offerVal: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS, color: colors.textSecondary },
  roleHeaderDirector: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ctaAmber + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.ctaAmber + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderActor: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentGreen + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.accentGreen + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderRoster: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.goldMid + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.goldMid + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderText: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeXS,
    letterSpacing: typography.trackingWidest,
    color: colors.textPrimary,
  },
  roleHeaderCount: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeSM,
    color: colors.textPrimary,
  },

  actions: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },
  negBtn: { flexGrow: 1, flexBasis: '23%', minWidth: 88 },
  flexBtn: { flex: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { width: '92%', maxWidth: 520, gap: spacing.sp2, marginHorizontal: spacing.sp3 },
});
