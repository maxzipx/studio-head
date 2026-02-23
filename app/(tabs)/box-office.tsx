import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function BoxOfficeScreen() {
  const { manager, lastMessage } = useGame();
  const released = manager.activeProjects.filter((project) => project.phase === 'released');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Release & Aftermath</Text>
      <Text style={styles.subtitle}>Opening weekend, run progression, final impact</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      {released.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No released projects yet.</Text>
          <Text style={styles.meta}>Advance projects through Distribution and choose a deal.</Text>
        </View>
      ) : null}

      {released.map((project) => (
        <View key={project.id} style={styles.card}>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <Text style={styles.meta}>Partner: {project.distributionPartner ?? 'Unknown'}</Text>
          <Text style={styles.meta}>Window: {project.releaseWindow ?? 'N/A'}</Text>
          <Text style={styles.meta}>Opening: {money(project.openingWeekendGross ?? 0)}</Text>
          <Text style={styles.meta}>Current Total: {money(project.finalBoxOffice ?? 0)}</Text>
          <Text style={styles.meta}>Current ROI: {project.projectedROI.toFixed(2)}x</Text>
          <Text style={styles.meta}>
            Status: {project.releaseResolved ? 'Run Completed' : `Run Active (${project.releaseWeeksRemaining}w left)`}
          </Text>
          <Text style={styles.meta}>
            Critics: {project.criticalScore?.toFixed(0) ?? '--'} • Audience: {project.audienceScore?.toFixed(0) ?? '--'}
          </Text>

          <View style={styles.history}>
            <Text style={styles.historyTitle}>Weekly Gross</Text>
            {project.weeklyGrossHistory.map((value, index) => (
              <Text key={`${project.id}-${index}`} style={styles.historyLine}>
                Week {index + 1}: {money(value)}
              </Text>
            ))}
          </View>
        </View>
      ))}
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
    gap: 4,
  },
  body: { color: tokens.textSecondary, fontSize: 14 },
  projectTitle: { color: tokens.textPrimary, fontSize: 20, fontWeight: '700' },
  meta: { color: tokens.textMuted, fontSize: 12 },
  history: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    paddingTop: 8,
    gap: 2,
  },
  historyTitle: { color: tokens.textPrimary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  historyLine: { color: tokens.textSecondary, fontSize: 12 },
});
