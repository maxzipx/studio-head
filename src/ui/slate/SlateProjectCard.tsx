import { Text, View } from 'react-native';

import type { MovieProject, Talent } from '@/src/domain/types';
import { GlassCard, MetricTile, PremiumButton, ProgressBar, SectionLabel } from '@/src/ui/components';
import {
  money,
  phaseColor,
  phaseProgress,
} from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/slate/slate-styles';
import { colors, spacing } from '@/src/ui/tokens';

interface ProjectProjection {
  critical: number;
  openingLow: number;
  openingHigh: number;
}

interface SlateProjectCardProps {
  project: MovieProject;
  projection: ProjectProjection | null;
  talentPool: Talent[];
  isNewlyAcquired: boolean;
  onOpenDetail: (projectId: string) => void;
  onAdvancePhase: (projectId: string) => void;
}

export function SlateProjectCard({
  project,
  projection,
  talentPool,
  isNewlyAcquired,
  onOpenDetail,
  onAdvancePhase,
}: SlateProjectCardProps) {
  const burnPct = (project.budget.actualSpend / project.budget.ceiling) * 100;
  const director = project.directorId
    ? talentPool.find((t) => t.id === project.directorId)?.name ?? 'Unknown'
    : 'Unattached';
  const cast = project.castIds
    .map((id) => talentPool.find((t) => t.id === id)?.name)
    .filter((v): v is string => !!v);
  const progress = phaseProgress(project.phase, project.scheduledWeeksRemaining);
  const phaseCol = phaseColor(project.phase);

  return (
    <GlassCard key={project.id} style={{ gap: spacing.sp2 }}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{project.title}</Text>
        <View style={styles.rowMeta}>
          {isNewlyAcquired ? (
            <View style={[styles.pill, { borderColor: colors.accentGreen + '70', backgroundColor: colors.accentGreen + '1A' }]}>
              <Text style={[styles.pillText, { color: colors.accentGreen }]}>NEW</Text>
            </View>
          ) : null}
          <View style={[styles.pill, { borderColor: phaseCol + '60', backgroundColor: phaseCol + '14' }]}>
            <Text style={[styles.pillText, { color: phaseCol }]}>{project.phase}</Text>
          </View>
        </View>
      </View>

      <View style={styles.rowMeta}>
        <View style={[styles.pill, { borderColor: colors.goldMid + '40' }]}>
          <Text style={styles.pillText}>{project.genre}</Text>
        </View>
        <Text style={styles.metaText}>{director}</Text>
        {project.scheduledWeeksRemaining > 0 && (
          <Text style={styles.metaText}>{project.scheduledWeeksRemaining}w left</Text>
        )}
      </View>

      <ProgressBar value={progress} color={phaseCol} height={4} animated />

      <View style={styles.metricRow}>
        <MetricTile value={money(project.budget.actualSpend)} label="Spent" size="sm" />
        <MetricTile value={money(project.budget.ceiling)} label="Ceiling" size="sm" />
        <MetricTile
          value={`${burnPct.toFixed(0)}%`}
          label="Consumed"
          size="sm"
          accent={burnPct > 85 ? colors.accentRed : colors.goldMid}
        />
      </View>
      <ProgressBar
        value={burnPct}
        color={burnPct > 85 ? colors.accentRed : colors.accentGreen}
        height={3}
        animated
      />

      {cast.length > 0 && <Text style={styles.metaText}>Cast: {cast.join(', ')}</Text>}

      {projection && (
        <GlassCard variant="elevated" style={{ gap: spacing.sp2 }}>
          <SectionLabel label="Projection" />
          <View style={styles.metricRow}>
            <MetricTile
              value={projection.critical.toFixed(0)}
              label="Critic"
              size="sm"
              accent={projection.critical >= 70 ? colors.accentGreen : projection.critical < 50 ? colors.accentRed : colors.goldMid}
            />
            <MetricTile value={money(projection.openingLow)} label="Opening Low" size="sm" />
            <MetricTile value={money(projection.openingHigh)} label="Opening High" size="sm" accent={colors.accentGreen} />
          </View>
        </GlassCard>
      )}

      <View style={styles.actions}>
        <PremiumButton
          label="Open Detail"
          onPress={() => onOpenDetail(project.id)}
          variant="secondary"
          size="sm"
          style={styles.flexBtn}
        />
        <PremiumButton
          label="Advance Phase"
          onPress={() => onAdvancePhase(project.id)}
          variant="primary"
          size="sm"
          style={styles.flexBtn}
        />
      </View>
    </GlassCard>
  );
}
