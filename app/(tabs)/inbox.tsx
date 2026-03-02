import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

export default function InboxScreen() {
  const { manager, resolveCrisis, resolveDecision, dismissDecision, dismissInboxNotification } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      resolveCrisis: state.resolveCrisis,
      resolveDecision: state.resolveDecision,
      dismissDecision: state.dismissDecision,
      dismissInboxNotification: state.dismissInboxNotification,
      crisesSignature: mgr.pendingCrises.map(c => c.id).join('|'),
      decisionsSignature: mgr.decisionQueue.map(d => d.id).join('|'),
      inboxSignature: mgr.inboxNotifications.map((item) => item.id).join('|'),
      projectsSignature: mgr.activeProjects.map(p => p.id).join('|'),
    };
  }));
  const visibleCrises = manager.pendingCrises.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
  const visibleDecisions = manager.decisionQueue.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
  const visibleUpdates = manager.inboxNotifications.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
  const inboxCount = visibleCrises.length + visibleDecisions.length + visibleUpdates.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inbox</Text>
      <Text style={styles.subtitle}>Crises block week advancement until resolved</Text>

      {manager.pendingCrises.length !== visibleCrises.length ? (
        <View style={[styles.card, styles.crisisCard]}>
          <Text style={styles.crisisTitle}>Malformed crisis entries detected</Text>
          <Text style={styles.body}>Restart app to repair saved inbox data.</Text>
        </View>
      ) : null}
      {visibleCrises.map((crisis) => (
        <View key={crisis.id} style={[styles.card, styles.crisisCard]}>
          <Text style={styles.scope}>
            Affects: {manager.activeProjects.find((project) => project.id === crisis.projectId)?.title ?? 'Unknown project'}
          </Text>
          <Text style={styles.crisisTitle}>{crisis.title}</Text>
          <Text style={styles.body}>{crisis.body}</Text>
          <Text style={styles.severity}>Severity: {crisis.severity.toUpperCase()}</Text>
          {(Array.isArray(crisis.options) ? crisis.options : []).map((option) => (
            <Pressable key={option.id} style={styles.button} onPress={() => resolveCrisis(crisis.id, option.id)}>
              <Text style={styles.buttonTitle}>{option.label}</Text>
              <Text style={styles.buttonBody}>
                {option.preview} ({money(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}
                {option.scheduleDelta}w)
              </Text>
            </Pressable>
          ))}
          {(!Array.isArray(crisis.options) || crisis.options.length === 0) ? (
            <Text style={styles.buttonBody}>Crisis data is malformed. Restart app to repair saved inbox state.</Text>
          ) : null}
        </View>
      ))}

      {manager.decisionQueue.length !== visibleDecisions.length ? (
        <View style={styles.card}>
          <Text style={styles.decisionTitle}>Malformed decision entries detected</Text>
          <Text style={styles.body}>Use dismiss on broken items after restarting if they remain.</Text>
        </View>
      ) : null}
      {visibleDecisions.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.scope}>
            Scope: {item.projectId ? manager.activeProjects.find((project) => project.id === item.projectId)?.title ?? 'Unknown project' : 'Studio-wide'}
          </Text>
          <Text style={styles.decisionTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.expiry}>Expires in: {Math.max(0, item.weeksUntilExpiry)} week(s)</Text>
          {(Array.isArray(item.options) ? item.options : []).map((option) => (
            <Pressable key={option.id} style={styles.button} onPress={() => resolveDecision(item.id, option.id)}>
              <Text style={styles.buttonTitle}>{option.label}</Text>
              <Text style={styles.buttonBody}>
                {option.preview} ({money(option.cashDelta)})
              </Text>
            </Pressable>
          ))}
          {(Array.isArray(item.options) ? item.options : []).length === 0 ? (
            <Pressable style={styles.button} onPress={() => dismissDecision(item.id)}>
              <Text style={styles.buttonTitle}>Dismiss Broken Item</Text>
              <Text style={styles.buttonBody}>This decision entry is malformed and cannot be resolved normally.</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {visibleUpdates.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.scope}>
            Scope: {item.projectId ? manager.activeProjects.find((project) => project.id === item.projectId)?.title ?? 'Unknown project' : 'Studio-wide'}
          </Text>
          <Text style={styles.decisionTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Pressable style={styles.button} onPress={() => dismissInboxNotification(item.id)}>
            <Text style={styles.buttonTitle}>Dismiss</Text>
          </Pressable>
        </View>
      ))}

      {inboxCount === 0 ? (
        <View style={styles.card}>
          <Text style={styles.decisionTitle}>Inbox clear</Text>
          <Text style={styles.body}>No blocking crises, updates, or active decisions this week.</Text>
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
  scope: {
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
