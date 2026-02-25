import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function outcomeLabel(roi: number): string {
  if (roi >= 3) return 'BLOCKBUSTER';
  if (roi >= 1) return 'HIT';
  return 'FLOP';
}

export default function BoxOfficeScreen() {
  const { manager, lastMessage } = useGame();
  const released = manager.activeProjects
    .filter((project) => project.phase === 'released')
    .sort((a, b) => (b.finalBoxOffice ?? 0) - (a.finalBoxOffice ?? 0));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Film Vault</Text>
      <Text style={styles.subtitle}>Completed catalog with outcome and economics</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.filmCol]}>Film</Text>
        <Text style={styles.headerCell}>Budget</Text>
        <Text style={styles.headerCell}>Box Office</Text>
        <Text style={styles.headerCell}>Profit</Text>
        <Text style={styles.headerCell}>Outcome</Text>
      </View>

      {released.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No released projects yet.</Text>
          <Text style={styles.meta}>Move a project through distribution and into release to populate the vault.</Text>
        </View>
      ) : null}

      {released.map((project) => {
        const report = manager.getLatestReleaseReport(project.id);
        const totalBudget = report?.totalBudget ?? Math.round(project.budget.ceiling + project.marketingBudget);
        const totalGross = report?.totalGross ?? Math.round(project.finalBoxOffice ?? 0);
        const profit = report?.profit ?? Math.round(totalGross * project.studioRevenueShare - totalBudget);
        const roi = report?.roi ?? project.projectedROI;

        return (
          <View key={project.id} style={styles.card}>
            <View style={styles.tableRow}>
              <Text style={[styles.bodyStrong, styles.filmCol]}>{project.title}</Text>
              <Text style={styles.body}>{money(totalBudget)}</Text>
              <Text style={styles.body}>{money(totalGross)}</Text>
              <Text style={[styles.body, profit >= 0 ? styles.positive : styles.negative]}>{money(profit)}</Text>
              <Text style={[styles.bodyStrong, roi >= 1 ? styles.positive : styles.negative]}>{outcomeLabel(roi)}</Text>
            </View>
            <Text style={styles.meta}>
              ROI {roi.toFixed(2)}x | Critics {project.criticalScore?.toFixed(0) ?? '--'} | Audience {project.audienceScore?.toFixed(0) ?? '--'}
            </Text>
            <Text style={styles.meta}>
              Partner {project.distributionPartner ?? 'Unknown'} | Opening {money(project.openingWeekendGross ?? 0)} | Awards {project.awardsNominations} nom / {project.awardsWins} win
            </Text>
            {report ? (
              <Text style={styles.meta}>
                Drivers S:{report.breakdown.script >= 0 ? '+' : ''}
                {report.breakdown.script} D:{report.breakdown.direction >= 0 ? '+' : ''}
                {report.breakdown.direction} Star:{report.breakdown.starPower >= 0 ? '+' : ''}
                {report.breakdown.starPower} Mkt:{report.breakdown.marketing >= 0 ? '+' : ''}
                {report.breakdown.marketing}
              </Text>
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
  headerRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerCell: {
    color: tokens.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  filmCol: {
    flex: 1.7,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 4,
  },
  body: { color: tokens.textSecondary, fontSize: 12, flex: 1 },
  bodyStrong: { color: tokens.textPrimary, fontSize: 12, fontWeight: '700', flex: 1 },
  meta: { color: tokens.textMuted, fontSize: 12 },
  positive: { color: tokens.accentTeal },
  negative: { color: tokens.accentRed },
});
