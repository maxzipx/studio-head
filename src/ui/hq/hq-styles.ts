import { StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/ui/tokens';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp4, gap: spacing.sp3, paddingBottom: 120 },

  header: { gap: 3, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  studioName: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  weekLine: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentTeal },
  body: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary },
  bodyStrong: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  muted: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  alert: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.accentRed },

  statusRow: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp1 },
  statusTile: { flex: 1, paddingVertical: spacing.sp2, paddingHorizontal: spacing.sp1 },
  cashRow: { flexDirection: 'row', gap: spacing.sp3 },

  standingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sp2 },
  tierName: { fontFamily: typography.fontDisplay, fontSize: typography.sizeLG, color: colors.textPrimary, letterSpacing: typography.trackingTight, marginTop: 2 },
  heatBadge: { alignItems: 'center', gap: 1 },
  heatValue: { fontFamily: typography.fontDisplay, fontSize: typography.sizeXL, color: colors.goldMid, letterSpacing: typography.trackingTight },
  heatLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest },

  inboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expiryPill: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  expiryText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },

  optionGroup: { gap: spacing.sp2, marginTop: spacing.sp1 },
  optionBtn: {
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: spacing.sp2 + 2,
    gap: 3,
  },
  optionTitle: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  optionBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },

  capRow: { flexDirection: 'row', gap: spacing.sp3, marginTop: spacing.sp1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp2 },
  flexBtn: { flex: 1 },

  input: {
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    color: colors.textPrimary,
    fontFamily: typography.fontBody,
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
    fontSize: typography.sizeSM,
  },

  turnBtn: {
    flex: 1,
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: spacing.sp2 + 2,
    gap: 3,
  },
  turnBtnActive: {
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(212,168,67,0.10)',
  },

  arcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arcBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  arcStatus: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.6 },

  leaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },

  chronicleEntry: { flexDirection: 'row', gap: spacing.sp2, alignItems: 'flex-start', paddingVertical: 3 },
  chronicleWeek: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.textMuted, minWidth: 40 },
  chronicleHeadline: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeSM, color: colors.textPrimary, lineHeight: 18 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,10,15,0.55)' },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.r4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: spacing.sp5,
    gap: spacing.sp3,
    overflow: 'hidden',
    margin: spacing.sp4,
  },
  modalTopBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  modalLabel: {
    fontFamily: typography.fontBodySemiBold,
    fontSize: typography.sizeXS,
    color: colors.goldMid,
    textTransform: 'uppercase',
    letterSpacing: typography.trackingWidest,
  },
  modalFilmTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: typography.sizeXL,
    color: colors.textPrimary,
    letterSpacing: typography.trackingTight,
  },
  outcomeBadge: { alignSelf: 'flex-start' },
  modalStatsGrid: { flexDirection: 'row', gap: spacing.sp4 },
  recordLine: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.goldMid },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  driverLabel: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, width: 72 },
  driverBar: { flex: 1 },
  driverVal: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeXS, width: 28, textAlign: 'right' },
});
