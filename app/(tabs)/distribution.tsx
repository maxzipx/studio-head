import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function DistributionScreen() {
  const { manager, acceptOffer, counterOffer, walkAwayOffer, setReleaseWeek, advancePhase, lastMessage } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      acceptOffer: state.acceptOffer,
      counterOffer: state.counterOffer,
      walkAwayOffer: state.walkAwayOffer,
      setReleaseWeek: state.setReleaseWeek,
      advancePhase: state.advancePhase,
      lastMessage: state.lastMessage,
      distributionSignature: mgr.activeProjects
        .filter((p) => p.phase === 'distribution')
        .map(
          (p) =>
            `${p.id}:${p.scheduledWeeksRemaining}:${p.releaseWeek}:${p.releaseWindow ?? 'none'}:${p.budget.actualSpend}:` +
            `${p.studioRevenueShare}:${p.marketingBudget}`
        )
        .join('|'),
      offersSignature: mgr.activeProjects
        .filter((p) => p.phase === 'distribution')
        .map((p) =>
          mgr
            .getOffersForProject(p.id)
            .map(
              (o) =>
                `${o.id}:${o.partner}:${o.releaseWindow}:${o.minimumGuarantee}:${o.pAndACommitment}:${o.revenueShareToStudio}:` +
                `${o.counterAttempts}`
            )
            .join(',')
        )
        .join('|'),
      rivalsSignature: mgr.rivals
        .flatMap((r) => r.upcomingReleases.map((f) => `${r.id}:${f.id}:${f.releaseWeek}:${f.genre}:${f.estimatedBudget}`))
        .join('|'),
    };
  }));
  const [showHelp, setShowHelp] = useState(false);
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
    if (overlaps === 0) return { label: 'Clear', color: tokens.accentGreen };
    if (overlaps <= 2) return { label: 'Moderate', color: tokens.accentGold };
    return { label: 'High', color: tokens.accentRed };
  }

  function confirmRelease(projectId: string, title: string, openingBand: string): void {
    Alert.alert(
      `Release ${title}?`,
      `Opening forecast will lock at ${openingBand}. Talent attached to this project will return to the market.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: () => {
            const beforeReleased = manager.activeProjects.find((project) => project.id === projectId)?.phase === 'released';
            advancePhase(projectId);
            const afterReleased = manager.activeProjects.find((project) => project.id === projectId)?.phase === 'released';
            if (!beforeReleased && !afterReleased) {
              Alert.alert('Release Blocked', 'Release conditions changed. Re-check readiness and blockers before trying again.');
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Distribution Deals</Text>
      <Text style={styles.subtitle}>Negotiate offers, manage calendar pressure, and confirm release timing</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}
      <Pressable style={styles.button} onPress={() => setShowHelp((value) => !value)}>
        <Text style={styles.buttonText}>{showHelp ? 'Hide Help' : 'Show Help'}</Text>
      </Pressable>
      {showHelp ? (
        <View style={styles.card}>
          <Text style={styles.body}>Checklist: lock a deal, set release week, verify opening forecast, then release.</Text>
          <Text style={styles.meta}>Counter once for better terms. Walking away hurts distributor reputation.</Text>
        </View>
      ) : null}

      {projects.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.body}>No projects in distribution phase yet.</Text>
        </View>
      ) : null}

      {projects.map((project) => {
        const offers = manager.getOffersForProject(project.id);
        const projection = manager.getProjectedForProject(project.id);
        const hasProjection = !!projection;
        const minWeek = manager.currentWeek + 1;
        const maxWeek = manager.currentWeek + 52;
        const releaseWeek = project.releaseWeek;
        const previousWeek = releaseWeek ? Math.max(minWeek, releaseWeek - 1) : null;
        const nextWeek = releaseWeek ? Math.min(maxWeek, releaseWeek + 1) : null;
        const projectionPrevious =
          releaseWeek && previousWeek !== null ? manager.getProjectedForProjectAtWeek(project.id, previousWeek) : null;
        const projectionNext = releaseWeek && nextWeek !== null ? manager.getProjectedForProjectAtWeek(project.id, nextWeek) : null;
        const readinessChecks = [
          {
            label:
              project.scheduledWeeksRemaining <= 0
                ? 'Distribution setup complete'
                : `${project.scheduledWeeksRemaining} setup week(s) remaining`,
            ok: project.scheduledWeeksRemaining <= 0,
          },
          {
            label: project.releaseWindow ? `Deal locked (${project.releaseWindow})` : 'No accepted distribution deal',
            ok: !!project.releaseWindow,
          },
          {
            label: releaseWeek ? `Release week set (W${releaseWeek})` : 'Release week not set',
            ok: !!releaseWeek,
          },
          {
            label: hasProjection ? 'Opening forecast available' : 'Opening forecast unavailable',
            ok: hasProjection,
          },
        ];
        const blockers = readinessChecks.filter((item) => !item.ok).map((item) => item.label);
        const canRelease = blockers.length === 0;
        const openingBand = projection ? `${money(projection.openingLow)} - ${money(projection.openingHigh)}` : null;
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

            <View style={[styles.readinessCard, canRelease ? styles.readinessReady : styles.readinessBlocked]}>
              <Text style={styles.offerTitle}>Release Readiness</Text>
              {readinessChecks.map((item) => (
                <Text key={item.label} style={[styles.meta, item.ok ? styles.readyText : styles.blockedText]}>
                  {item.ok ? 'OK' : 'BLOCKED'}: {item.label}
                </Text>
              ))}
              {canRelease ? <Text style={styles.meta}>Ready to release this week.</Text> : null}
            </View>

            {projection && releaseWeek && projectionPrevious && projectionNext ? (
              <View style={styles.shiftCard}>
                <Text style={styles.offerTitle}>Week Shift Forecast</Text>
                <Text style={styles.meta}>Current W{releaseWeek}: {openingBand}</Text>
                <Text
                  style={[
                    styles.meta,
                    projectionPrevious.openingHigh - projection.openingHigh >= 0 ? styles.readyText : styles.blockedText,
                  ]}>
                  W{previousWeek}: {money(projectionPrevious.openingLow)} - {money(projectionPrevious.openingHigh)} (
                  {signedMoney(projectionPrevious.openingHigh - projection.openingHigh)} vs current high)
                </Text>
                <Text
                  style={[
                    styles.meta,
                    projectionNext.openingHigh - projection.openingHigh >= 0 ? styles.readyText : styles.blockedText,
                  ]}>
                  W{nextWeek}: {money(projectionNext.openingLow)} - {money(projectionNext.openingHigh)} (
                  {signedMoney(projectionNext.openingHigh - projection.openingHigh)} vs current high)
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, !releaseWeek ? styles.buttonDisabled : null]}
                disabled={!releaseWeek}
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}>
                <Text style={styles.buttonText}>Week -1</Text>
              </Pressable>
              <Pressable
                style={[styles.button, !releaseWeek ? styles.buttonDisabled : null]}
                disabled={!releaseWeek}
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}>
                <Text style={styles.buttonText}>Week +1</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.releaseButton, !canRelease ? styles.buttonDisabled : null]}
              disabled={!canRelease}
              onPress={() => {
                if (!openingBand) return;
                confirmRelease(project.id, project.title, openingBand);
              }}>
              <Text style={styles.releaseButtonText}>Advance To Release</Text>
            </Pressable>

            {nearby.length > 0 ? (
              <View style={styles.calendarCard}>
                <Text style={styles.offerTitle}>Nearby Rival Releases</Text>
                {nearby.map((film) => (
                  <Text key={`${film.rival}-${film.title}-${film.week}`} style={styles.meta}>
                    W{film.week}: {film.rival} - {film.title} ({capitalize(film.genre)}, {film.budget > 100_000_000 ? 'Tentpole' : 'Mid'})
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
  message: { color: tokens.accentGreen, fontSize: 13 },
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
  buttonDisabled: { opacity: 0.45 },
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
  readinessCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  readinessReady: {
    borderColor: tokens.accentGreen,
    backgroundColor: '#1A3030',
  },
  readinessBlocked: {
    borderColor: tokens.accentGold,
    backgroundColor: '#2D2616',
  },
  shiftCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 4,
  },
  readyText: { color: tokens.accentGreen },
  blockedText: { color: tokens.accentRed },
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
