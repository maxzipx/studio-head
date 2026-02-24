import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function recommendationLabel(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return 'Strong Buy';
  if (value === 'conditional') return 'Conditional Buy';
  return 'Pass';
}

export default function SlateScreen() {
  const router = useRouter();
  const { manager, acquireScript, advancePhase, passScript, setReleaseWeek, acceptOffer, counterOffer, walkAwayOffer, lastMessage } =
    useGame();

  const projects = manager.activeProjects;
  const inFlight = projects.filter((project) => project.phase !== 'released' && project.phase !== 'distribution');
  const distribution = projects.filter((project) => project.phase === 'distribution');
  const rivalCalendar = manager.rivals.flatMap((rival) =>
    rival.upcomingReleases.map((film) => ({
      rival: rival.name,
      week: film.releaseWeek,
      genre: film.genre,
      budget: film.estimatedBudget,
      title: film.title,
    }))
  );

  function pressureForWeek(week: number | null): { label: string; color: string } {
    if (!week) return { label: 'Unknown', color: tokens.textMuted };
    const overlaps = rivalCalendar.filter((film) => Math.abs(film.week - week) <= 1).length;
    if (overlaps === 0) return { label: 'Clear', color: tokens.accentTeal };
    if (overlaps <= 2) return { label: 'Moderate', color: tokens.accentGold };
    return { label: 'High', color: tokens.accentRed };
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Slate</Text>
      <Text style={styles.subtitle}>Development pipeline, production control, distribution and release outcomes</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pipeline Snapshot</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>In Flight</Text>
            <Text style={styles.metricValue}>{inFlight.length + distribution.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Scripts</Text>
            <Text style={styles.metricValue}>{manager.scriptMarket.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distribution</Text>
            <Text style={styles.metricValue}>{distribution.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Script Room</Text>
        {manager.scriptMarket.map((script) => (
          <View key={script.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{script.title}</Text>
              <Text style={styles.genre}>{script.genre}</Text>
            </View>
            <Text style={styles.body}>{script.logline}</Text>
            <Text style={styles.muted}>Ask: {money(script.askingPrice)} | Exp: {script.expiresInWeeks}w</Text>
            {(() => {
              const evalResult = manager.evaluateScriptPitch(script.id);
              if (!evalResult) return null;
              return (
                <Text style={styles.muted}>
                  {recommendationLabel(evalResult.recommendation)} | Score {evalResult.score.toFixed(0)} | ROI {evalResult.expectedROI.toFixed(2)}x | Fit{' '}
                  {pct(evalResult.fitScore)} | Risk {evalResult.riskLabel}
                </Text>
              );
            })()}
            <View style={styles.actions}>
              <Pressable style={styles.button} onPress={() => acquireScript(script.id)}>
                <Text style={styles.buttonText}>Acquire</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => passScript(script.id)}>
                <Text style={styles.buttonText}>Pass</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {manager.scriptMarket.length === 0 ? <Text style={styles.muted}>No active script offers this week.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>In-Flight Projects</Text>
        {inFlight.map((project) => {
          const projection = manager.getProjectedForProject(project.id);
          const burnPct = (project.budget.actualSpend / project.budget.ceiling) * 100;
          const director = project.directorId
            ? manager.talentPool.find((talent) => talent.id === project.directorId)?.name ?? 'Unknown'
            : 'Unattached';
          const cast = project.castIds
            .map((id) => manager.talentPool.find((talent) => talent.id === id)?.name)
            .filter((value): value is string => !!value);
          return (
            <View key={project.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{project.title}</Text>
                <Text style={styles.genre}>{project.phase}</Text>
              </View>
              <Text style={styles.body}>
                {project.genre} | Director: {director}
              </Text>
              <Text style={styles.muted}>Cast: {cast.length > 0 ? cast.join(', ') : 'None attached'}</Text>
              <Text style={styles.body}>
                Budget: {money(project.budget.actualSpend)} / {money(project.budget.ceiling)} ({burnPct.toFixed(1)}%)
              </Text>
              <Text style={styles.body}>Hype: {project.hypeScore.toFixed(0)} | Weeks Remaining: {project.scheduledWeeksRemaining}</Text>
              {projection ? (
                <Text style={styles.muted}>
                  Projection: Critic {projection.critical.toFixed(0)} | Opening {money(projection.openingLow)} - {money(projection.openingHigh)}
                </Text>
              ) : null}
              <Pressable
                style={styles.detailButton}
                onPress={() =>
                  router.push({
                    pathname: '/project/[id]',
                    params: { id: project.id },
                  })
                }>
                <Text style={styles.detailButtonText}>Open Project Detail</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => advancePhase(project.id)}>
                <Text style={styles.buttonText}>Advance Phase</Text>
              </Pressable>
            </View>
          );
        })}
        {inFlight.length === 0 ? <Text style={styles.muted}>No projects currently moving through production phases.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distribution Desk</Text>
        {distribution.map((project) => {
          const offers = manager.getOffersForProject(project.id);
          const pressure = pressureForWeek(project.releaseWeek);
          return (
            <View key={project.id} style={styles.card}>
              <Text style={styles.cardTitle}>{project.title}</Text>
              <Text style={styles.muted}>
                Week {project.releaseWeek ?? '-'} | Pressure: <Text style={{ color: pressure.color }}>{pressure.label}</Text>
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, !project.releaseWeek ? styles.buttonDisabled : null]}
                  disabled={!project.releaseWeek}
                  onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}>
                  <Text style={styles.buttonText}>Week -1</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, !project.releaseWeek ? styles.buttonDisabled : null]}
                  disabled={!project.releaseWeek}
                  onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}>
                  <Text style={styles.buttonText}>Week +1</Text>
                </Pressable>
              </View>
              <Pressable style={styles.releaseButton} onPress={() => advancePhase(project.id)}>
                <Text style={styles.releaseButtonText}>Advance To Release</Text>
              </Pressable>
              <Pressable
                style={styles.detailButton}
                onPress={() =>
                  router.push({
                    pathname: '/project/[id]',
                    params: { id: project.id },
                  })
                }>
                <Text style={styles.detailButtonText}>Open Project Detail</Text>
              </Pressable>
              {offers.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <Text style={styles.body}>
                    {offer.partner} | {offer.releaseWindow}
                  </Text>
                  <Text style={styles.muted}>
                    MG {money(offer.minimumGuarantee)} | P&A {money(offer.pAndACommitment)} | Share {(offer.revenueShareToStudio * 100).toFixed(0)}%
                  </Text>
                  <View style={styles.actions}>
                    <Pressable style={styles.button} onPress={() => acceptOffer(project.id, offer.id)}>
                      <Text style={styles.buttonText}>Accept</Text>
                    </Pressable>
                    <Pressable style={styles.button} onPress={() => counterOffer(project.id, offer.id)}>
                      <Text style={styles.buttonText}>Counter</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {offers.length === 0 ? (
                <Text style={styles.muted}>No offers right now. New offers can regenerate on End Week.</Text>
              ) : null}
              {offers.length > 0 ? (
                <Pressable style={styles.walkButton} onPress={() => walkAwayOffer(project.id)}>
                  <Text style={styles.walkButtonText}>Walk Away</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {distribution.length === 0 ? <Text style={styles.muted}>No projects in distribution phase.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPrimary },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { color: tokens.textPrimary, fontSize: 30, fontWeight: '700' },
  subtitle: { color: tokens.textSecondary, marginTop: -2, fontSize: 13 },
  message: { color: tokens.accentTeal, fontSize: 13 },
  section: { gap: 8 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 2,
  },
  metricLabel: { color: tokens.textMuted, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8, fontWeight: '600' },
  metricValue: { color: tokens.textPrimary, fontSize: 18, fontWeight: '700' },
  sectionTitle: {
    color: tokens.accentGold,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 6,
  },
  offerCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: tokens.textPrimary, fontSize: 18, fontWeight: '700' },
  genre: { color: tokens.accentGold, textTransform: 'capitalize', fontSize: 12, fontWeight: '600' },
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
  detailButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  detailButtonText: { color: tokens.textPrimary, fontWeight: '700', fontSize: 12 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: tokens.textPrimary, fontWeight: '600', fontSize: 12 },
  walkButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.accentRed,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  walkButtonText: { color: tokens.accentRed, fontWeight: '700', fontSize: 12 },
  releaseButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.accentGold,
    backgroundColor: '#6A5222',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  releaseButtonText: { color: tokens.textPrimary, fontWeight: '700', fontSize: 12 },
});
