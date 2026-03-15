import { Text, View } from 'react-native';

import type { DistributionOffer, MovieProject } from '@/src/domain/types';
import { GlassCard, MetricTile, PremiumButton } from '@/src/ui/components';
import { money } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/slate/slate-styles';
import { colors, spacing, typography } from '@/src/ui/tokens';

interface SlateDistributionCardProps {
  project: MovieProject;
  offers: DistributionOffer[];
  pressure: { label: string; color: string };
  onSetReleaseWeek: (projectId: string, week: number) => void;
  onConfirmReleaseWeek: (projectId: string) => void;
  onAcceptOffer: (projectId: string, offerId: string) => void;
  onCounterOffer: (projectId: string, offerId: string) => void;
  onWalkAway: (projectId: string) => void;
  onOpenDetail: (projectId: string) => void;
  onAdvancePhase: (projectId: string) => void;
}

export function SlateDistributionCard({
  project,
  offers,
  pressure,
  onSetReleaseWeek,
  onConfirmReleaseWeek,
  onAcceptOffer,
  onCounterOffer,
  onWalkAway,
  onOpenDetail,
  onAdvancePhase,
}: SlateDistributionCardProps) {
  return (
    <GlassCard key={project.id} variant="gold" style={{ gap: spacing.sp2 }}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{project.title}</Text>
        <Text style={[styles.pressureLabel, { color: pressure.color }]}>
          {pressure.label} Pressure
        </Text>
      </View>

      <Text style={styles.releaseWeekLine}>
        Release Week{' '}
        <Text style={{ color: colors.goldMid, fontFamily: typography.fontBodyBold }}>
          {project.releaseWeek ?? '\u2014'}
        </Text>
      </Text>
      <Text style={styles.metaText}>
        {project.releaseWeek === null
          ? 'Release status: week not set'
          : project.releaseWeekLocked
            ? `Release status: locked for week ${project.releaseWeek}`
            : `Release status: suggested week ${project.releaseWeek} still needs confirmation`}
      </Text>

      <View style={styles.actions}>
        <PremiumButton
          label="Week \u22121"
          onPress={() => project.releaseWeek && onSetReleaseWeek(project.id, project.releaseWeek - 1)}
          disabled={!project.releaseWeek}
          variant="secondary"
          size="sm"
          style={styles.flexBtn}
        />
        <PremiumButton
          label="Week +1"
          onPress={() => project.releaseWeek && onSetReleaseWeek(project.id, project.releaseWeek + 1)}
          disabled={!project.releaseWeek}
          variant="secondary"
          size="sm"
          style={styles.flexBtn}
        />
      </View>
      {project.releaseWeek && !project.releaseWeekLocked ? (
        <PremiumButton
          label="Confirm Suggested Week"
          onPress={() => onConfirmReleaseWeek(project.id)}
          variant="gold-outline"
          size="sm"
        />
      ) : null}

      {offers.map((offer) => (
        <GlassCard key={offer.id} variant="elevated" style={{ gap: spacing.sp2 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.offerPartner}>{offer.partner}</Text>
            <View style={[styles.pill, { borderColor: colors.goldMid + '40' }]}>
              <Text style={styles.pillText}>{offer.releaseWindow}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <MetricTile value={money(offer.minimumGuarantee)} label="Min Guarantee" size="sm" accent={colors.accentGreen} />
            <MetricTile value={money(offer.pAndACommitment)} label="P&A" size="sm" />
            <MetricTile value={`${(offer.revenueShareToStudio * 100).toFixed(0)}%`} label="Rev Share" size="sm" accent={colors.goldMid} />
          </View>
          <View style={styles.actions}>
            <PremiumButton label="Accept" onPress={() => onAcceptOffer(project.id, offer.id)} variant="primary" size="sm" style={styles.flexBtn} />
            <PremiumButton label="Counter" onPress={() => onCounterOffer(project.id, offer.id)} variant="gold-outline" size="sm" style={styles.flexBtn} />
          </View>
        </GlassCard>
      ))}

      {offers.length === 0 && (
        <Text style={styles.empty}>No offers right now. Regenerates on End Turn.</Text>
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
          label="Advance To Release"
          onPress={() => onAdvancePhase(project.id)}
          variant="primary"
          size="sm"
          style={styles.flexBtn}
        />
      </View>

      {offers.length > 0 && (
        <PremiumButton label="Walk Away" onPress={() => onWalkAway(project.id)} variant="danger" size="sm" />
      )}
    </GlassCard>
  );
}
