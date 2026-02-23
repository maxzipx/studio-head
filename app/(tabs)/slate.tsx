import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function SlateScreen() {
  const { manager, acquireScript, advancePhase, passScript, setReleaseWeek, acceptOffer, counterOffer, walkAwayOffer, lastMessage } =
    useGame();

  const projects = manager.activeProjects;
  const development = projects.filter((project) => project.phase === 'development');
  const distribution = projects.filter((project) => project.phase === 'distribution');
  const released = projects.filter((project) => project.phase === 'released');
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
        <Text style={styles.sectionTitle}>Script Room</Text>
        {manager.scriptMarket.map((script) => (
          <View key={script.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{script.title}</Text>
              <Text style={styles.genre}>{script.genre}</Text>
            </View>
            <Text style={styles.body}>{script.logline}</Text>
            <Text style={styles.muted}>Ask: {money(script.askingPrice)} | Exp: {script.expiresInWeeks}w</Text>
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
        <Text style={styles.sectionTitle}>Active Projects</Text>
        {projects.map((project) => {
          const projection = manager.getProjectedForProject(project.id);
          const burnPct = (project.budget.actualSpend / project.budget.ceiling) * 100;
          return (
            <View key={project.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{project.title}</Text>
                <Text style={styles.genre}>{project.phase}</Text>
              </View>
              <Text style={styles.body}>
                Budget: {money(project.budget.actualSpend)} / {money(project.budget.ceiling)} ({burnPct.toFixed(1)}%)
              </Text>
              <Text style={styles.body}>Hype: {project.hypeScore.toFixed(0)} | Weeks Remaining: {project.scheduledWeeksRemaining}</Text>
              {projection ? (
                <Text style={styles.muted}>
                  Projection: Critic {projection.critical.toFixed(0)} | Opening {money(projection.openingLow)} - {money(projection.openingHigh)}
                </Text>
              ) : null}
              <Pressable style={styles.button} onPress={() => advancePhase(project.id)}>
                <Text style={styles.buttonText}>Advance Phase</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distribution</Text>
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
                <Pressable style={styles.button} onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}>
                  <Text style={styles.buttonText}>Week -1</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}>
                  <Text style={styles.buttonText}>Week +1</Text>
                </Pressable>
              </View>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Release & Aftermath</Text>
        {released.map((project) => (
          <View key={project.id} style={styles.card}>
            <Text style={styles.cardTitle}>{project.title}</Text>
            <Text style={styles.muted}>
              Opening: {money(project.openingWeekendGross ?? 0)} | Total: {money(project.finalBoxOffice ?? 0)}
            </Text>
            <Text style={styles.muted}>
              ROI {project.projectedROI.toFixed(2)}x | {project.releaseResolved ? 'Run Completed' : `Run Active (${project.releaseWeeksRemaining}w)`}
            </Text>
          </View>
        ))}
        {released.length === 0 ? <Text style={styles.muted}>No released projects yet.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Development Queue</Text>
        {development.map((project) => (
          <Text key={project.id} style={styles.muted}>
            {project.title} | Director {project.directorId ? 'Attached' : 'Pending'} | Cast {project.castIds.length}
          </Text>
        ))}
        {development.length === 0 ? <Text style={styles.muted}>No projects in development.</Text> : null}
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
});
