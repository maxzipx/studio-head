import { Text, View } from 'react-native';

import type { MovieProject, ReleaseReport, SequelEligibility } from '@/src/domain/types';
import { GlassCard, MetricTile, OutcomeBadge, PremiumButton, ProgressBar, SectionLabel } from '@/src/ui/components';
import { colors, spacing } from '@/src/ui/tokens';
import { money, outcomeFromReport, roiColor } from '@/src/ui/project/project-helpers';
import { styles } from '@/src/ui/project/project-styles';

interface ProjectReleasePerformanceCardProps {
  project: MovieProject;
  releaseReport: ReleaseReport | null;
  sequelEligibility: SequelEligibility | null;
  onStartSequel: (projectId: string) => void;
}

export function ProjectReleasePerformanceCard({
  project,
  releaseReport,
  sequelEligibility,
  onStartSequel,
}: ProjectReleasePerformanceCardProps) {
  if (project.phase !== 'released') return null;

  return (
    <GlassCard variant="champagne">
      <SectionLabel label="Release Performance" />
      {releaseReport ? (
        <View style={styles.outcomeRow}>
          <OutcomeBadge outcome={outcomeFromReport(releaseReport.outcome)} />
        </View>
      ) : null}
      <View style={styles.metricsRow}>
        <MetricTile value={money(project.openingWeekendGross ?? 0)} label="Opening" size="sm" style={styles.metricFlex} />
        <MetricTile value={money(project.finalBoxOffice ?? 0)} label="Total Gross" size="sm" style={styles.metricFlex} />
      </View>
      <View style={styles.metricsRow}>
        <MetricTile value={project.criticalScore?.toFixed(0) ?? '--'} label="Critics" size="sm" style={styles.metricFlex} />
        <MetricTile value={project.audienceScore?.toFixed(0) ?? '--'} label="Audience" size="sm" style={styles.metricFlex} />
      </View>
      <MetricTile
        value={`${project.projectedROI.toFixed(2)}x`}
        label="ROI"
        size="md"
        accent={roiColor(project.projectedROI)}
      />
      <Text style={styles.mutedText}>
        {project.awardsNominations} nomination{project.awardsNominations !== 1 ? 's' : ''} · {project.awardsWins} win{project.awardsWins !== 1 ? 's' : ''}
      </Text>

      {releaseReport ? (
        <>
          <MetricTile
            value={money(Math.abs(releaseReport.profit))}
            label={releaseReport.profit >= 0 ? 'Profit' : 'Loss'}
            size="sm"
            accent={releaseReport.profit >= 0 ? colors.accentGreen : colors.accentRed}
          />
          <SectionLabel label="Performance Drivers" style={{ marginTop: spacing.sp2 }} />
          {(Object.entries(releaseReport.breakdown) as [string, number][]).map(([key, val]) => (
            <View key={key} style={{ gap: 2 }}>
              <Text style={styles.mutedText}>
                {key.replace(/([A-Z])/g, ' $1').trim()} {val >= 0 ? '+' : ''}{val}
              </Text>
              <ProgressBar
                value={50 + Math.max(-50, Math.min(50, val))}
                color={val >= 0 ? colors.accentGreen : colors.accentRed}
                height={6}
              />
            </View>
          ))}
        </>
      ) : null}

      {sequelEligibility ? (
        <>
          <SectionLabel label="Sequel Eligibility" style={{ marginTop: spacing.sp3 }} />
          <Text style={styles.bodyText}>
            Episode {sequelEligibility.nextEpisode} · Upfront {money(sequelEligibility.upfrontCost)}
          </Text>
          <View style={styles.metricsRow}>
            <MetricTile value={sequelEligibility.projectedMomentum.toFixed(0)} label="Momentum" size="sm" style={styles.metricFlex} />
            <MetricTile value={sequelEligibility.projectedFatigue.toFixed(0)} label="Fatigue" size="sm" style={styles.metricFlex} />
            <MetricTile value={sequelEligibility.carryoverHype.toFixed(0)} label="Carry Hype" size="sm" style={styles.metricFlex} />
          </View>
          {!sequelEligibility.eligible && sequelEligibility.reason ? (
            <Text style={[styles.mutedText, { color: colors.accentRed }]}>{sequelEligibility.reason}</Text>
          ) : null}
          <PremiumButton
            variant="primary"
            size="md"
            label="Start Sequel Development"
            onPress={() => onStartSequel(project.id)}
            disabled={!sequelEligibility.eligible}
          />
        </>
      ) : null}
    </GlassCard>
  );
}
