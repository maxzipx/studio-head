import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { ACTION_BALANCE, FESTIVAL_RULES } from '@/src/domain/balance-constants';
import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { colors, typography } from '@/src/ui/tokens';
import {
  GlassCard,
  PremiumButton,
  SectionLabel,
  MetricTile,
  ProgressBar,
} from '@/src/ui/components';
import { ProjectReleasePerformanceCard } from '@/src/ui/project/ProjectReleasePerformanceCard';
import {
  advanceBlockers,
  burnBarColor,
  franchiseStrategyLabel,
  money,
  pct,
  phaseColor,
  resolveParam,
  roiColor,
} from '@/src/ui/project/project-helpers';
import { styles } from '@/src/ui/project/project-styles';

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const projectId = resolveParam(id);
  const {
    manager,
    tick,
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
    runGreenlightReview,
    runTestScreening,
    runReshoots,
    runTrackingLeverage,
    abandonProject,
    startSequel,
    setFranchiseStrategy,
    runFranchiseBrandReset,
    runFranchiseLegacyCastingCampaign,
    runFranchiseHiatusPlanning,
  } = useGameStore(useShallow((state) => ({
    manager: state.manager,
    tick: state.tick,
    lastMessage: state.lastMessage,
    advancePhase: state.advancePhase,
    setReleaseWeek: state.setReleaseWeek,
    acceptOffer: state.acceptOffer,
    counterOffer: state.counterOffer,
    walkAwayOffer: state.walkAwayOffer,
    runMarketingPush: state.runMarketingPush,
    runFestivalSubmission: state.runFestivalSubmission,
    runScriptSprint: state.runScriptSprint,
    runPostPolishPass: state.runPostPolishPass,
    runGreenlightReview: state.runGreenlightReview,
    runTestScreening: state.runTestScreening,
    runReshoots: state.runReshoots,
    runTrackingLeverage: state.runTrackingLeverage,
    abandonProject: state.abandonProject,
    startSequel: state.startSequel,
    setFranchiseStrategy: state.setFranchiseStrategy,
    runFranchiseBrandReset: state.runFranchiseBrandReset,
    runFranchiseLegacyCastingCampaign: state.runFranchiseLegacyCastingCampaign,
    runFranchiseHiatusPlanning: state.runFranchiseHiatusPlanning,
  })));
  const [projectionWeekShift, setProjectionWeekShift] = useState(0);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  void tick;
  const project = manager.activeProjects.find((item) => item.id === projectId) ?? null;
  const projectionWeek = useMemo(() => {
    if (!project) return manager.currentWeek + 4;
    const base = project.releaseWeek ?? manager.currentWeek + 4;
    return Math.max(manager.currentWeek + 1, base + projectionWeekShift);
  }, [manager.currentWeek, project, projectionWeekShift]);

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!project) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Project Not Found</Text>
        <Text style={styles.emptyBody}>This project may have been removed from the active slate.</Text>
      </View>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const director = project.directorId ? manager.talentPool.find((t) => t.id === project.directorId) : null;
  const cast = project.castIds
    .map((tid) => manager.talentPool.find((t) => t.id === tid))
    .filter((t): t is NonNullable<typeof t> => !!t);
  const projection = manager.getProjectedForProjectAtWeek(project.id, projectionWeek);
  const burnPct = project.budget.ceiling > 0 ? (project.budget.actualSpend / project.budget.ceiling) * 100 : 0;
  const projectCrises = manager.pendingCrises.filter((c) => c.projectId === project.id);
  const projectDecisions = manager.decisionQueue.filter((d) => d.projectId === project.id);
  const offers = manager.getOffersForProject(project.id);
  const blockers = project.phase !== 'released' ? advanceBlockers(project, manager.currentWeek, projectCrises.length) : [];
  const canPush = project.phase !== 'released' && manager.cash >= ACTION_BALANCE.OPTIONAL_ACTION_COST;
  const genreDemand = manager.getGenreDemandMultiplier(project.genre);
  const canFestivalSubmit =
    (project.phase === 'postProduction' || project.phase === 'distribution') &&
    project.festivalStatus !== 'submitted' &&
    project.festivalStatus !== 'selected' &&
    project.festivalStatus !== 'buzzed' &&
    manager.cash >= FESTIVAL_RULES.SUBMISSION_COST;
  const canScriptSprint =
    project.phase === 'development' &&
    manager.cash >= ACTION_BALANCE.SCRIPT_SPRINT_COST &&
    project.scriptQuality < ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY;
  const canApproveGreenlight =
    project.phase === 'development' &&
    !!project.directorId &&
    project.castIds.length > 0 &&
    project.scriptQuality >= 6 &&
    !project.greenlightApproved &&
    manager.cash >= ACTION_BALANCE.GREENLIGHT_APPROVAL_FEE;
  const canSendBack = project.phase === 'development' && !!project.directorId && project.castIds.length > 0 && project.scriptQuality >= 6;
  const canPolishPass =
    project.phase === 'postProduction' &&
    manager.cash >= ACTION_BALANCE.POLISH_PASS_COST &&
    project.editorialScore < ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL &&
    (project.postPolishPasses ?? 0) < ACTION_BALANCE.POLISH_PASS_MAX_USES;
  const canTestScreening =
    (project.phase === 'postProduction' || project.phase === 'distribution') &&
    manager.cash >= ACTION_BALANCE.TEST_SCREENING_COST;
  const canReshoot =
    project.phase === 'postProduction' &&
    !!project.testScreeningCompleted &&
    manager.cash >= ACTION_BALANCE.RESHOOT_COST;
  const canTrackingLeverage = project.phase === 'distribution' && (project.trackingLeverageAmount ?? 0) <= 0;
  const franchiseModifiers = manager.getFranchiseProjectionModifiers(project.id);
  const franchiseStatus = manager.getFranchiseStatus(project.id);
  const sequelEligibility = project.phase === 'released' ? manager.getSequelEligibility(project.id) : null;
  const isSequelProject = !!project.franchiseId && (project.franchiseEpisode ?? 0) > 1;
  const canSetStrategy =
    isSequelProject &&
    (project.phase === 'development' || project.phase === 'preProduction') &&
    project.franchiseStrategy === 'balanced';
  const canBrandReset =
    !!franchiseStatus &&
    isSequelProject &&
    manager.cash >= franchiseStatus.nextBrandResetCost &&
    (project.phase === 'development' || project.phase === 'preProduction');
  const canLegacyCampaign =
    !!franchiseStatus && isSequelProject && project.phase !== 'released' && manager.cash >= franchiseStatus.nextLegacyCastingCampaignCost;
  const canHiatusPlan =
    !!franchiseStatus &&
    isSequelProject &&
    project.phase !== 'production' &&
    project.phase !== 'released' &&
    manager.cash >= franchiseStatus.nextHiatusPlanCost;
  const releaseReport = manager.getLatestReleaseReport(project.id);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <LinearGradient
        colors={[`${phaseColor(project.phase)}18`, 'transparent']}
        style={styles.headerGlow}
        pointerEvents="none"
      />
      <View style={styles.headerRow}>
        <View style={styles.phasePill}>
          <Text style={[styles.phasePillText, { color: phaseColor(project.phase) }]}>
            {project.phase.replace(/([A-Z])/g, ' $1').trim()}
          </Text>
        </View>
      </View>
      <Text style={styles.title}>{project.title}</Text>
      <Text style={styles.subtitle}>
        {project.genre.charAt(0).toUpperCase() + project.genre.slice(1)} · Week {manager.currentWeek}
      </Text>

      {/* Last message */}
      {lastMessage ? (
        <GlassCard style={styles.messageCard}>
          <Text style={styles.messageText}>{lastMessage}</Text>
        </GlassCard>
      ) : null}

      {/* Help toggle */}
      <PremiumButton
        variant="ghost"
        size="sm"
        label={showHelp ? 'Hide Help' : 'Show Help'}
        onPress={() => setShowHelp((v) => !v)}
      />
      {showHelp ? (
        <GlassCard>
          <Text style={styles.mutedText}>Development requires explicit Greenlight approval before Pre-Production.</Text>
          <Text style={styles.mutedText}>Use test screenings in Post to reduce release variance before launch.</Text>
          <Text style={styles.mutedText}>Tracking leverage gives early cash but can claw back if opening misses.</Text>
        </GlassCard>
      ) : null}

      {/* ── Project State ── */}
      <GlassCard variant="elevated">
        <SectionLabel label="Project State" />
        <View style={styles.metricsRow}>
          <MetricTile
            value={project.hypeScore.toFixed(0)}
            label="Hype"
            size="sm"
            style={styles.metricFlex}
          />
          <MetricTile
            value={project.scriptQuality.toFixed(1)}
            label={project.phase === 'development' ? 'Script (min 6.0)' : 'Script'}
            size="sm"
            style={styles.metricFlex}
          />
          <MetricTile
            value={project.conceptStrength.toFixed(1)}
            label="Concept"
            size="sm"
            style={styles.metricFlex}
          />
        </View>
        <Text style={[styles.bodyText, { color: genreDemand >= 1 ? colors.accentGreen : colors.textMuted }]}>
          Genre demand: {genreDemand >= 1 ? '+' : ''}{Math.round((genreDemand - 1) * 100)}%
        </Text>
        <Text style={styles.mutedText}>Editorial {project.editorialScore.toFixed(1)} / 10</Text>
        <ProgressBar
          value={project.editorialScore * 10}
          color={colors.accentGreen}
        />
        {project.phase === 'development' ? (
          <View style={styles.pillRow}>
            <View style={[
              styles.statusPill,
              { borderColor: project.greenlightApproved ? colors.accentGreen : colors.goldMid },
            ]}>
              <Text style={[
                styles.statusPillText,
                { color: project.greenlightApproved ? colors.accentGreen : colors.goldMid },
              ]}>
                {project.greenlightApproved ? `✓ Greenlit W${project.greenlightWeek ?? '-'}` : 'Greenlight Pending'}
              </Text>
            </View>
          </View>
        ) : null}
        {project.scheduledWeeksRemaining > 0 ? (
          <Text style={styles.mutedText}>{project.scheduledWeeksRemaining}w remaining in phase</Text>
        ) : null}
        <Text style={styles.mutedText}>Status: {project.productionStatus}</Text>
      </GlassCard>

      {/* ── Franchise Status ── */}
      {project.franchiseId ? (
        <GlassCard variant="elevated">
          <SectionLabel label="Franchise Status" />
          <Text style={styles.bodyText}>
            {franchiseStatus?.franchiseName ?? project.title} · Ep {project.franchiseEpisode ?? 1} · {franchiseStrategyLabel(project.franchiseStrategy)}
          </Text>
          {franchiseModifiers ? (
            <>
              <View style={styles.metricsRow}>
                <MetricTile
                  value={franchiseModifiers.momentum.toFixed(0)}
                  label="Momentum"
                  size="sm"
                  accent={colors.accentGreen}
                  style={styles.metricFlex}
                />
                <MetricTile
                  value={franchiseModifiers.fatigue.toFixed(0)}
                  label="Fatigue"
                  size="sm"
                  accent={colors.accentRed}
                  style={styles.metricFlex}
                />
              </View>
              <Text style={styles.mutedText}>
                Opening {(franchiseModifiers.openingMultiplier * 100).toFixed(0)}% · Critic {franchiseModifiers.criticalDelta >= 0 ? '+' : ''}{franchiseModifiers.criticalDelta.toFixed(1)} · Audience {franchiseModifiers.audienceDelta >= 0 ? '+' : ''}{franchiseModifiers.audienceDelta.toFixed(1)}
              </Text>
              <Text style={styles.mutedText}>
                Penalties — Opening -{Math.round(franchiseModifiers.openingPenaltyPct * 100)}% · ROI -{Math.round(franchiseModifiers.roiPenaltyPct * 100)}%
              </Text>
              <Text style={styles.mutedText}>
                Cadence gap {Math.round(franchiseModifiers.effectiveGapWeeks)}w{franchiseStatus ? ` (buffer +${Math.round(franchiseStatus.cadenceBufferWeeks)}w)` : ''} · Pressure {franchiseModifiers.cadencePressure.toFixed(2)}
              </Text>
              <Text style={styles.mutedText}>
                Director {franchiseModifiers.returningDirector ? 'returning' : 'new'} · Shared cast {franchiseModifiers.returningCastCount}
              </Text>
              {franchiseStatus ? (
                <>
                  <Text style={styles.mutedText}>
                    Resets {franchiseStatus.brandResetCount} · Legacy campaigns {franchiseStatus.legacyCastingCampaignCount} · Hiatus plans {franchiseStatus.hiatusPlanCount}
                  </Text>
                  <Text style={styles.mutedText}>
                    Flags: {franchiseStatus.activeFlags.length > 0 ? franchiseStatus.activeFlags.join(', ') : 'None'}
                  </Text>
                </>
              ) : null}
            </>
          ) : null}
        </GlassCard>
      ) : null}

      {/* ── Franchise Ops ── */}
      {isSequelProject && franchiseStatus ? (
        <GlassCard>
          <SectionLabel label="Franchise Ops" />
          <Text style={styles.mutedText}>Repeatable actions with escalating costs and explicit tradeoffs.</Text>
          <PremiumButton
            variant="secondary"
            size="md"
            label={`Brand Reset ${money(franchiseStatus.nextBrandResetCost)} — fatigue relief, momentum tradeoff`}
            onPress={() => runFranchiseBrandReset(project.id)}
            disabled={!canBrandReset}
          />
          <PremiumButton
            variant="secondary"
            size="md"
            label={`Legacy Casting ${money(franchiseStatus.nextLegacyCastingCampaignCost)} — hype/momentum up, fatigue cost`}
            onPress={() => runFranchiseLegacyCastingCampaign(project.id)}
            disabled={!canLegacyCampaign}
          />
          <PremiumButton
            variant="secondary"
            size="md"
            label={`Hiatus Planning ${money(franchiseStatus.nextHiatusPlanCost)} — cadence buffer, short-term hype hit`}
            onPress={() => runFranchiseHiatusPlanning(project.id)}
            disabled={!canHiatusPlan}
          />
        </GlassCard>
      ) : null}

      {/* ── Script Development ── */}
      {project.phase === 'development' ? (
        <GlassCard variant="elevated">
          <SectionLabel label="Script Development" />
          <Text style={styles.mutedText}>{project.scriptQuality.toFixed(1)} / {ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY.toFixed(1)} sprint cap</Text>
          <ProgressBar
            value={(project.scriptQuality / ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY) * 100}
            color={colors.accentGreen}
          />
          <PremiumButton
            variant="primary"
            size="md"
            label={`Script Sprint ${money(ACTION_BALANCE.SCRIPT_SPRINT_COST)} (+${ACTION_BALANCE.SCRIPT_SPRINT_QUALITY_BOOST.toFixed(1)} quality)`}
            onPress={() => runScriptSprint(project.id)}
            disabled={!canScriptSprint}
          />
          <Text style={styles.mutedText}>Greenlight gate is mandatory before Pre-Production.</Text>
          <View style={styles.buttonRow}>
            <PremiumButton
              variant="primary"
              size="md"
              label={`Approve Greenlight ${money(ACTION_BALANCE.GREENLIGHT_APPROVAL_FEE)}`}
              onPress={() => runGreenlightReview(project.id, true)}
              disabled={!canApproveGreenlight}
              style={styles.buttonFlex}
            />
            <PremiumButton
              variant="ghost"
              size="md"
              label="Send Back"
              onPress={() => runGreenlightReview(project.id, false)}
              disabled={!canSendBack}
              style={styles.buttonFlex}
            />
          </View>
          {isSequelProject ? (
            <>
              <Text style={styles.mutedText}>Franchise direction is a one-time commitment for this sequel.</Text>
              <View style={styles.buttonRow}>
                <PremiumButton
                  variant="gold-outline"
                  size="sm"
                  label="Safe Continuation ($90K)"
                  onPress={() => setFranchiseStrategy(project.id, 'safe')}
                  disabled={!canSetStrategy}
                  style={styles.buttonFlex}
                />
                <PremiumButton
                  variant="gold-outline"
                  size="sm"
                  label="Reinvention ($220K)"
                  onPress={() => setFranchiseStrategy(project.id, 'reinvention')}
                  disabled={!canSetStrategy}
                  style={styles.buttonFlex}
                />
              </View>
            </>
          ) : null}
        </GlassCard>
      ) : null}

      {/* ── Attachments ── */}
      <GlassCard>
        <SectionLabel label="Attachments" />
        <Text style={styles.bodyText}>
          Director:{' '}
          <Text style={{ color: director ? colors.textPrimary : colors.accentRed }}>
            {director?.name ?? 'Unattached'}
          </Text>
        </Text>
        <Text style={styles.bodyText}>
          Cast:{' '}
          <Text style={{ color: cast.length > 0 ? colors.textPrimary : colors.accentRed }}>
            {cast.length > 0 ? cast.map((t) => t.name).join(', ') : 'None attached'}
          </Text>
        </Text>
      </GlassCard>

      {/* ── Budget ── */}
      <GlassCard variant={project.budget.overrunRisk > 0.2 ? 'red' : 'default'}>
        <SectionLabel label="Budget" />
        <View style={styles.metricsRow}>
          <MetricTile
            value={money(project.budget.actualSpend)}
            label="Spent"
            size="sm"
            style={styles.metricFlex}
          />
          <MetricTile
            value={money(project.budget.ceiling)}
            label="Ceiling"
            size="sm"
            style={styles.metricFlex}
          />
        </View>
        <Text style={styles.mutedText}>{burnPct.toFixed(1)}% burned</Text>
        <ProgressBar
          value={burnPct}
          color={burnBarColor(burnPct)}
        />
        {project.budget.overrunRisk > 0.2 ? (
          <Text style={[styles.mutedText, { color: colors.accentRed }]}>
            ⚠ Overrun risk: {pct(project.budget.overrunRisk)} — may add unplanned spend
          </Text>
        ) : null}
      </GlassCard>

      {/* ── Timeline & Risks ── */}
      <GlassCard variant={projectCrises.length > 0 ? 'red' : 'default'}>
        <SectionLabel label="Timeline & Risks" />
        <Text style={[styles.bodyText, { color: projectCrises.length > 0 ? colors.accentRed : colors.textMuted }]}>
          {projectCrises.length > 0 ? `${projectCrises.length} blocking crisis${projectCrises.length > 1 ? 'es' : ''}` : 'No blocking crises'}
        </Text>
        {projectDecisions.length > 0 ? (
          <Text style={styles.mutedText}>{projectDecisions.length} project decision{projectDecisions.length > 1 ? 's' : ''} in inbox</Text>
        ) : null}
        {projectCrises.slice(0, 3).map((c) => (
          <Text key={c.id} style={[styles.mutedText, { color: colors.accentRed }]}>— {c.title}</Text>
        ))}
        {projectDecisions.slice(0, 3).map((d) => (
          <View key={d.id} style={styles.decisionRow}>
            <Text style={styles.mutedText}>{d.title}</Text>
            <View style={[
              styles.expiryPill,
              { borderColor: Math.max(0, d.weeksUntilExpiry) < 3 ? colors.accentRed : colors.goldMid },
            ]}>
              <Text style={[
                styles.expiryPillText,
                { color: Math.max(0, d.weeksUntilExpiry) < 3 ? colors.accentRed : colors.goldMid },
              ]}>
                {Math.max(0, d.weeksUntilExpiry)}w
              </Text>
            </View>
          </View>
        ))}
      </GlassCard>

      {/* ── Projection ── */}
      <GlassCard variant="elevated">
        <SectionLabel label="Box Office Projection" />
        <View style={styles.buttonRow}>
          <PremiumButton
            variant="ghost"
            size="sm"
            label="-1w"
            onPress={() => setProjectionWeekShift((v) => v - 1)}
            style={styles.buttonFlex}
          />
          <PremiumButton
            variant="ghost"
            size="sm"
            label="+1w"
            onPress={() => setProjectionWeekShift((v) => v + 1)}
            style={styles.buttonFlex}
          />
          <PremiumButton
            variant="ghost"
            size="sm"
            label="Reset"
            onPress={() => setProjectionWeekShift(0)}
            style={styles.buttonFlex}
          />
        </View>
        <Text style={styles.mutedText}>Scenario: Week {projectionWeek} · Genre cycle {genreDemand.toFixed(2)}x</Text>
        {projection ? (
          <View style={styles.metricsRow}>
            <MetricTile value={projection.critical.toFixed(0)} label="Critics" size="sm" style={styles.metricFlex} />
            <View style={[styles.metricFlex, { gap: 2 }]}>
              <Text style={[styles.bodyText, { color: colors.textPrimary, fontFamily: typography.fontBodyBold }]}>
                {money(projection.openingLow)} – {money(projection.openingHigh)}
              </Text>
              <Text style={styles.mutedText}>Opening Range</Text>
            </View>
            <MetricTile
              value={`${projection.roi.toFixed(2)}x`}
              label="ROI"
              size="sm"
              accent={roiColor(projection.roi)}
              style={styles.metricFlex}
            />
          </View>
        ) : (
          <Text style={styles.mutedText}>Projection unavailable.</Text>
        )}
      </GlassCard>

      {/* ── Marketing ── */}
      {project.phase === 'postProduction' ? (
        <GlassCard>
          <SectionLabel label="Marketing" />
          <View style={styles.metricsRow}>
            <MetricTile value={money(project.marketingBudget)} label="Budget" size="sm" style={styles.metricFlex} />
            <MetricTile value={`${project.postPolishPasses ?? 0} / 2`} label="Polish Passes" size="sm" style={styles.metricFlex} />
          </View>
          {project.marketingBudget <= 0 ? (
            <Text style={[styles.mutedText, { color: colors.accentRed }]}>
              ⚠ Marketing budget required before distribution.
            </Text>
          ) : null}
          <PremiumButton
            variant="primary"
            size="md"
            label={`Marketing Push ${money(ACTION_BALANCE.OPTIONAL_ACTION_COST)} (+${money(ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST)} budget, +${ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST.toFixed(0)} hype)`}
            onPress={() => runMarketingPush(project.id)}
            disabled={!canPush}
          />
          <PremiumButton
            variant="secondary"
            size="md"
            label={`Polish Pass ${money(ACTION_BALANCE.POLISH_PASS_COST)} (+${ACTION_BALANCE.POLISH_PASS_EDITORIAL_BOOST.toFixed(0)} editorial, ${ACTION_BALANCE.POLISH_PASS_MAX_USES} uses max)`}
            onPress={() => runPostPolishPass(project.id)}
            disabled={!canPolishPass}
          />
        </GlassCard>
      ) : null}

      {/* ── Test Screenings ── */}
      {(project.phase === 'postProduction' || project.phase === 'distribution') ? (
        <GlassCard>
          <SectionLabel label="Test Screenings" />
          <Text style={[styles.bodyText, { color: project.testScreeningCompleted ? colors.accentGreen : colors.textMuted }]}>
            {project.testScreeningCompleted ? `Completed W${project.testScreeningWeek ?? '-'}` : 'Not run yet'}
          </Text>
          {project.testScreeningCompleted ? (
            <>
              <Text style={styles.bodyText}>
                Critic signal: {(project.testScreeningCriticalLow ?? 0).toFixed(0)} – {(project.testScreeningCriticalHigh ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.bodyText}>Audience: {project.testScreeningAudienceSentiment ?? 'mixed'}</Text>
            </>
          ) : (
            <Text style={styles.mutedText}>Run once to reveal a pre-release quality band before launch.</Text>
          )}
          <PremiumButton
            variant="secondary"
            size="md"
            label={`Run Test Screening ${money(ACTION_BALANCE.TEST_SCREENING_COST)}`}
            onPress={() => runTestScreening(project.id)}
            disabled={!canTestScreening}
          />
          {project.phase === 'postProduction' ? (
            <PremiumButton
              variant="ghost"
              size="md"
              label={`Order Reshoots ${money(ACTION_BALANCE.RESHOOT_COST)} (+${ACTION_BALANCE.RESHOOT_SCHEDULE_WEEKS.toFixed(0)}w)`}
              onPress={() => runReshoots(project.id)}
              disabled={!canReshoot}
            />
          ) : null}
        </GlassCard>
      ) : null}

      {/* ── Festival Circuit ── */}
      {(project.phase === 'postProduction' || project.phase === 'distribution' || project.phase === 'released') ? (
        <GlassCard>
          <SectionLabel label="Festival Circuit" />
          <Text style={styles.bodyText}>Status: {project.festivalStatus}</Text>
          <Text style={styles.bodyText}>Target: {project.festivalTarget ?? 'None'}</Text>
          <Text style={styles.bodyText}>Buzz: {project.festivalBuzz.toFixed(0)}</Text>
          {project.festivalStatus === 'submitted' && project.festivalResolutionWeek ? (
            <Text style={styles.mutedText}>Decision expected around week {project.festivalResolutionWeek}</Text>
          ) : null}
          <PremiumButton
            variant="gold-outline"
            size="md"
            label={`Submit Festival Cut ${money(FESTIVAL_RULES.SUBMISSION_COST)}`}
            onPress={() => runFestivalSubmission(project.id)}
            disabled={!canFestivalSubmit}
          />
        </GlassCard>
      ) : null}

      {/* ── Release Plan ── */}
      <GlassCard variant={offers.length > 0 ? 'gold' : 'default'}>
        <SectionLabel label="Release Plan" />
        <Text style={styles.bodyText}>Week: {project.releaseWeek ?? '—'}</Text>
        <Text style={styles.bodyText}>Window: {project.releaseWindow ?? 'Not selected'}</Text>
        <Text style={styles.bodyText}>Partner: {project.distributionPartner ?? 'None'}</Text>
        <Text style={styles.bodyText}>Marketing: {money(project.marketingBudget)}</Text>

        {project.phase === 'distribution' ? (
          <>
            <View style={styles.buttonRow}>
              <PremiumButton
                variant="ghost"
                size="sm"
                label="Release −1w"
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}
                disabled={!project.releaseWeek}
                style={styles.buttonFlex}
              />
              <PremiumButton
                variant="ghost"
                size="sm"
                label="Release +1w"
                onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}
                disabled={!project.releaseWeek}
                style={styles.buttonFlex}
              />
            </View>
            <PremiumButton
              variant="secondary"
              size="md"
              label="Leverage Tracking Projection"
              onPress={() => runTrackingLeverage(project.id)}
              disabled={!canTrackingLeverage}
            />
            {(project.trackingLeverageAmount ?? 0) > 0 ? (
              <Text style={styles.mutedText}>
                Leveraged: {money(project.trackingLeverageAmount ?? 0)} · Confidence {Math.round((project.trackingConfidence ?? 0) * 100)}%
              </Text>
            ) : null}
          </>
        ) : null}

        {offers.length > 0 ? (
          <View style={styles.offersWrap}>
            {offers.map((offer) => (
              <GlassCard key={offer.id} variant="elevated">
                <Text style={styles.offerTitle}>{offer.partner} · {offer.releaseWindow}</Text>
                <Text style={styles.mutedText}>
                  MG {money(offer.minimumGuarantee)} · P&A {money(offer.pAndACommitment)} · {(offer.revenueShareToStudio * 100).toFixed(0)}% share
                </Text>
                <View style={styles.buttonRow}>
                  <PremiumButton
                    variant="primary"
                    size="sm"
                    label="Accept"
                    onPress={() => acceptOffer(project.id, offer.id)}
                    style={styles.buttonFlex}
                  />
                  <PremiumButton
                    variant="gold-outline"
                    size="sm"
                    label="Counter"
                    onPress={() => counterOffer(project.id, offer.id)}
                    style={styles.buttonFlex}
                  />
                </View>
              </GlassCard>
            ))}
            <PremiumButton
              variant="danger"
              size="md"
              label="Walk Away From Current Offers"
              onPress={() => walkAwayOffer(project.id)}
            />
          </View>
        ) : (
          <Text style={styles.mutedText}>No active offers. End Turn to refresh if no window is selected.</Text>
        )}
      </GlassCard>

      {/* ── Advance Phase ── */}
      {project.phase !== 'released' ? (
        <GlassCard variant={blockers.length > 0 ? 'red' : 'default'}>
          <SectionLabel label="Advance Phase" />
          {blockers.length > 0 ? (
            blockers.map((b) => (
              <Text key={b} style={[styles.mutedText, { color: colors.accentRed }]}>— {b}</Text>
            ))
          ) : (
            <Text style={[styles.bodyText, { color: colors.accentGreen }]}>✓ Ready to advance</Text>
          )}
          <PremiumButton
            variant={blockers.length > 0 ? 'secondary' : 'primary'}
            size="lg"
            label="Advance Phase →"
            onPress={() => advancePhase(project.id)}
            disabled={blockers.length > 0}
          />
        </GlassCard>
      ) : null}

      <ProjectReleasePerformanceCard
        project={project}
        releaseReport={releaseReport}
        sequelEligibility={sequelEligibility}
        onStartSequel={startSequel}
      />

      {/* ── Abandon Project ── */}
      {project.phase !== 'released' ? (
        <View style={styles.abandonSection}>
          {confirmAbandon ? (
            <GlassCard variant="red">
              <Text style={[styles.bodyText, { color: colors.accentRed }]}>
                Abandon {project.title}? Costs {money(Math.round(project.budget.actualSpend * 0.2))} write-down and −4 studio heat. Cannot be undone.
              </Text>
              <View style={styles.buttonRow}>
                <PremiumButton
                  variant="danger"
                  size="md"
                  label="Confirm Abandon"
                  onPress={() => { setConfirmAbandon(false); abandonProject(project.id); }}
                  style={styles.buttonFlex}
                />
                <PremiumButton
                  variant="ghost"
                  size="md"
                  label="Cancel"
                  onPress={() => setConfirmAbandon(false)}
                  style={styles.buttonFlex}
                />
              </View>
            </GlassCard>
          ) : (
            <PremiumButton
              variant="ghost"
              size="sm"
              label="Abandon Project"
              onPress={() => setConfirmAbandon(true)}
              style={styles.abandonButton}
            />
          )}
        </View>
      ) : null}

    </ScrollView>
  );
}

