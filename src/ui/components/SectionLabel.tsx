import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, typography } from '../tokens';

interface Action {
  label:   string;
  onPress: () => void;
}

interface SectionLabelProps {
  label:   string;
  action?: Action;
  style?:  ViewStyle;
}

export function SectionLabel({ label, action, style }: SectionLabelProps) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily:    typography.fontBodySemiBold,
    fontSize:      typography.sizeXS,
    color:         colors.textMuted,
    letterSpacing: typography.trackingWidest,
  },
  action: {
    fontFamily:    typography.fontBodyMedium,
    fontSize:      typography.sizeXS,
    color:         colors.ctaBlue,
    letterSpacing: typography.trackingWide,
  },
});
