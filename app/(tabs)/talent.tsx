import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function chanceLabel(value: number): string {
  if (value >= 0.75) return 'Likely';
  if (value >= 0.5) return 'Even Odds';
  return 'Long Shot';
}

function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleLabel(value: string): string {
  return value === 'leadActor' ? 'Lead Actor' : value === 'supportingActor' ? 'Supporting Actor' : value;
}

export default function TalentScreen() {
  const { manager, startNegotiation, adjustNegotiation, attachTalent, lastMessage } = useGame();
  const developmentProjects = manager.activeProjects.filter((project) => project.phase === 'development');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(developmentProjects[0]?.id ?? null);
  const activeProject = selectedProjectId ? developmentProjects.find((project) => project.id === selectedProjectId) ?? null : null;
  const projectLedger = manager.activeProjects.filter((project) => project.phase !== 'released');

  useEffect(() => {
    const selectionStillValid = !!selectedProjectId && developmentProjects.some((project) => project.id === selectedProjectId);
    if (selectionStillValid) return;
    setSelectedProjectId(developmentProjects[0]?.id ?? null);
  }, [developmentProjects, selectedProjectId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Talent Market</Text>
      <Text style={styles.subtitle}>Shared market with rival lock status and negotiation controls</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Star vs Craft</Text>
        <Text style={styles.body}>
          Star = audience draw and launch heat. Craft = execution quality and critic stability. Big stars open films; high craft sustains reviews.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Development Targets</Text>
        {developmentProjects.length === 0 ? <Text style={styles.muted}>No development-phase project is available for attachment right now.</Text> : null}
        {developmentProjects.map((project) => (
          <Pressable
            key={project.id}
            style={[styles.targetButton, selectedProjectId === project.id ? styles.targetButtonActive : null]}
            onPress={() => setSelectedProjectId(project.id)}>
            <Text style={styles.targetButtonText}>
              {project.title} ({project.genre})
            </Text>
          </Pressable>
        ))}
      </View>

      {activeProject ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Target Project</Text>
          <Text style={styles.body}>
            {activeProject.title} ({activeProject.genre}) | {activeProject.phase}
          </Text>
          <Text style={styles.muted}>
            Director:{' '}
            {activeProject.directorId
              ? manager.talentPool.find((talent) => talent.id === activeProject.directorId)?.name ?? 'Unknown'
              : 'Unattached'}
          </Text>
          <Text style={styles.muted}>
            Cast:{' '}
            {activeProject.castIds.length > 0
              ? activeProject.castIds
                  .map((id) => manager.talentPool.find((talent) => talent.id === id)?.name)
                  .filter((value): value is string => !!value)
                  .join(', ')
              : 'None'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Project Ledger</Text>
        {projectLedger.length === 0 ? <Text style={styles.muted}>No active projects.</Text> : null}
        {projectLedger.map((project) => {
          const director = project.directorId
            ? manager.talentPool.find((talent) => talent.id === project.directorId)?.name ?? 'Unknown'
            : 'Unattached';
          const cast = project.castIds
            .map((id) => manager.talentPool.find((talent) => talent.id === id)?.name)
            .filter((value): value is string => !!value);
          return (
            <View key={project.id} style={styles.subCard}>
              <Text style={styles.bodyStrong}>
                {project.title} | {project.genre} | {project.phase}
              </Text>
              <Text style={styles.muted}>Director: {director}</Text>
              <Text style={styles.muted}>Cast: {cast.length > 0 ? cast.join(', ') : 'None'}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open Negotiations</Text>
        {manager.playerNegotiations.length === 0 ? <Text style={styles.muted}>No open negotiations.</Text> : null}
        {manager.playerNegotiations.map((entry) => {
          const talent = manager.talentPool.find((item) => item.id === entry.talentId);
          const project = manager.activeProjects.find((item) => item.id === entry.projectId);
          const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
          const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
          return (
            <View key={`${entry.projectId}-${entry.talentId}`} style={styles.subCard}>
              <Text style={styles.bodyStrong}>
                {talent?.name ?? 'Talent'} with {project?.title ?? 'Project'}
              </Text>
              <Text style={styles.muted}>
                Opened week {entry.openedWeek} | resolves on next End Week | close chance{' '}
                {chance !== null ? `${pct(chance)} — ${chanceLabel(chance)}` : '--'}
              </Text>
              {snapshot ? (
                <>
                  <Text style={styles.muted}>
                    Rounds: {snapshot.rounds}/4 ({snapshot.roundsRemaining} left) | Pressure: {capitalized(snapshot.pressurePoint)}
                  </Text>
                  <Text style={styles.muted}>
                    Offer: Salary {snapshot.salaryMultiplier.toFixed(2)}x | Backend {snapshot.backendPoints.toFixed(1)}pts | Perks ${Math.round(
                      snapshot.perksBudget
                    ).toLocaleString()}
                  </Text>
                  <Text style={styles.muted}>
                    Ask: Salary {snapshot.demandSalaryMultiplier.toFixed(2)}x | Backend {snapshot.demandBackendPoints.toFixed(1)}pts | Perks $
                    {Math.round(snapshot.demandPerksBudget).toLocaleString()}
                  </Text>
                  <Text style={styles.signal}>{snapshot.signal}</Text>
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.smallButton, snapshot.pressurePoint === 'salary' ? styles.smallButtonHighlight : null]}
                      onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenSalary')}>
                      <Text style={styles.smallButtonText}>+Salary</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, snapshot.pressurePoint === 'backend' ? styles.smallButtonHighlight : null]}
                      onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenBackend')}>
                      <Text style={styles.smallButtonText}>+Backend</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.smallButton, snapshot.pressurePoint === 'perks' ? styles.smallButtonHighlight : null]}
                      onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenPerks')}>
                      <Text style={styles.smallButtonText}>+Perks</Text>
                    </Pressable>
                    <Pressable style={styles.smallButton} onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'holdFirm')}>
                      <Text style={styles.smallButtonText}>Hold Line</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {manager.talentPool.map((talent) => {
        const rival = manager.rivals.find((item) => item.lockedTalentIds.includes(talent.id));
        const attachedProject =
          talent.attachedProjectId && manager.activeProjects.find((project) => project.id === talent.attachedProjectId);
        const status =
          talent.availability === 'unavailable' && rival
            ? `In Production - ${rival.name} (returns W${talent.unavailableUntilWeek ?? '-'})`
            : talent.availability;
        const topFit = Object.entries(talent.genreFit).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
        return (
          <View key={talent.id} style={styles.card}>
            <Text style={styles.cardTitle}>{talent.name}</Text>
            <Text style={styles.body}>
              {roleLabel(talent.role)} | Star {talent.starPower.toFixed(1)} | Craft {talent.craftScore.toFixed(1)}
            </Text>
            <Text style={styles.muted}>Status: {status}</Text>
            <Text style={styles.muted}>Agent: {talent.agentTier.toUpperCase()} | Ego {talent.egoLevel.toFixed(1)}</Text>
            <Text style={styles.muted}>Relationship: {talent.studioRelationship.toFixed(2)} | Reputation: {talent.reputation.toFixed(1)}</Text>
            <Text style={styles.muted}>
              Best fit: {topFit ? `${topFit[0]} (${pct(topFit[1] ?? 0)})` : 'Generalist'}
            </Text>
            {attachedProject ? <Text style={styles.muted}>Attached to: {attachedProject.title}</Text> : null}
            {activeProject && talent.availability === 'available' ? (
              <View style={styles.actions}>
                <Pressable style={styles.button} onPress={() => startNegotiation(activeProject.id, talent.id)}>
                  <Text style={styles.buttonText}>Open Negotiation {pct(manager.getNegotiationChance(talent.id, activeProject.id) ?? 0)}</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => attachTalent(activeProject.id, talent.id)}>
                  <Text style={styles.buttonText}>Quick Close {pct(manager.getQuickCloseChance(talent.id) ?? 0)}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPrimary },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  title: { color: tokens.textPrimary, fontSize: 30, fontWeight: '700' },
  subtitle: { color: tokens.textSecondary, marginTop: -2, fontSize: 13 },
  message: { color: tokens.accentTeal, fontSize: 13 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 6,
  },
  subCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 8,
    gap: 4,
  },
  cardTitle: { color: tokens.textPrimary, fontSize: 18, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 13 },
  bodyStrong: { color: tokens.textPrimary, fontSize: 13, fontWeight: '700' },
  muted: { color: tokens.textMuted, fontSize: 12 },
  signal: { color: tokens.accentGold, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  targetButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  targetButtonActive: {
    borderColor: tokens.accentGold,
    backgroundColor: '#3B2E14',
  },
  targetButtonText: { color: tokens.textPrimary, fontWeight: '600', fontSize: 12 },
  button: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#2A3650',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: { color: tokens.textPrimary, fontWeight: '600', fontSize: 12 },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  smallButtonText: { color: tokens.textPrimary, fontWeight: '700', fontSize: 11 },
  smallButtonHighlight: {
    borderColor: tokens.accentGold,
    backgroundColor: '#3B2E14',
  },
});
