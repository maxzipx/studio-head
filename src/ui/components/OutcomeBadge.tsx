import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, typography } from '../tokens';

export type OutcomeType = 'blockbuster' | 'hit' | 'solid' | 'flop' | 'bomb';

interface OutcomeBadgeProps {
  outcome: OutcomeType;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

type OutcomeConfig = {
  label: string;
  color: string;
  bg: string;
  border: string;
  shadow: ViewStyle;
};

// Dark-mode tinted backgrounds
const outcomeConfig: Record<OutcomeType, OutcomeConfig> = {
  blockbuster: {
    label: 'BLOCKBUSTER',
    color: colors.accentGreen,
    bg: 'rgba(52,211,153,0.15)',
    border: colors.accentGreen,
    shadow: shadows.glowGreen,
  },
  hit: {
    label: 'HIT',
    color: colors.ctaBlue,
    bg: 'rgba(59,130,246,0.15)',
    border: colors.ctaBlue,
    shadow: shadows.glowBlue,
  },
  solid: {
    label: 'SOLID',
    color: colors.goldMid,
    bg: 'rgba(234,179,8,0.15)',
    border: colors.goldMid,
    shadow: shadows.glowGold,
  },
  flop: {
    label: 'FLOP',
    color: colors.accentRed,
    bg: 'rgba(248,113,113,0.15)',
    border: colors.accentRed,
    shadow: shadows.glowRed,
  },
  bomb: {
    label: 'BOMB',
    color: colors.accentRedDeep,
    bg: 'rgba(220,38,38,0.15)',
    border: colors.accentRedDeep,
    shadow: { shadowColor: colors.accentRedDeep, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.30, shadowRadius: 16, elevation: 8 } as ViewStyle,
  },
};

const sizeConfig = {
  sm: { fontSize: typography.sizeXS, paddingV: 3, paddingH: 8 },
  md: { fontSize: typography.sizeSM, paddingV: 5, paddingH: 11 },
  lg: { fontSize: typography.sizeBase, paddingV: 8, paddingH: 16 },
};

export function OutcomeBadge({ outcome, size = 'md', style }: OutcomeBadgeProps) {
  const cfg = outcomeConfig[outcome];
  const sz = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          paddingVertical: sz.paddingV,
          paddingHorizontal: sz.paddingH,
          ...cfg.shadow,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize: sz.fontSize, color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: typography.fontBodyBold,
    letterSpacing: typography.trackingWide,
  },
});
