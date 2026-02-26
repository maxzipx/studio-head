import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, typography } from '../tokens';

interface ProgressBarProps {
  /** 0–100 */
  value:       number;
  color?:      string;
  height?:     number;
  showLabel?:  boolean;
  animated?:   boolean;
  style?:      ViewStyle;
  bgColor?:    string;
}

export function ProgressBar({
  value,
  color      = colors.goldMid,
  height     = 4,
  showLabel  = false,
  animated   = false,
  style,
  bgColor    = 'rgba(255,255,255,0.08)',
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const widthAnim    = useRef(new Animated.Value(clampedValue)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(widthAnim, {
        toValue:         clampedValue,
        useNativeDriver: false,
        tension:         50,
        friction:        8,
      }).start();
    } else {
      widthAnim.setValue(clampedValue);
    }
  }, [clampedValue, animated, widthAnim]);

  const animatedWidth = widthAnim.interpolate({
    inputRange:  [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[style]}>
      <View
        style={[
          styles.track,
          { height, backgroundColor: bgColor, borderRadius: radius.rFull },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            { width: animatedWidth, height, backgroundColor: color, borderRadius: radius.rFull },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.label}>{Math.round(clampedValue)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width:    '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left:     0,
    top:      0,
  },
  label: {
    fontFamily:  typography.fontBodyMedium,
    fontSize:    typography.sizeXS,
    color:       colors.textMuted,
    marginTop:   3,
    letterSpacing: typography.trackingWide,
  },
});
