import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { GlassCard } from './GlassCard';
import type { GlassCardVariant } from './GlassCard';
import { colors, radius, typography } from '../tokens';

interface CollapsibleCardProps {
  /** Header label shown in the toggle row */
  title: string;
  /** Optional small badge text, e.g. "3 Active" */
  badge?: string;
  /** Colour of badge text (defaults to goldMid) */
  badgeColor?: string;
  /** Whether the section starts open. Default: false */
  defaultOpen?: boolean;
  /** GlassCard variant for the outer container */
  variant?: GlassCardVariant;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  badge,
  badgeColor = colors.goldMid,
  defaultOpen = false,
  variant = 'default',
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <GlassCard variant={variant} style={{ gap: 0 }}>
      {/* Toggle header */}
      <Pressable
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title.toUpperCase()}</Text>
          {badge ? (
            <View style={[styles.badge, { borderColor: badgeColor + '60', backgroundColor: badgeColor + '14' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>{'>'}</Text>
      </Pressable>

      {/* Expandable content */}
      {open ? (
        <View style={styles.content}>
          {children}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontFamily: typography.fontBodySemiBold,
    fontSize: typography.sizeXS,
    color: colors.textMuted,
    letterSpacing: 1.1,
  },
  badge: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  chevron: {
    fontFamily: typography.fontBodyBold,
    fontSize: 18,
    color: colors.textMuted,
    lineHeight: 22,
    // default: pointing right (collapsed)
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  content: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: 4,
  },
});

