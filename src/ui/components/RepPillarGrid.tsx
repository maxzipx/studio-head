import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { StudioReputation } from '../../domain/types';
import { colors, radius, spacing, typography } from '../tokens';

interface RepPillarGridProps {
  reputation:  StudioReputation;
  showLabels?: boolean;
  style?:      ViewStyle;
}

const PILLARS: { key: keyof StudioReputation; label: string }[] = [
  { key: 'critics',     label: 'CRITICS'  },
  { key: 'talent',      label: 'TALENT'   },
  { key: 'distributor', label: 'DISTRIB'  },
  { key: 'audience',    label: 'AUDIENCE' },
];

function pillarColor(value: number): string {
  if (value >= 75) return colors.accentGreen;
  if (value >= 55) return colors.goldMid;
  if (value >= 35) return colors.accentTeal;
  return colors.accentRed;
}

export function RepPillarGrid({ reputation, showLabels = true, style }: RepPillarGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {PILLARS.map(({ key, label }) => {
        const value = Math.round(reputation[key]);
        const color = pillarColor(value);
        return (
          <View
            key={key}
            style={[
              styles.pillar,
              { borderColor: color + '40' /* ~25% alpha */ },
            ]}
          >
            <Text style={[styles.value, { color }]}>{value}</Text>
            {showLabels && (
              <Text style={styles.label}>{label}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap:           spacing.sp2,
  },
  pillar: {
    flex:            1,
    borderRadius:    radius.r2,
    borderWidth:     1,
    backgroundColor: colors.bgElevated,
    paddingVertical: spacing.sp2,
    alignItems:      'center',
    gap:             2,
  },
  value: {
    fontFamily:    typography.fontDisplay,
    fontSize:      typography.sizeLG,
    letterSpacing: typography.trackingTight,
  },
  label: {
    fontFamily:    typography.fontBodySemiBold,
    fontSize:      9,
    color:         colors.textMuted,
    letterSpacing: typography.trackingWidest,
  },
});
