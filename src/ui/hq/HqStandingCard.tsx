import type { StudioManager } from '@/src/domain/studio-manager';
import { GlassCard, ProgressBar, RepPillarGrid, SectionLabel } from '@/src/ui/components';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing } from '@/src/ui/tokens';
import { TIER_LABELS, TIER_NEXT_GOAL } from '@/src/ui/hq/hq-helpers';
import { Text, View } from 'react-native';

interface HqStandingCardProps {
  manager: StudioManager;
}

export function HqStandingCard({ manager }: HqStandingCardProps) {
  return (
    <GlassCard variant={manager.studioHeat >= 70 ? 'gold' : 'default'}>
      <View style={styles.standingHeader}>
        <View style={{ flex: 1 }}>
          <SectionLabel label="Studio Standing" />
          <Text style={styles.tierName}>{TIER_LABELS[manager.studioTier] ?? manager.studioTier}</Text>
        </View>
        <View style={styles.heatBadge}>
          <Text style={styles.heatValue}>{manager.studioHeat.toFixed(0)}</Text>
          <Text style={styles.heatLabel}>HEAT</Text>
        </View>
      </View>
      <ProgressBar
        value={manager.studioHeat}
        color={manager.studioHeat >= 70 ? colors.accentGreen : manager.studioHeat >= 40 ? colors.goldMid : colors.accentRed}
        height={5}
        animated
      />
      <RepPillarGrid reputation={manager.reputation} style={{ marginTop: spacing.sp1 }} />
      <Text style={styles.muted}>{TIER_NEXT_GOAL[manager.studioTier]}</Text>
      <Text style={[styles.muted, { color: colors.textSecondary }]}>Legacy Score: {manager.legacyScore}</Text>
    </GlassCard>
  );
}
