import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { blur, colors, radius, shadows } from '../tokens';

export type GlassCardVariant = 'default' | 'elevated' | 'strong' | 'gold' | 'red' | 'teal';

interface GlassCardProps {
  variant?: GlassCardVariant;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

const variantConfig: Record<
  GlassCardVariant,
  { intensity: number; border: string; bg: string; shadow?: ViewStyle }
> = {
  default: {
    intensity: blur.card,
    border:    colors.borderSubtle,
    bg:        colors.bgSurface,
  },
  elevated: {
    intensity: blur.elevated,
    border:    colors.borderDefault,
    bg:        colors.bgElevated,
  },
  strong: {
    intensity: blur.modal,
    border:    colors.borderStrong,
    bg:        colors.bgElevated,
    shadow:    shadows.card,
  },
  gold: {
    intensity: blur.card,
    border:    colors.borderGold,
    bg:        colors.bgSurface,
    shadow:    shadows.glowGold,
  },
  red: {
    intensity: blur.card,
    border:    colors.borderRed,
    bg:        'rgba(232,80,74,0.08)',
    shadow:    shadows.glowRed,
  },
  teal: {
    intensity: blur.card,
    border:    colors.borderTeal,
    bg:        'rgba(56,189,181,0.08)',
    shadow:    shadows.glowTeal,
  },
};

export function GlassCard({ variant = 'default', style, children }: GlassCardProps) {
  const cfg = variantConfig[variant];

  // iOS: BlurView with transparent bg
  // Android: solid fallback (BlurView not reliable)
  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      borderColor: cfg.border,
      ...(cfg.shadow ?? {}),
    },
    style as ViewStyle,
  ];

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={cfg.intensity}
        tint="dark"
        style={containerStyle}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[containerStyle, { backgroundColor: cfg.bg }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:  radius.r3,
    borderWidth:   1,
    overflow:      'hidden',
    padding:       14,
  },
});
