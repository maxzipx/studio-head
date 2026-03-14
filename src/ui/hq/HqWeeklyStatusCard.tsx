import { Text, View } from 'react-native';

import type { CrisisEvent } from '@/src/domain/types';
import { GlassCard, MetricTile, ProgressBar, SectionLabel } from '@/src/ui/components';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing } from '@/src/ui/tokens';
import { money } from '@/src/ui/hq/hq-helpers';

interface HqWeeklyStatusCardProps {
  currentWeek: number;
  canEndWeek: boolean;
  projectCapacityUsed: number;
  inboxCount: number;
  cash: number;
  weeklyExpenses: number;
  lifetimeProfit: number;
  consecutiveLowCashWeeks: number;
  scaleOverheadCost: number;
  nextScaleOverheadWeek: number;
  hasLowCashWarning: boolean;
  hasUrgentLowCashWarning: boolean;
  visibleCrises: CrisisEvent[];
}

export function HqWeeklyStatusCard({
  currentWeek,
  canEndWeek,
  projectCapacityUsed,
  inboxCount,
  cash,
  weeklyExpenses,
  lifetimeProfit,
  consecutiveLowCashWeeks,
  scaleOverheadCost,
  nextScaleOverheadWeek,
  hasLowCashWarning,
  hasUrgentLowCashWarning,
  visibleCrises,
}: HqWeeklyStatusCardProps) {
  return (
    <GlassCard style={{ gap: spacing.sp2 }}>
      <SectionLabel label="Weekly Status" />
      <View style={styles.statusRow}>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile value={currentWeek} label="Week" size="sm" />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile
            value={canEndWeek ? 'Ready' : 'Blocked'}
            label="Turn"
            size="sm"
            accent={canEndWeek ? colors.accentGreen : colors.accentRed}
          />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.statusTile}>
          <MetricTile value={projectCapacityUsed} label="Projects" size="sm" />
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
        <MetricTile value={money(cash)} label="Cash" size="sm" />
        <MetricTile value={money(weeklyExpenses)} label="Weekly Burn" size="sm" accent={colors.accentRed} />
        <MetricTile
          value={money(lifetimeProfit)}
          label="Lifetime P/L"
          size="sm"
          accent={lifetimeProfit >= 0 ? colors.accentGreen : colors.accentRed}
        />
      </View>
      <Text style={styles.muted}>
        Scale overhead posts every 13 weeks. Current charge: {money(scaleOverheadCost)}. Next review: W{nextScaleOverheadWeek}.
      </Text>

      {!canEndWeek ? (
        <>
          <Text style={styles.alert}>Resolve crisis to unlock End Turn.</Text>
          {visibleCrises.map((crisis) => (
            <Text key={crisis.id} style={[styles.alert, { color: colors.accentRed }]}>
              ↓ Crisis in Inbox: {crisis.title}
            </Text>
          ))}
        </>
      ) : null}
      {hasLowCashWarning ? (
        <Text style={styles.alert}>
          WARNING: Bankruptcy Risk: Cash below $1M for {consecutiveLowCashWeeks} consecutive weeks.
          {hasUrgentLowCashWarning ? ' Emergency action required.' : ''}
        </Text>
      ) : null}
    </GlassCard>
  );
}
