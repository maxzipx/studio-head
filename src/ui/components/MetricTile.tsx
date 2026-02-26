import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, typography } from '../tokens';

export type MetricSize = 'sm' | 'md' | 'lg';
export type MetricTrend = 'up' | 'down' | 'flat';

interface MetricTileProps {
  value:    string | number;
  label:    string;
  size?:    MetricSize;
  trend?:   MetricTrend;
  accent?:  string;   // override value color
  style?:   ViewStyle;
  centered?: boolean;
}

export function MetricTile({
  value,
  label,
  size     = 'md',
  trend,
  accent,
  style,
  centered = false,
}: MetricTileProps) {
  const cfg = sizeConfig[size];
  const valueColor = accent ?? colors.goldMid;

  return (
    <View style={[styles.container, centered && styles.centered, style]}>
      <Text style={[styles.value, { fontSize: cfg.valueFontSize, fontFamily: cfg.fontFamily, color: valueColor }]}>
        {value}
      </Text>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { fontSize: cfg.labelFontSize }]}>{label}</Text>
        {trend && trend !== 'flat' && (
          <Text style={[styles.trend, { color: trend === 'up' ? colors.accentTeal : colors.accentRed }]}>
            {trend === 'up' ? ' ▲' : ' ▼'}
          </Text>
        )}
      </View>
    </View>
  );
}

const sizeConfig: Record<MetricSize, { valueFontSize: number; labelFontSize: number; fontFamily: string }> = {
  lg: { valueFontSize: typography.size3XL, labelFontSize: typography.sizeXS,  fontFamily: typography.fontDisplay },
  md: { valueFontSize: typography.sizeXL,  labelFontSize: typography.sizeSM,  fontFamily: typography.fontBodyBold },
  sm: { valueFontSize: typography.sizeLG,  labelFontSize: typography.sizeXS,  fontFamily: typography.fontBodySemiBold },
};

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  centered: {
    alignItems: 'center',
  },
  value: {
    letterSpacing: typography.trackingTight,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  label: {
    fontFamily:    typography.fontBodyMedium,
    color:         colors.textMuted,
    letterSpacing: typography.trackingWidest,
    textTransform: 'uppercase',
  },
  trend: {
    fontFamily: typography.fontBodyBold,
    fontSize:   typography.sizeXS,
  },
});
