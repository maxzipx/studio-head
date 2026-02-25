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

function franchiseStrategyLabel(strategy: string): string {
  if (strategy === 'safe') return 'Safe Continuation';
  if (strategy === 'reinvention') return 'Reinvention';
  if (strategy === 'balanced') return 'Balanced';
  return 'Standalone';
}

function advanceBlockers(project: {
  phase: string;
  directorId: string | null;
  castIds: string[];
  scriptQuality: number;
  scheduledWeeksRemaining: number;
  marketingBudget: number;
  releaseWindow: string | null;
  releaseWeek: number | null;
}, currentWeek: number, crisisCount: number): string[] {
  const blockers: string[] = [];
  if (project.phase === 'development') {
    if (!project.directorId) blockers.push('Director not attached');
    if (project.castIds.length < 1) blockers.push('No lead actor attached');
    if (project.scriptQuality < 6) blockers.push(`Script quality too low (${project.scriptQuality.toFixed(1)} / min 6.0)`);
  } else if (project.phase === 'preProduction' || project.phase === 'production' || project.phase === 'postProduction') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w remaining in phase`);
    if (project.phase === 'production' && crisisCount > 0) blockers.push(`${crisisCount} unresolved crisis`);
    if (project.phase === 'postProduction' && project.marketingBudget <= 0) blockers.push('Marketing budget required (use push below)');
  } else if (project.phase === 'distribution') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w setup remaining`);
    if (!project.releaseWindow) blockers.push('Distribution deal not selected');
    if (project.releaseWeek && currentWeek < project.releaseWeek) blockers.push(`Release date is week ${project.releaseWeek} (now week ${currentWeek})`);
  }
  return blockers;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const projectId = resolveParam(id);
  const {
    manager,
    lastMessage,
    advancePhase,
    setReleaseWeek,
    acceptOffer,
    counterOffer,
    walkAwayOffer,
    runMarketingPush,
    runFestivalSubmission,
    runScriptSprint,
    runPostPolishPass,
    abandonProject,
    startSequel,
    setFranchiseStrategy,
  } = useGame();
  const [projectionWeekShift, setProjectionWeekShift] = useState(0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

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
  const blockers = project.phase !== 'released' ? advanceBlockers(project, manager.currentWeek, projectCrises.length) : [];
  const canPush = project.phase !== 'released' && manager.cash >= 180_000;
  const genreDemand = manager.getGenreDemandMultiplier(project.genre);
  const canFestivalSubmit =
    (project.phase === 'postProduction' || project.phase === 'distribution') &&
    project.festivalStatus !== 'submitted' &&
    project.festivalStatus !== 'selected' &&
    project.festivalStatus !== 'buzzed' &&
    manager.cash >= 140_000;
  const canScriptSprint = project.phase === 'development' && manager.cash >= 100_000 && project.scriptQuality < 8.5;
  const canPolishPass = project.phase === 'postProduction' && manager.cash >= 120_000 && project.editorialScore < 9 && (project.postPolishPasses ?? 0) < 2;
  const franchiseModifiers = manager.getFranchiseProjectionModifiers(project.id);
  const sequelEligibility = project.phase === 'released' ? manager.getSequelEligibility(project.id) : null;
  const isSequelProject = !!project.franchiseId && (project.franchiseEpisode ?? 0) > 1;
  const canSetStrategy =
    isSequelProject &&
    (project.phase === 'development' || project.phase === 'preProduction') &&
    project.franchiseStrategy === 'balanced';

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
          Hype {project.hypeScore.toFixed(0)} | Script {project.scriptQuality.toFixed(1)}{project.phase === 'development' ? ' (min 6.0 to greenlight)' : ''} | Concept {project.conceptStrength.toFixed(1)} (drives critic score)
        </Text>
        <Text style={styles.body}>Genre market demand: {genreDemand >= 1 ? '+' : ''}{Math.round((genreDemand - 1) * 100)}%</Text>
        <Text style={styles.body}>Editorial score: {project.editorialScore.toFixed(1)} / 10</Text>
        {project.scheduledWeeksRemaining > 0 ? (
          <Text style={styles.body}>Weeks remaining in phase: {project.scheduledWeeksRemaining}</Text>
        ) : null}
      </View>

      {project.franchiseId ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Franchise Profile</Text>
          <Text style={styles.body}>
            Episode {project.franchiseEpisode ?? 1} | Strategy: {franchiseStrategyLabel(project.franchiseStrategy)}
          </Text>
          {franchiseModifiers ? (
            <>
              <Text style={styles.body}>
                Momentum {franchiseModifiers.momentum.toFixed(0)} | Fatigue {franchiseModifiers.fatigue.toFixed(0)}
              </Text>
              <Text style={styles.body}>
                Sequel pressure: Opening {(franchiseModifiers.openingMultiplier * 100).toFixed(0)}% | Critic delta {franchiseModifiers.criticalDelta >= 0 ? '+' : ''}
                {franchiseModifiers.criticalDelta.toFixed(1)} | Audience delta {franchiseModifiers.audienceDelta >= 0 ? '+' : ''}
                {franchiseModifiers.audienceDelta.toFixed(1)}
              </Text>
              <Text style={styles.muted}>
                Carryover package: Director {franchiseModifiers.returningDirector ? 'returning' : 'new'} | Shared cast {franchiseModifiers.returningCastCount}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {project.phase === 'development' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Script Development</Text>
          <Text style={styles.body}>Script quality: {project.scriptQuality.toFixed(1)} / 8.5 sprint cap</Text>
          <Pressable
            style={[styles.button, !canScriptSprint ? styles.buttonDisabled : null]}
            disabled={!canScriptSprint}
            onPress={() => runScriptSprint(project.id)}>
            <Text style={styles.buttonText}>Script Sprint $100K (+0.5 quality, max 8.5)</Text>
          </Pressable>
          {isSequelProject ? (
            <>
              <Text style={styles.muted}>Franchise direction is a one-time commitment for this sequel.</Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, !canSetStrategy ? styles.buttonDisabled : null]}
                  disabled={!canSetStrategy}
                  onPress={() => setFranchiseStrategy(project.id, 'safe')}>
                  <Text style={styles.buttonText}>Set Safe Continuation ($90K)</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, !canSetStrategy ? styles.buttonDisabled : null]}
                  disabled={!canSetStrategy}
                  onPress={() => setFranchiseStrategy(project.id, 'reinvention')}>
                  <Text style={styles.buttonText}>Set Reinvention ($220K)</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

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
        {project.budget.overrunRisk > 0.2 ? (
          <Text style={styles.warning}>Overrun risk: {pct(project.budget.overrunRisk)} - may add unplanned spend during production</Text>
        ) : null}
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
        <Text style={styles.sectionLabel}>Projection - what if release slips?</Text>
        <Text style={styles.body}>Scenario week: {projectionWeek}</Text>
        <Text style={styles.body}>Genre cycle modifier: {genreDemand.toFixed(2)}x</Text>
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => setProjectionWeekShift((value) => value - 1)}>
            <Text style={styles.buttonText}>-1w</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setProjectionWeekShift((value) => value + 1)}>
            <Text style={styles.buttonText}>+1w</Text>
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

      {project.phase === 'postProduction' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Marketing</Text>
          <Text style={styles.body}>Budget: {money(project.marketingBudget)}</Text>
          <Text style={styles.body}>Polish passes used: {project.postPolishPasses ?? 0} / 2</Text>
          {project.marketingBudget <= 0 ? (
            <Text style={styles.warning}>Marketing budget required before entering distribution.</Text>
          ) : null}
          <Pressable
            style={[styles.button, !canPush ? styles.buttonDisabled : null]}
            disabled={!canPush}
            onPress={() => runMarketingPush(project.id)}>
            <Text style={styles.buttonText}>Marketing Push $180K (+$180K budget, +5 hype)</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !canPolishPass ? styles.buttonDisabled : null]}
            disabled={!canPolishPass}
            onPress={() => runPostPolishPass(project.id)}>
            <Text style={styles.buttonText}>Polish Pass $120K (+2 editorial, max 9, 2 uses)</Text>
          </Pressable>
        </View>
      ) : null}

      {(project.phase === 'postProduction' || project.phase === 'distribution' || project.phase === 'released') ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Festival Circuit</Text>
          <Text style={styles.body}>Status: {project.festivalStatus}</Text>
          <Text style={styles.body}>Target: {project.festivalTarget ?? 'None'}</Text>
          <Text style={styles.body}>Buzz: {project.festivalBuzz.toFixed(0)}</Text>
          {project.festivalStatus === 'submitted' && project.festivalResolutionWeek ? (
            <Text style={styles.muted}>Decision expected around week {project.festivalResolutionWeek}</Text>
          ) : null}
          <Pressable
            style={[styles.button, !canFestivalSubmit ? styles.buttonDisabled : null]}
            disabled={!canFestivalSubmit}
            onPress={() => runFestivalSubmission(project.id)}>
            <Text style={styles.buttonText}>Submit Festival Cut $140K</Text>
          </Pressable>
        </View>
      ) : null}

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
          <Text style={styles.muted}>No active distribution offers. End Turn to refresh offer flow if no window is selected.</Text>
        )}
      </View>

      {project.phase !== 'released' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Advance Phase</Text>
          {blockers.length > 0 ? (
            blockers.map((b) => (
              <Text key={b} style={styles.blocker}>
                - {b}
              </Text>
            ))
          ) : (
            <Text style={styles.readyText}>Ready to advance</Text>
          )}
          <Pressable
            style={[styles.advanceButton, blockers.length > 0 ? styles.advanceButtonBlocked : null]}
            disabled={blockers.length > 0}
            onPress={() => advancePhase(project.id)}>
            <Text style={styles.advanceButtonText}>{'Advance Phase ->'}</Text>
          </Pressable>
        </View>
      ) : null}

      {project.phase === 'released' ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Release Performance</Text>
          <Text style={styles.body}>Opening weekend: {money(project.openingWeekendGross ?? 0)}</Text>
          <Text style={styles.body}>Current gross: {money(project.finalBoxOffice ?? 0)}</Text>
          <Text style={styles.body}>Critics: {project.criticalScore?.toFixed(0) ?? '--'}</Text>
          <Text style={styles.body}>Audience: {project.audienceScore?.toFixed(0) ?? '--'}</Text>
          <Text style={styles.body}>Awards: {project.awardsNominations} nomination(s), {project.awardsWins} win(s)</Text>
          <Text style={styles.body}>Current ROI: {project.projectedROI.toFixed(2)}x</Text>
          {sequelEligibility ? (
            <>
              <Text style={styles.body}>
                Next sequel: Episode {sequelEligibility.nextEpisode} | Upfront {money(sequelEligibility.upfrontCost)}
              </Text>
              <Text style={styles.muted}>
                Momentum {sequelEligibility.projectedMomentum.toFixed(0)} | Fatigue {sequelEligibility.projectedFatigue.toFixed(0)} | Carryover hype {sequelEligibility.carryoverHype.toFixed(0)}
              </Text>
              {!sequelEligibility.eligible && sequelEligibility.reason ? (
                <Text style={styles.warning}>{sequelEligibility.reason}</Text>
              ) : null}
              <Pressable
                style={[styles.button, !sequelEligibility.eligible ? styles.buttonDisabled : null]}
                disabled={!sequelEligibility.eligible}
                onPress={() => startSequel(project.id)}>
                <Text style={styles.buttonText}>Start Sequel Development</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {project.phase !== 'released' ? (
        <View style={styles.abandonWrap}>
          {confirmAbandon ? (
            <>
              <Text style={styles.abandonWarning}>
                Abandon {project.title}? Costs 20% of actual spend ({money(Math.round(project.budget.actualSpend * 0.2))}) as a write-down and -4 studio heat. This cannot be undone.
              </Text>
              <View style={styles.actions}>
                <Pressable style={styles.walkButton} onPress={() => { setConfirmAbandon(false); abandonProject(project.id); }}>
                  <Text style={styles.walkButtonText}>Confirm Abandon</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={() => setConfirmAbandon(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={styles.abandonButton} onPress={() => setConfirmAbandon(true)}>
              <Text style={styles.abandonButtonText}>Abandon Project</Text>
            </Pressable>
          )}
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
  warning: { color: tokens.accentGold, fontSize: 12 },
  blocker: { color: tokens.accentGold, fontSize: 13 },
  readyText: { color: tokens.accentTeal, fontSize: 13 },
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.accentGold,
    backgroundColor: '#6A5222',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  advanceButtonBlocked: {
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    opacity: 0.6,
  },
  advanceButtonText: { color: tokens.textPrimary, fontSize: 14, fontWeight: '700' },
  abandonWrap: { gap: 8 },
  abandonButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  abandonButtonText: { color: tokens.textMuted, fontSize: 12 },
  abandonWarning: { color: tokens.accentGold, fontSize: 13 },
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
