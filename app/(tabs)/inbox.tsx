import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

export default function InboxScreen() {
  const { manager, resolveCrisis, resolveDecision } = useGame();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Decision Inbox</Text>
      <Text style={styles.subtitle}>Crises block week advancement until resolved</Text>

      {manager.pendingCrises.map((crisis) => (
        <View key={crisis.id} style={[styles.card, styles.crisisCard]}>
          <Text style={styles.crisisTitle}>{crisis.title}</Text>
          <Text style={styles.body}>{crisis.body}</Text>
          <Text style={styles.severity}>Severity: {crisis.severity.toUpperCase()}</Text>
          {crisis.options.map((option) => (
            <Pressable key={option.id} style={styles.button} onPress={() => resolveCrisis(crisis.id, option.id)}>
              <Text style={styles.buttonTitle}>{option.label}</Text>
              <Text style={styles.buttonBody}>
                {option.preview} ({money(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}
                {option.scheduleDelta}w)
              </Text>
            </Pressable>
          ))}
        </View>
      ))}

      {manager.decisionQueue.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.decisionTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.expiry}>Expires in: {Math.max(0, item.weeksUntilExpiry)} week(s)</Text>
          {item.options.map((option) => (
            <Pressable key={option.id} style={styles.button} onPress={() => resolveDecision(item.id, option.id)}>
              <Text style={styles.buttonTitle}>{option.label}</Text>
              <Text style={styles.buttonBody}>
                {option.preview} ({money(option.cashDelta)})
              </Text>
            </Pressable>
          ))}
        </View>
      ))}

      {manager.pendingCrises.length === 0 && manager.decisionQueue.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.decisionTitle}>Inbox clear</Text>
          <Text style={styles.body}>No blocking crises and no active decisions this week.</Text>
        </View>
      ) : null}
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 14,
    gap: 6,
  },
  crisisCard: {
    borderColor: tokens.accentRed,
  },
  crisisTitle: {
    color: tokens.accentRed,
    fontSize: 18,
    fontWeight: '700',
  },
  decisionTitle: {
    color: tokens.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  severity: {
    color: tokens.accentRed,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
  },
  expiry: {
    color: tokens.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  button: {
    backgroundColor: tokens.bgElevated,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  buttonTitle: {
    color: tokens.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonBody: {
    color: tokens.textMuted,
    fontSize: 12,
  },
});
