import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../tokens';

interface MetricsStripProps {
  cash: number;   // raw dollar value
  heat: number;   // 0–100
  week: number;   // current game week
}

function formatCash(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)         return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function heatColor(heat: number): string {
  if (heat >= 80) return colors.accentRed;
  if (heat >= 60) return colors.goldLight;
  return colors.accentGreen;
}

function MetricColumn({
  value,
  label,
  valueColor = colors.textInverse,
}: {
  value:       string;
  label:       string;
  valueColor?: string;
}) {
  return (
    <View style={styles.column}>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function MetricsStrip({ cash, heat, week }: MetricsStripProps) {
  return (
    <View style={styles.strip}>
      <MetricColumn value={formatCash(cash)} label="CASH" />
      <View style={styles.divider} />
      <MetricColumn value={String(Math.round(heat))} label="HEAT" valueColor={heatColor(heat)} />
      <View style={styles.divider} />
      <MetricColumn value={`WK ${week}`} label="WEEK" />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor:  colors.bgDeep,
    height:           44,
    flexDirection:    'row',
    alignItems:       'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  column: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily:    typography.fontBodySemiBold,
    fontSize:      typography.sizeMD,
    color:         colors.textInverse,
    letterSpacing: typography.trackingNormal,
    lineHeight:    19,
  },
  label: {
    fontFamily:    typography.fontBodySemiBold,
    fontSize:      8,
    color:         'rgba(255,255,255,0.50)',
    letterSpacing: typography.trackingWidest,
    textTransform: 'uppercase',
    lineHeight:    10,
  },
  divider: {
    width:           1,
    height:          24,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
