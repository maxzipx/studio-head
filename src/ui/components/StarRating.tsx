import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, typography } from '../tokens';

interface StarRatingProps {
  /** Raw value on 0–10 scale (mapped to 0–5 stars) */
  value:      number;
  maxStars?:  number;
  size?:      'sm' | 'md';
  style?:     ViewStyle;
}

export function StarRating({ value, maxStars = 5, size = 'md', style }: StarRatingProps) {
  // Map 0-10 → 0-maxStars (default: 0-5)
  const starValue = (value / 10) * maxStars;
  const fullStars = Math.floor(starValue);
  const hasHalf   = starValue - fullStars >= 0.4;
  const emptyStars = maxStars - fullStars - (hasHalf ? 1 : 0);

  const fontSize = size === 'sm' ? 12 : 15;

  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Text key={`f${i}`} style={[styles.star, { fontSize, color: colors.goldMid }]}>★</Text>
      ))}
      {hasHalf && (
        <Text style={[styles.star, { fontSize, color: colors.goldMid }]}>½</Text>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Text key={`e${i}`} style={[styles.star, { fontSize, color: colors.borderStrong }]}>★</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           1,
  },
  star: {
    fontFamily: typography.fontBodyBold,
  },
});
