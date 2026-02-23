import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

export default function TalentScreen() {
  const { manager, startNegotiation, attachTalent, lastMessage } = useGame();
  const activeProject = manager.activeProjects.find((project) => project.phase === 'development') ?? manager.activeProjects[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Talent Market</Text>
      <Text style={styles.subtitle}>Shared market with rival lock status and negotiation controls</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      {activeProject ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Target Project</Text>
          <Text style={styles.body}>{activeProject.title}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open Negotiations</Text>
        {manager.playerNegotiations.length === 0 ? <Text style={styles.muted}>No open negotiations.</Text> : null}
        {manager.playerNegotiations.map((entry) => {
          const talent = manager.talentPool.find((item) => item.id === entry.talentId);
          const project = manager.activeProjects.find((item) => item.id === entry.projectId);
          return (
            <Text key={`${entry.projectId}-${entry.talentId}`} style={styles.muted}>
              {talent?.name ?? 'Talent'} with {project?.title ?? 'Project'} (week {entry.openedWeek})
            </Text>
          );
        })}
      </View>

      {manager.talentPool.map((talent) => {
        const rival = manager.rivals.find((item) => item.lockedTalentIds.includes(talent.id));
        const status =
          talent.availability === 'unavailable' && rival
            ? `In Production - ${rival.name} (returns W${talent.unavailableUntilWeek ?? '-'})`
            : talent.availability;
        return (
          <View key={talent.id} style={styles.card}>
            <Text style={styles.cardTitle}>{talent.name}</Text>
            <Text style={styles.body}>
              {talent.role} | Star {talent.starPower.toFixed(1)} | Craft {talent.craftScore.toFixed(1)}
            </Text>
            <Text style={styles.muted}>Status: {status}</Text>
            <Text style={styles.muted}>Agent: {talent.agentTier.toUpperCase()} | Ego {talent.egoLevel.toFixed(1)}</Text>
            {activeProject && talent.availability === 'available' ? (
              <View style={styles.actions}>
                <Pressable style={styles.button} onPress={() => startNegotiation(activeProject.id, talent.id)}>
                  <Text style={styles.buttonText}>Open Negotiation</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => attachTalent(activeProject.id, talent.id)}>
                  <Text style={styles.buttonText}>Quick Close</Text>
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
  cardTitle: { color: tokens.textPrimary, fontSize: 18, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 13 },
  muted: { color: tokens.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#2A3650',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: { color: tokens.textPrimary, fontWeight: '600', fontSize: 12 },
});
