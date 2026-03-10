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
    bg: 'rgba(107,168,130,0.15)',
    border: colors.accentGreen,
    shadow: shadows.glowGreen,
  },
  hit: {
    label: 'HIT',
    color: colors.ctaBlue,
    bg: 'rgba(196,129,59,0.15)',
    border: colors.ctaBlue,
    shadow: shadows.glowBlue,
  },
  solid: {
    label: 'SOLID',
    color: colors.goldMid,
    bg: 'rgba(184,144,58,0.15)',
    border: colors.goldMid,
    shadow: shadows.glowGold,
  },
  flop: {
    label: 'FLOP',
    color: colors.accentRed,
    bg: 'rgba(224,112,112,0.15)',
    border: colors.accentRed,
    shadow: shadows.glowRed,
  },
  bomb: {
    label: 'BOMB',
    color: colors.accentRedDeep,
    bg: 'rgba(196,32,32,0.15)',
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
