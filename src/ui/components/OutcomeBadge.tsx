import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, typography } from '../tokens';

export type OutcomeType = 'blockbuster' | 'hit' | 'solid' | 'flop' | 'bomb';

interface OutcomeBadgeProps {
  outcome: OutcomeType;
  size?:   'sm' | 'md' | 'lg';
  style?:  ViewStyle;
}

type OutcomeConfig = {
  label:  string;
  color:  string;
  bg:     string;
  shadow: ViewStyle;
};

const outcomeConfig: Record<OutcomeType, OutcomeConfig> = {
  blockbuster: {
    label:  'BLOCKBUSTER',
    color:  colors.accentGreen,
    bg:     'rgba(62,201,138,0.14)',
    shadow: shadows.glowGreen,
  },
  hit: {
    label:  'HIT',
    color:  '#6FAEEA',
    bg:     'rgba(111,174,234,0.12)',
    shadow: { shadowColor: '#6FAEEA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 6 },
  },
  solid: {
    label:  'SOLID',
    color:  colors.goldMid,
    bg:     'rgba(212,168,67,0.12)',
    shadow: shadows.glowGold,
  },
  flop: {
    label:  'FLOP',
    color:  colors.accentRed,
    bg:     'rgba(232,80,74,0.12)',
    shadow: shadows.glowRed,
  },
  bomb: {
    label:  'BOMB',
    color:  '#FF3B30',
    bg:     'rgba(255,59,48,0.10)',
    shadow: { shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.40, shadowRadius: 18, elevation: 10 },
  },
};

const sizeConfig = {
  sm: { fontSize: typography.sizeXS,   paddingV: 3,  paddingH: 8  },
  md: { fontSize: typography.sizeSM,   paddingV: 5,  paddingH: 11 },
  lg: { fontSize: typography.sizeBase, paddingV: 8,  paddingH: 16 },
};

export function OutcomeBadge({ outcome, size = 'md', style }: OutcomeBadgeProps) {
  const cfg  = outcomeConfig[outcome];
  const sz   = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:  cfg.bg,
          borderColor:      cfg.color,
          paddingVertical:  sz.paddingV,
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
    borderRadius:  radius.rFull,
    borderWidth:   1,
    alignSelf:     'flex-start',
  },
  label: {
    fontFamily:    typography.fontBodyBold,
    letterSpacing: typography.trackingWide,
  },
});
