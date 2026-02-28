import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadows, typography } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold-outline';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface PremiumButtonProps {
  label:      string;
  onPress:    () => void;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  disabled?:  boolean;
  loading?:   boolean;
  icon?:      React.ReactNode;
  style?:     ViewStyle;
  fullWidth?: boolean;
}

const sizeConfig = {
  sm: { paddingVertical: 9,  paddingHorizontal: 14, fontSize: typography.sizeSM,   borderRadius: radius.r2 },
  md: { paddingVertical: 13, paddingHorizontal: 18, fontSize: typography.sizeBase, borderRadius: radius.r3 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: typography.sizeMD,   borderRadius: radius.r3 },
};

export function PremiumButton({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  disabled  = false,
  loading   = false,
  icon,
  style,
  fullWidth = false,
}: PremiumButtonProps) {
  const sz      = sizeConfig[size];
  const opacity = disabled ? 0.45 : 1;

  const inner = (
    <View style={[styles.inner, { gap: 6 }]}>
      {icon}
      {loading
        ? <ActivityIndicator
            color={variant === 'primary' ? colors.textInverse : colors.ctaBlue}
            size="small"
          />
        : <Text style={[styles.label, { fontSize: sz.fontSize }, variantLabelStyle[variant]]}>
            {label}
          </Text>
      }
    </View>
  );

  const wrapStyle: ViewStyle[] = [
    {
      borderRadius:     sz.borderRadius,
      paddingVertical:  sz.paddingVertical,
      paddingHorizontal: sz.paddingHorizontal,
    },
    fullWidth ? { alignSelf: 'stretch' } : {},
    { opacity },
    variantContainerStyle[variant],
    style as ViewStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.80}
      style={wrapStyle}
    >
      {inner}
    </TouchableOpacity>
  );
}

// ── Per-variant container styles ─────────────────────────────────────────────
const variantContainerStyle: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.ctaBlue,
    ...shadows.glowBlue,
  },
  secondary: {
    backgroundColor: colors.bgSurface,
    borderWidth:     1,
    borderColor:     colors.borderNavy,
    ...shadows.card,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
  },
  danger: {
    backgroundColor: 'rgba(217,83,79,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(217,83,79,0.35)',
  },
  'gold-outline': {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     colors.borderGold,
  },
};

// ── Per-variant label styles ──────────────────────────────────────────────────
const variantLabelStyle: Record<ButtonVariant, object> = {
  primary:        { color: colors.textInverse,   fontFamily: typography.fontBodyBold },
  secondary:      { color: colors.navyPrimary,   fontFamily: typography.fontBodySemiBold },
  ghost:          { color: colors.textMuted,      fontFamily: typography.fontBodyMedium },
  danger:         { color: colors.accentRed,      fontFamily: typography.fontBodyBold },
  'gold-outline': { color: colors.goldMid,        fontFamily: typography.fontBodySemiBold },
};

const styles = StyleSheet.create({
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0.1,
    textAlign:     'center',
  },
});
