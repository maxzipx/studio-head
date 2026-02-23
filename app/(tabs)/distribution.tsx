import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function DistributionScreen() {
  const { manager, acceptOffer, counterOffer, walkAwayOffer, setReleaseWeek, advancePhase, lastMessage } = useGame();
  const projects = manager.activeProjects.filter((project) => project.phase === 'distribution');
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
      <Text style={styles.title}>Distribution Deals</Text>
      <Text style={styles.subtitle}>Negotiate offers and pick release windows against rival calendar pressure</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      {projects.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No projects in distribution phase yet.</Text>
        </View>
      ) : null}

      {projects.map((project) => {
        const offers = manager.getOffersForProject(project.id);
        const projection = manager.getProjectedForProject(project.id);
        const pressure = pressureForWeek(project.releaseWeek);
        const nearby = rivalCalendar
          .filter((film) => project.releaseWeek && Math.abs(film.week - project.releaseWeek) <= 1)
          .slice(0, 5);

        return (
          <View key={project.id} style={styles.card}>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <Text style={styles.meta}>Weeks Remaining: {project.scheduledWeeksRemaining}</Text>
            <Text style={styles.meta}>Chosen Window: {project.releaseWindow ?? 'None selected'}</Text>
            <Text style={styles.meta}>Release Week: {project.releaseWeek ?? '-'}</Text>
            <Text style={[styles.meta, { color: pressure.color }]}>Calendar Pressure: {pressure.label}</Text>
            {projection ? (
              <Text style={styles.meta}>
                Projected Opening: {money(projection.openingLow)} - {money(projection.openingHigh)}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={styles.button}
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}>
                <Text style={styles.buttonText}>Week -1</Text>
              </Pressable>
              <Pressable
                style={styles.button}
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}>
                <Text style={styles.buttonText}>Week +1</Text>
              </Pressable>
            </View>
            <Pressable style={styles.releaseButton} onPress={() => advancePhase(project.id)}>
              <Text style={styles.releaseButtonText}>Advance To Release</Text>
            </Pressable>

            {nearby.length > 0 ? (
              <View style={styles.calendarCard}>
                <Text style={styles.offerTitle}>Nearby Rival Releases</Text>
                {nearby.map((film) => (
                  <Text key={`${film.rival}-${film.title}-${film.week}`} style={styles.meta}>
                    W{film.week}: {film.rival} - {film.title} ({film.genre}, {film.budget > 100_000_000 ? 'Tentpole' : 'Mid'})
                  </Text>
                ))}
              </View>
            ) : null}

            {offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <Text style={styles.offerTitle}>{offer.partner}</Text>
                <Text style={styles.meta}>Window: {offer.releaseWindow}</Text>
                <Text style={styles.meta}>MG: {money(offer.minimumGuarantee)}</Text>
                <Text style={styles.meta}>P&A: {money(offer.pAndACommitment)}</Text>
                <Text style={styles.meta}>Studio Share: {(offer.revenueShareToStudio * 100).toFixed(0)}%</Text>

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
            ) : (
              <Text style={styles.meta}>No active offers. End week to refresh offer flow.</Text>
            )}
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
    gap: 8,
  },
  projectTitle: { color: tokens.textPrimary, fontSize: 20, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 14 },
  meta: { color: tokens.textMuted, fontSize: 12 },
  offerCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 3,
  },
  calendarCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#1E2940',
    padding: 10,
    gap: 3,
  },
  offerTitle: { color: tokens.textPrimary, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  button: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#2A3650',
  },
  buttonText: { color: tokens.textPrimary, fontSize: 12, fontWeight: '600' },
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
