import { Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import { CollapsibleCard, GlassCard } from '@/src/ui/components';
import { ARC_LABELS, capitalize, stanceColor, stanceLabel } from '@/src/ui/hq/hq-helpers';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing, typography } from '@/src/ui/tokens';

function cycleStrengthLabel(momentum: number): string {
  const intensity = Math.abs(momentum);
  if (intensity >= 0.015) return 'Strong';
  if (intensity >= 0.007) return 'Moderate';
  return 'Mild';
}

interface HqIndustryPanelProps {
  manager: StudioManager;
  arcEntries: [string, StudioManager['storyArcs'][string]][];
  activeArcCount: number;
  hotGenres: ReturnType<StudioManager['getGenreCycleSnapshot']>;
  coolGenres: ReturnType<StudioManager['getGenreCycleSnapshot']>;
  leaderboard: ReturnType<StudioManager['getIndustryHeatLeaderboard']>;
  rivalRelations: StudioManager['rivals'];
  nextAwardsWeek: number;
  lastAwards: StudioManager['awardsHistory'][number] | undefined;
}

export function HqIndustryPanel({
  manager,
  arcEntries,
  activeArcCount,
  hotGenres,
  coolGenres,
  leaderboard,
  rivalRelations,
  nextAwardsWeek,
  lastAwards,
}: HqIndustryPanelProps) {
  return (
    <>
      <CollapsibleCard
        title="Story Arcs"
        badge={activeArcCount > 0 ? `${activeArcCount} Active` : undefined}
        badgeColor={colors.goldMid}
        defaultOpen={activeArcCount > 0}
      >
        {arcEntries.length === 0
          ? <Text style={styles.muted}>No major arc threads have started yet.</Text>
          : arcEntries.map(([arcId, arc]) => {
            const arcColor = arc.status === 'resolved' ? colors.accentGreen : arc.status === 'failed' ? colors.accentRed : colors.goldMid;
            return (
              <GlassCard key={arcId} variant="elevated" style={{ gap: spacing.sp2 }}>
                <View style={styles.arcRow}>
                  <Text style={styles.arcTitle}>{ARC_LABELS[arcId] ?? arcId}</Text>
                  <View style={[styles.arcBadge, { borderColor: arcColor + '50', backgroundColor: arcColor + '12' }]}>
                    <Text style={[styles.arcStatus, { color: arcColor }]}>{arc.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.muted}>Stage {arc.stage} | Last updated W{arc.lastUpdatedWeek}</Text>
              </GlassCard>
            );
          })}
      </CollapsibleCard>

      <CollapsibleCard title="Genre Cycles">
        <Text style={[styles.muted, { color: colors.accentGreen, fontFamily: typography.fontBodySemiBold }]}>Heating Up</Text>
        {hotGenres.map((entry) => (
          <View key={`hot-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{capitalize(entry.genre)}</Text>
            <Text style={[styles.muted, { color: colors.accentGreen }]}>
              {cycleStrengthLabel(entry.momentum)}
            </Text>
          </View>
        ))}
        <Text style={[styles.muted, { color: colors.accentRed, fontFamily: typography.fontBodySemiBold, marginTop: 4 }]}>Cooling Off</Text>
        {coolGenres.map((entry) => (
          <View key={`cool-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{capitalize(entry.genre)}</Text>
            <Text style={[styles.muted, { color: colors.accentRed }]}>
              {cycleStrengthLabel(entry.momentum)}
            </Text>
          </View>
        ))}
      </CollapsibleCard>

      <CollapsibleCard title="Industry Leaderboard">
        {leaderboard.map((entry, index) => (
          <View key={entry.name} style={styles.leaderRow}>
            <Text style={[styles.body, entry.isPlayer ? { color: colors.goldMid, fontFamily: typography.fontBodyBold } : null]}>
              #{index + 1} {entry.name}
            </Text>
            <Text style={[styles.body, entry.isPlayer ? { color: colors.goldMid, fontFamily: typography.fontBodyBold } : null]}>
              {entry.heat.toFixed(0)}
            </Text>
          </View>
        ))}
      </CollapsibleCard>

      <CollapsibleCard title="Rival Relations">
        {rivalRelations.map((rival) => {
          const stance = manager.rivalAiService.getRivalStance(rival);
          return (
            <View key={rival.id} style={styles.leaderRow}>
              <Text style={styles.body}>{rival.name}</Text>
              <Text style={[styles.muted, { color: stanceColor(stance) }]}>
                {stanceLabel(stance)}
              </Text>
            </View>
          );
        })}
      </CollapsibleCard>

      <CollapsibleCard title="Awards Pulse">
        <Text style={styles.body}>Next awards week: <Text style={{ color: colors.goldMid }}>W{nextAwardsWeek}</Text></Text>
        {lastAwards ? (
          <>
            <Text style={styles.bodyStrong}>{lastAwards.headline}</Text>
            {lastAwards.results.slice(0, 3).map((result) => (
              <Text key={`${lastAwards.seasonYear}-${result.projectId}`} style={styles.muted}>
                {result.title}: {result.nominations} nom(s), {result.wins} win(s)
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>No awards seasons have resolved yet.</Text>
        )}
      </CollapsibleCard>
    </>
  );
}
