import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function resolveParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const projectId = resolveParam(id);
  const { manager, lastMessage, advancePhase, setReleaseWeek, acceptOffer, counterOffer, walkAwayOffer } = useGame();
  const [projectionWeekShift, setProjectionWeekShift] = useState(0);

  const project = manager.activeProjects.find((item) => item.id === projectId) ?? null;
  const projectionWeek = useMemo(() => {
    if (!project) return manager.currentWeek + 4;
    const base = project.releaseWeek ?? manager.currentWeek + 4;
    return Math.max(manager.currentWeek + 1, base + projectionWeekShift);
  }, [manager.currentWeek, project, projectionWeekShift]);

  if (!project) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Project Not Found</Text>
        <Text style={styles.emptyBody}>This project may have been removed from the active slate.</Text>
      </View>
    );
  }

  const director = project.directorId ? manager.talentPool.find((talent) => talent.id === project.directorId) : null;
  const cast = project.castIds
    .map((talentId) => manager.talentPool.find((talent) => talent.id === talentId))
    .filter((item): item is NonNullable<typeof item> => !!item);
  const projection = manager.getProjectedForProjectAtWeek(project.id, projectionWeek);
  const burnPct = project.budget.ceiling > 0 ? (project.budget.actualSpend / project.budget.ceiling) * 100 : 0;
  const projectCrises = manager.pendingCrises.filter((crisis) => crisis.projectId === project.id);
  const projectDecisions = manager.decisionQueue.filter((decision) => decision.projectId === project.id);
  const offers = manager.getOffersForProject(project.id);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{project.title}</Text>
      <Text style={styles.subtitle}>
        {project.genre} | {project.phase} | Week {manager.currentWeek}
      </Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Project State</Text>
        <Text style={styles.body}>Status: {project.productionStatus}</Text>
        <Text style={styles.body}>
          Hype {project.hypeScore.toFixed(0)} | Script {project.scriptQuality.toFixed(1)} | Concept {project.conceptStrength.toFixed(1)}
        </Text>
        <Text style={styles.body}>Weeks Remaining in Phase: {project.scheduledWeeksRemaining}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Attachments</Text>
        <Text style={styles.body}>Director: {director?.name ?? 'Unattached'}</Text>
        <Text style={styles.body}>Cast: {cast.length > 0 ? cast.map((talent) => talent.name).join(', ') : 'None attached'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Budget</Text>
        <Text style={styles.body}>
          Spend {money(project.budget.actualSpend)} / {money(project.budget.ceiling)} ({burnPct.toFixed(1)}%)
        </Text>
        <Text style={styles.muted}>Above-the-line: {money(project.budget.aboveTheLine)}</Text>
        <Text style={styles.muted}>Below-the-line: {money(project.budget.belowTheLine)}</Text>
        <Text style={styles.muted}>Post: {money(project.budget.postProduction)} | Contingency: {money(project.budget.contingency)}</Text>
        <Text style={styles.muted}>Overrun risk: {pct(project.budget.overrunRisk)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Timeline & Risks</Text>
        <Text style={styles.body}>Blocking crises: {projectCrises.length}</Text>
        <Text style={styles.body}>Project decisions in inbox: {projectDecisions.length}</Text>
        {projectCrises.slice(0, 3).map((crisis) => (
          <Text key={crisis.id} style={styles.muted}>
            Crisis: {crisis.title}
          </Text>
        ))}
        {projectDecisions.slice(0, 3).map((decision) => (
          <Text key={decision.id} style={styles.muted}>
            Decision: {decision.title} ({Math.max(0, decision.weeksUntilExpiry)}w)
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Projection</Text>
        <Text style={styles.body}>Scenario week: {projectionWeek}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => setProjectionWeekShift((value) => value - 1)}>
            <Text style={styles.buttonText}>Scenario -1w</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setProjectionWeekShift((value) => value + 1)}>
            <Text style={styles.buttonText}>Scenario +1w</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setProjectionWeekShift(0)}>
            <Text style={styles.buttonText}>Reset</Text>
          </Pressable>
        </View>
        {projection ? (
          <>
            <Text style={styles.body}>Critic forecast: {projection.critical.toFixed(0)}</Text>
            <Text style={styles.body}>
              Opening: {money(projection.openingLow)} - {money(projection.openingHigh)}
            </Text>
            <Text style={styles.body}>ROI forecast: {projection.roi.toFixed(2)}x</Text>
          </>
        ) : (
          <Text style={styles.muted}>Projection unavailable right now.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Release Plan</Text>
        <Text style={styles.body}>Release week: {project.releaseWeek ?? '-'}</Text>
        <Text style={styles.body}>Window: {project.releaseWindow ?? 'Not selected'}</Text>
        <Text style={styles.body}>Distribution partner: {project.distributionPartner ?? 'None'}</Text>
        <Text style={styles.body}>Marketing budget: {money(project.marketingBudget)}</Text>
        {project.phase === 'distribution' ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, !project.releaseWeek ? styles.buttonDisabled : null]}
              disabled={!project.releaseWeek}
              onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}>
              <Text style={styles.buttonText}>Release -1w</Text>
            </Pressable>
            <Pressable
              style={[styles.button, !project.releaseWeek ? styles.buttonDisabled : null]}
              disabled={!project.releaseWeek}
              onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}>
              <Text style={styles.buttonText}>Release +1w</Text>
            </Pressable>
          </View>
        ) : null}

        {offers.length > 0 ? (
          <View style={styles.offersWrap}>
            {offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <Text style={styles.bodyStrong}>
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
            <Pressable style={styles.walkButton} onPress={() => walkAwayOffer(project.id)}>
              <Text style={styles.walkButtonText}>Walk Away From Current Offers</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.muted}>No active distribution offers for this project.</Text>
        )}
      </View>

      <Pressable style={styles.advanceButton} onPress={() => advancePhase(project.id)}>
        <Text style={styles.advanceButtonText}>Advance Phase</Text>
      </Pressable>

      {project.phase === 'released' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Release Performance</Text>
          <Text style={styles.body}>Opening weekend: {money(project.openingWeekendGross ?? 0)}</Text>
          <Text style={styles.body}>Current gross: {money(project.finalBoxOffice ?? 0)}</Text>
          <Text style={styles.body}>Critics: {project.criticalScore?.toFixed(0) ?? '--'}</Text>
          <Text style={styles.body}>Audience: {project.audienceScore?.toFixed(0) ?? '--'}</Text>
          <Text style={styles.body}>Current ROI: {project.projectedROI.toFixed(2)}x</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bgPrimary },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  title: { color: tokens.textPrimary, fontSize: 30, fontWeight: '700' },
  subtitle: { color: tokens.textSecondary, marginTop: -2, fontSize: 13 },
  message: { color: tokens.accentTeal, fontSize: 13 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 6,
  },
  sectionLabel: {
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '600',
  },
  body: { color: tokens.textSecondary, fontSize: 14 },
  bodyStrong: { color: tokens.textPrimary, fontSize: 14, fontWeight: '700' },
  muted: { color: tokens.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  button: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#2A3650',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: tokens.textPrimary, fontSize: 12, fontWeight: '600' },
  offersWrap: { gap: 8 },
  offerCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 4,
  },
  walkButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.accentRed,
    paddingVertical: 10,
    alignItems: 'center',
  },
  walkButtonText: { color: tokens.accentRed, fontWeight: '700', fontSize: 12 },
  advanceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.accentGold,
    backgroundColor: '#6A5222',
    paddingVertical: 12,
    alignItems: 'center',
  },
  advanceButtonText: { color: tokens.textPrimary, fontSize: 14, fontWeight: '700' },
  emptyWrap: {
    flex: 1,
    backgroundColor: tokens.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: { color: tokens.textPrimary, fontSize: 24, fontWeight: '700' },
  emptyBody: { color: tokens.textMuted, fontSize: 13, textAlign: 'center' },
});
