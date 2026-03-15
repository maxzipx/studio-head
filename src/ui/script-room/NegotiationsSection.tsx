import { Pressable, Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import type { NegotiationAction } from '@/src/domain/types';
import { money, pct } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/script-room/script-room-styles';

interface NegotiationsSectionProps {
  manager: StudioManager;
  onAdjust: (projectId: string, talentId: string, action: NegotiationAction) => void;
}

export function NegotiationsSection({ manager, onAdjust }: NegotiationsSectionProps) {
  if (manager.playerNegotiations.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Open Negotiations</Text>
      <View style={styles.card}>
        {manager.playerNegotiations.map((entry) => {
          const talent = manager.talentPool.find((item) => item.id === entry.talentId);
          const project = manager.activeProjects.find((item) => item.id === entry.projectId);
          const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
          const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
          return (
            <View key={`${entry.projectId}-${entry.talentId}`} style={styles.subCard}>
              <Text style={styles.bodyStrong}>
                {talent?.name ?? 'Talent'} for {project?.title ?? 'Project'}
              </Text>
              <Text style={styles.muted}>
                Opened week {entry.openedWeek} | resolves on next End Turn | close chance {chance !== null ? pct(chance) : '--'}
              </Text>
              {snapshot ? (
                <>
                  <Text style={styles.muted}>
                    Rounds: {snapshot.rounds}/4 ({snapshot.roundsRemaining} left) | Pressure point: {snapshot.pressurePoint}
                  </Text>
                  <Text style={styles.muted}>
                    Offer: Salary {snapshot.salaryMultiplier.toFixed(2)}x | Backend {snapshot.backendPoints.toFixed(1)}pts | Perks{' '}
                    {money(snapshot.perksBudget)}
                  </Text>
                  <Text style={styles.muted}>
                    Ask: Salary {snapshot.demandSalaryMultiplier.toFixed(2)}x | Backend {snapshot.demandBackendPoints.toFixed(1)}pts | Perks{' '}
                    {money(snapshot.demandPerksBudget)}
                  </Text>
                  <Text style={styles.signal}>{snapshot.signal}</Text>
                  <Text style={styles.muted}>
                    Counter impact: Salary +{money(snapshot.sweetenSalaryRetainerDelta)} retainer | Backend -{snapshot.sweetenBackendShareDeltaPct.toFixed(1)}% studio share | Perks +{money(snapshot.sweetenPerksRetainerDelta)} retainer
                  </Text>
                  <View style={styles.negotiationActions}>
                    <Pressable
                      style={styles.negotiationButton}
                      onPress={() => onAdjust(entry.projectId, entry.talentId, 'sweetenSalary')}>
                      <Text style={styles.negotiationButtonText}>+Salary</Text>
                    </Pressable>
                    <Pressable
                      style={styles.negotiationButton}
                      onPress={() => onAdjust(entry.projectId, entry.talentId, 'sweetenBackend')}>
                      <Text style={styles.negotiationButtonText}>+Backend</Text>
                    </Pressable>
                    <Pressable
                      style={styles.negotiationButton}
                      onPress={() => onAdjust(entry.projectId, entry.talentId, 'sweetenPerks')}>
                      <Text style={styles.negotiationButtonText}>+Perks</Text>
                    </Pressable>
                    <Pressable
                      style={styles.negotiationButton}
                      onPress={() => onAdjust(entry.projectId, entry.talentId, 'holdFirm')}>
                      <Text style={styles.negotiationButtonText}>Hold Line</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
