import { StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/ui/tokens';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: spacing.sp4,
    gap: spacing.sp3,
    paddingBottom: 120,
  },

  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
  },
  phasePill: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: spacing.sp2,
    borderColor: colors.borderDefault,
  },
  phasePillText: {
    fontSize: typography.sizeXS,
    fontFamily: typography.fontBodySemiBold,
    letterSpacing: typography.trackingWide,
    textTransform: 'capitalize',
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: typography.trackingTight,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textMuted,
    marginTop: -2,
  },

  messageCard: {
    borderColor: colors.borderBlue,
  },
  messageText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.accentGreen,
  },

  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sp2,
    flexWrap: 'wrap',
  },
  metricFlex: {
    flex: 1,
    minWidth: 70,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sp2,
    flexWrap: 'wrap',
  },
  buttonFlex: {
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sp2,
  },

  bodyText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textSecondary,
  },
  mutedText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeXS,
    color: colors.textMuted,
  },

  statusPill: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: spacing.sp2,
  },
  statusPillText: {
    fontSize: typography.sizeXS,
    fontFamily: typography.fontBodySemiBold,
  },

  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sp2,
  },
  expiryPill: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  expiryPillText: {
    fontSize: 10,
    fontFamily: typography.fontBodyBold,
  },

  offersWrap: {
    gap: spacing.sp2,
    marginTop: spacing.sp2,
  },
  offerTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeSM,
    color: colors.textPrimary,
  },

  outcomeRow: {
    alignItems: 'center',
    paddingVertical: spacing.sp2,
  },

  abandonSection: {
    paddingTop: spacing.sp2,
  },
  abandonButton: {
    alignSelf: 'center',
  },

  emptyWrap: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sp6,
    gap: spacing.sp2,
  },
  emptyTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: typography.sizeXL,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
