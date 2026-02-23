import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function HQScreen() {
  const { manager, endWeek, runOptionalAction } = useGame();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Studio HQ</Text>
      <Text style={styles.subtitle}>
        Week {manager.currentWeek} • {manager.studioName}
      </Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Cash Position</Text>
          <Text style={styles.metric}>{money(manager.cash)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Studio Heat</Text>
          <Text style={styles.metric}>{manager.studioHeat.toFixed(0)} / 100</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Weekly Status</Text>
        <Text style={styles.body}>Crises: {manager.pendingCrises.length}</Text>
        <Text style={styles.body}>Inbox Items: {manager.decisionQueue.length}</Text>
        <Text style={styles.body}>Active Projects: {manager.activeProjects.length}</Text>
        {!manager.canEndWeek ? <Text style={styles.alert}>Resolve crisis to unlock End Week.</Text> : null}
      </View>

      {manager.lastWeekSummary ? (
        <View style={styles.card}>
          <Text style={styles.label}>Last Week Summary</Text>
          <Text style={styles.body}>
            Cash Delta: {manager.lastWeekSummary.cashDelta >= 0 ? '+' : '-'}
            {money(Math.abs(manager.lastWeekSummary.cashDelta))}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.mutedBody}>
              • {event}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={runOptionalAction}>
        <Text style={styles.secondaryButtonText}>Run Optional Action (+Hype)</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, !manager.canEndWeek ? styles.disabledButton : null]}
        disabled={!manager.canEndWeek}
        onPress={endWeek}>
        <Text style={styles.primaryButtonText}>{manager.canEndWeek ? 'End Week' : 'Resolve Crisis First'}</Text>
      </Pressable>
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 14,
    gap: 6,
  },
  label: {
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '600',
  },
  metric: {
    color: tokens.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
  },
  mutedBody: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  alert: {
    color: tokens.accentRed,
    marginTop: 4,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: tokens.accentGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#241B0D',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: tokens.bgElevated,
    borderColor: tokens.border,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: tokens.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#5A4C31',
  },
});
