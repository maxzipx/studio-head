import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function SlateScreen() {
  const { manager, advancePhase, lastMessage } = useGame();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Project Slate</Text>
      <Text style={styles.subtitle}>Active and developing films</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      {manager.activeProjects.map((project) => {
        const projection = manager.getProjectedForProject(project.id);
        const burnPct = (project.budget.actualSpend / project.budget.ceiling) * 100;
        const directorName = manager.talentPool.find((talent) => talent.id === project.directorId)?.name ?? 'Unattached';
        return (
          <View key={project.id} style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.projectTitle}>{project.title}</Text>
              <Text style={styles.phase}>{project.phase}</Text>
            </View>
            <Text style={styles.body}>Genre: {project.genre}</Text>
            <Text style={styles.body}>Budget: {money(project.budget.actualSpend)} / {money(project.budget.ceiling)}</Text>
            <Text style={styles.body}>Burn: {burnPct.toFixed(1)}%</Text>
            <Text style={styles.body}>Hype: {project.hypeScore.toFixed(0)} / 100</Text>
            <Text style={styles.body}>Weeks Remaining: {project.scheduledWeeksRemaining}</Text>
            <Text style={styles.body}>Director: {directorName}</Text>
            <Text style={styles.body}>Cast Attached: {project.castIds.length}</Text>
            {projection ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.muted}>Projected Critical: {projection.critical.toFixed(0)}</Text>
                <Text style={styles.muted}>
                  Opening Weekend: {money(projection.openingLow)} - {money(projection.openingHigh)}
                </Text>
                <Text style={styles.muted}>Projected ROI: {projection.roi.toFixed(2)}x</Text>
              </>
            ) : null}
            <Pressable style={styles.button} onPress={() => advancePhase(project.id)}>
              <Text style={styles.buttonText}>Advance Phase</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bgPrimary,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  title: {
    color: tokens.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: tokens.textSecondary,
    marginTop: -2,
    marginBottom: 8,
    fontSize: 13,
  },
  message: {
    color: tokens.accentTeal,
    fontSize: 13,
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 14,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectTitle: {
    color: tokens.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  phase: {
    color: tokens.accentGold,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
  },
  muted: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  divider: {
    marginVertical: 6,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
  },
  button: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: tokens.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
