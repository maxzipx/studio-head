import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function FinancialsScreen() {
  const { manager } = useGame();
  const projects = manager.activeProjects;
  const totalBudget = projects.reduce((sum, project) => sum + project.budget.ceiling, 0);
  const totalSpend = projects.reduce((sum, project) => sum + project.budget.actualSpend, 0);
  const released = projects.filter((project) => project.phase === 'released');
  const burnThisWeek = manager.estimateWeeklyBurn();
  const completionPct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const lastDelta = manager.lastWeekSummary?.cashDelta ?? 0;
  const runwayWeeks = burnThisWeek > 0 ? manager.cash / burnThisWeek : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Financials</Text>
      <Text style={styles.subtitle}>Cashflow, runway, and release performance</Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Cash Position</Text>
          <Text style={styles.metric}>{money(manager.cash)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Last Week Delta</Text>
          <Text style={[styles.metricSmall, lastDelta >= 0 ? styles.positive : styles.negative]}>
            {lastDelta >= 0 ? '+' : '-'}
            {money(Math.abs(lastDelta))}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Total Budgeted</Text>
          <Text style={styles.body}>{money(totalBudget)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Total Spend</Text>
          <Text style={styles.body}>{money(totalSpend)}</Text>
          <Text style={styles.muted}>{completionPct.toFixed(1)}% consumed</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Projected Weekly Burn</Text>
          <Text style={styles.body}>{money(burnThisWeek)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Runway</Text>
          <Text style={styles.body}>{runwayWeeks.toFixed(1)} weeks</Text>
          <Text style={styles.muted}>At current burn estimate</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Project ROI Matrix</Text>
        {projects.map((project) => (
          <View key={project.id} style={styles.rowLine}>
            <Text style={styles.body}>{project.title}</Text>
            <Text
              style={[
                styles.body,
                project.projectedROI >= 2 ? styles.positive : project.projectedROI < 1 ? styles.negative : null,
              ]}>
              {project.projectedROI.toFixed(2)}x
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Release Revenue</Text>
        {released.length === 0 ? <Text style={styles.muted}>No released projects yet.</Text> : null}
        {released.map((project) => (
          <Text key={project.id} style={styles.muted}>
            {project.title}: {money(project.finalBoxOffice ?? 0)} gross | share {(project.studioRevenueShare * 100).toFixed(0)}%
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPrimary },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  title: { color: tokens.textPrimary, fontSize: 30, fontWeight: '700' },
  subtitle: { color: tokens.textSecondary, marginTop: -2, fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 6,
  },
  label: {
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '600',
  },
  metric: { color: tokens.textPrimary, fontSize: 28, fontWeight: '700' },
  metricSmall: { color: tokens.textPrimary, fontSize: 22, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 13 },
  muted: { color: tokens.textMuted, fontSize: 12 },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  positive: { color: tokens.accentTeal, fontWeight: '700' },
  negative: { color: tokens.accentRed, fontWeight: '700' },
});
