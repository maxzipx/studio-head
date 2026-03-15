import { Text, View } from 'react-native';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { NegotiationAction, PlayerNegotiation } from '@/src/domain/types';
import { GlassCard, PremiumButton } from '@/src/ui/components';
import { colors, spacing } from '@/src/ui/tokens';
import {
  capitalized,
  chanceColor,
  chanceLabel,
  money,
  pct,
} from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/talent/talent-styles';

interface TalentNegotiationCardProps {
  entry: PlayerNegotiation;
  manager: StudioManager;
  selectedAction: NegotiationAction | null;
  onSelectAction: (action: NegotiationAction) => void;
  onSubmitRound: () => void;
  onDrop: () => void;
}

export function TalentNegotiationCard({
  entry,
  manager,
  selectedAction,
  onSelectAction,
  onSubmitRound,
  onDrop,
}: TalentNegotiationCardProps) {
  const talent = manager.talentPool.find((t) => t.id === entry.talentId);
  const project = manager.activeProjects.find((p) => p.id === entry.projectId);
  const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
  const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
  const outOfRounds = (snapshot?.rounds ?? entry.rounds ?? 0) >= 4;

  return (
    <GlassCard key={`${entry.projectId}-${entry.talentId}`} variant="elevated" style={{ gap: spacing.sp2 }}>
      <View style={styles.negHeader}>
        <Text style={styles.subTitle}>{talent?.name ?? 'Talent'}</Text>
        {chance !== null && (
          <View style={[styles.chancePill, { borderColor: chanceColor(chance) + '60', backgroundColor: chanceColor(chance) + '14' }]}>
            <Text style={[styles.chanceText, { color: chanceColor(chance) }]}>
              {pct(chance)} - {chanceLabel(chance)}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.muted}>
        {project?.title} - opened W{entry.openedWeek} - resolves on End Turn
      </Text>

      {snapshot && (
        <>
          <Text style={styles.muted}>
            Rounds {snapshot.rounds}/4 - Pressure: {capitalized(snapshot.pressurePoint)}
          </Text>
          <View style={styles.offerRow}>
            <GlassCard variant="default" style={styles.offerCol}>
              <Text style={styles.offerLabel}>YOUR OFFER</Text>
              <Text style={styles.offerVal}>Salary {money((talent?.salary.base ?? 0) * snapshot.salaryMultiplier)}</Text>
              <Text style={styles.offerVal}>{snapshot.backendPoints.toFixed(1)}pt Backend</Text>
            </GlassCard>
            <GlassCard variant="default" style={styles.offerCol}>
              <Text style={styles.offerLabel}>THEIR ASK</Text>
              <Text style={styles.offerVal}>Salary {money((talent?.salary.base ?? 0) * snapshot.demandSalaryMultiplier)}</Text>
              <Text style={styles.offerVal}>{snapshot.demandBackendPoints.toFixed(1)}pt Backend</Text>
            </GlassCard>
          </View>
          <Text style={[styles.signal, { color: colors.goldMid }]}>{snapshot.signal}</Text>
          <Text style={styles.muted}>
            Counter impact: Salary +${Math.round(snapshot.sweetenSalaryRetainerDelta).toLocaleString()} retainer | Backend -{snapshot.sweetenBackendShareDeltaPct.toFixed(1)}% share | Perks +${Math.round(snapshot.sweetenPerksRetainerDelta).toLocaleString()} retainer
          </Text>
        </>
      )}
      {!snapshot && (
        <Text style={[styles.alert, { color: colors.accentRed }]}>
          Negotiation details failed to load. You can still submit a counter or dismiss this stuck entry.
        </Text>
      )}
      {outOfRounds && (
        <Text style={[styles.alert, { color: colors.goldMid }]}>
          Rounds exhausted. End Turn to resolve this negotiation.
        </Text>
      )}

      <View style={styles.actions}>
        {([
          { label: 'Salary+', action: 'sweetenSalary' as const },
          { label: 'Backend+', action: 'sweetenBackend' as const },
          { label: 'Perks+', action: 'sweetenPerks' as const },
          { label: 'Hold', action: 'holdFirm' as const },
        ]).map(({ label, action }) => (
          <PremiumButton
            key={action}
            label={label}
            onPress={() => onSelectAction(action)}
            variant={selectedAction === action ? 'primary' : 'secondary'}
            size="sm"
            disabled={outOfRounds}
            style={styles.negBtn}
          />
        ))}
      </View>
      <View style={styles.offerRow}>
        <PremiumButton
          label="Drop Negotiation"
          onPress={onDrop}
          variant="ghost"
          size="sm"
          style={styles.flexBtn}
        />
        <PremiumButton
          label="Submit Round"
          onPress={onSubmitRound}
          variant="primary"
          size="sm"
          disabled={outOfRounds || !selectedAction}
          style={styles.flexBtn}
        />
      </View>
    </GlassCard>
  );
}
