import { LinearGradient } from 'expo-linear-gradient';
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
  label:     string;
  onPress:   () => void;
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  disabled?: boolean;
  loading?:  boolean;
  icon?:     React.ReactNode;
  style?:    ViewStyle;
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
  const sz  = sizeConfig[size];
  const opacity = disabled ? 0.4 : 1;

  const inner = (
    <View style={[styles.inner, { gap: 6 }]}>
      {icon}
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.goldMid} size="small" />
        : <Text style={[styles.label, { fontSize: sz.fontSize }, variantLabelStyle[variant]]}>
            {label}
          </Text>
      }
    </View>
  );

  const wrapStyle: ViewStyle[] = [
    { borderRadius: sz.borderRadius, paddingVertical: sz.paddingVertical, paddingHorizontal: sz.paddingHorizontal },
    fullWidth ? { alignSelf: 'stretch' } : {},
    { opacity },
    style as ViewStyle,
  ];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        style={[{ borderRadius: sz.borderRadius, overflow: 'hidden' }, fullWidth ? { alignSelf: 'stretch' } : {}, { opacity }, style as ViewStyle]}
      >
        <LinearGradient
          colors={[colors.goldDeep, colors.goldLight]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.gradientFill,
            { paddingVertical: sz.paddingVertical, paddingHorizontal: sz.paddingHorizontal },
            shadows.glowGold,
          ]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[wrapStyle, variantContainerStyle[variant]]}
    >
      {inner}
    </TouchableOpacity>
  );
}

// ── Per-variant styles ──────────────────────────────────────────────────────
const variantContainerStyle: Record<Exclude<ButtonVariant, 'primary'>, ViewStyle> = {
  secondary: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  danger: {
    backgroundColor: 'rgba(232,80,74,0.12)',
    borderWidth: 1,
    borderColor: colors.borderRed,
  },
  'gold-outline': {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
};

const variantLabelStyle: Record<ButtonVariant, object> = {
  primary:       { color: colors.textInverse, fontFamily: typography.fontBodyBold },
  secondary:     { color: colors.textPrimary,   fontFamily: typography.fontBodySemiBold },
  ghost:         { color: colors.textSecondary, fontFamily: typography.fontBodyMedium },
  danger:        { color: colors.accentRed,     fontFamily: typography.fontBodyBold },
  'gold-outline':{ color: colors.goldMid,       fontFamily: typography.fontBodySemiBold },
};

const styles = StyleSheet.create({
  gradientFill: {
    alignItems:     'center',
    justifyContent: 'center',
  },
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
