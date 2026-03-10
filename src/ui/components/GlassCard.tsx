import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../tokens';

export type GlassCardVariant =
  | 'default'
  | 'elevated'
  | 'strong'
  | 'gold'
  | 'champagne'
  | 'red'
  | 'blue';

interface GlassCardProps {
  variant?: GlassCardVariant;
  style?: ViewStyle | ViewStyle[];
  /** 3-px left accent border — pass a color string (e.g. colors.goldMid, colors.accentRed) */
  accentBorder?: string;
  children?: React.ReactNode;
}

type VariantConfig = {
  bg: string;
  border: string;
  shadow: ViewStyle;
};

const variantConfig: Record<GlassCardVariant, VariantConfig> = {
  default: {
    bg: colors.bgSurface,
    border: colors.borderSubtle,
    shadow: shadows.card,
  },
  elevated: {
    bg: colors.bgSurface,
    border: colors.borderDefault,
    shadow: shadows.elevated,
  },
  strong: {
    bg: colors.bgSurface,
    border: colors.borderStrong,
    shadow: shadows.elevated,
  },
  gold: {
    bg: colors.bgChampagne,
    border: colors.borderGold,
    shadow: shadows.glowGold,
  },
  champagne: {
    bg: colors.bgChampagne,
    border: colors.borderGold,
    shadow: shadows.glowGold,
  },
  red: {
    bg: 'rgba(224,112,112,0.10)',
    border: 'rgba(224,112,112,0.35)',
    shadow: {} as ViewStyle,
  },
  blue: {
    bg: 'rgba(196,129,59,0.10)',
    border: 'rgba(196,129,59,0.35)',
    shadow: {} as ViewStyle,
  },
};

export function GlassCard({
  variant = 'default',
  style,
  accentBorder,
  children,
}: GlassCardProps) {
  const cfg = variantConfig[variant];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          ...cfg.shadow,
          // Accent left border overrides the left-side of the uniform 1px border
          borderLeftWidth: accentBorder ? 3 : 1,
          borderLeftColor: accentBorder ?? cfg.border,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.r3,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },
});
