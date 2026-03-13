import { Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import { GlassCard, MetricTile, ProgressBar, SectionLabel } from '@/src/ui/components';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing } from '@/src/ui/tokens';
import { money } from '@/src/ui/hq/hq-helpers';

interface HqWeeklyStatusCardProps {
  manager: StudioManager;
  weeklyExpenses: number;
  scaleOverheadCost: number;
  nextScaleOverheadWeek: number;
  inboxCount: number;
  hasLowCashWarning: boolean;
  hasUrgentLowCashWarning: boolean;
}

export function HqWeeklyStatusCard({
  manager,
  weeklyExpenses,
  scaleOverheadCost,
  nextScaleOverheadWeek,
  inboxCount,
  hasLowCashWarning,
  hasUrgentLowCashWarning,
}: HqWeeklyStatusCardProps) {
  return (
    <GlassCard style={{ gap: spacing.sp2 }}>
      <SectionLabel label="Weekly Status" />
      <View style={styles.statusRow}>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile value={manager.currentWeek} label="Week" size="sm" />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile
            value={manager.canEndWeek ? 'Ready' : 'Blocked'}
            label="Turn"
            size="sm"
            accent={manager.canEndWeek ? colors.accentGreen : colors.accentRed}
          />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile value={manager.projectCapacityUsed} label="Projects" size="sm" />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile
            value={inboxCount}
            label="Inbox"
            size="sm"
            accent={inboxCount > 0 ? colors.goldMid : colors.textMuted}
          />
        </GlassCard>
      </View>

      <View style={styles.cashRow}>
        <MetricTile value={money(manager.cash)} label="Cash" size="sm" />
        <MetricTile value={money(weeklyExpenses)} label="Weekly Burn" size="sm" accent={colors.accentRed} />
        <MetricTile
          value={money(manager.lifetimeProfit)}
          label="Lifetime P/L"
          size="sm"
          accent={manager.lifetimeProfit >= 0 ? colors.accentGreen : colors.accentRed}
        />
      </View>
      <Text style={styles.muted}>
        Scale overhead posts every 13 weeks. Current charge: {money(scaleOverheadCost)}. Next review: W{nextScaleOverheadWeek}.
      </Text>

      {!manager.canEndWeek ? <Text style={styles.alert}>Resolve crisis to unlock End Turn.</Text> : null}
      {hasLowCashWarning ? (
        <Text style={styles.alert}>
          WARNING: Bankruptcy Risk: Cash below $1M for {manager.consecutiveLowCashWeeks} consecutive weeks.
          {hasUrgentLowCashWarning ? ' Emergency action required.' : ''}
        </Text>
      ) : null}
    </GlassCard>
  );
}
