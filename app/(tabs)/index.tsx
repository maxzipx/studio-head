import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AWARDS_RULES, BANKRUPTCY_RULES } from '@/src/domain/balance-constants';
import { useGameStore } from '@/src/state/game-context';
import {
  CollapsibleCard,
  GlassCard,
  MetricTile,
  PremiumButton,
  ProgressBar,
  RepPillarGrid,
  SectionLabel,
} from '@/src/ui/components';
import {
  ARC_LABELS,
  capitalize,
  CHRONICLE_ICONS,
  money,
  PARTNER_OPTIONS,
  signedMoney,
  SPECIALIZATION_OPTIONS,
  stanceColor,
  stanceLabel,
  TIER_LABELS,
  TIER_NEXT_GOAL,
} from '@/src/ui/hq/hq-helpers';
import { ReleaseRevealModal } from '@/src/ui/hq/ReleaseRevealModal';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing, typography } from '@/src/ui/tokens';
import { useShallow } from 'zustand/react/shallow';

export default function HQScreen() {
  const {
    manager,
    dismissReleaseReveal,
    endWeek,
    advanceToNextDecision,
    setTurnLength,
    resolveCrisis,
    resolveDecision,
    runOptionalAction,
    renameStudio,
    upgradeMarketingTeam,
    upgradeStudioCapacity,
    setStudioSpecialization,
    investDepartment,
    signExclusivePartner,
    poachExecutiveTeam,
    lastMessage,
  } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      dismissReleaseReveal: state.dismissReleaseReveal,
      endWeek: state.endWeek,
      advanceToNextDecision: state.advanceToNextDecision,
      setTurnLength: state.setTurnLength,
      resolveCrisis: state.resolveCrisis,
      resolveDecision: state.resolveDecision,
      runOptionalAction: state.runOptionalAction,
      renameStudio: state.renameStudio,
      upgradeMarketingTeam: state.upgradeMarketingTeam,
      upgradeStudioCapacity: state.upgradeStudioCapacity,
      setStudioSpecialization: state.setStudioSpecialization,
      investDepartment: state.investDepartment,
      signExclusivePartner: state.signExclusivePartner,
      poachExecutiveTeam: state.poachExecutiveTeam,
      lastMessage: state.lastMessage,
      statusSignature:
        `${mgr.currentWeek}:${mgr.turnLengthWeeks}:${mgr.canEndWeek ? 1 : 0}:${mgr.cash}:${mgr.studioHeat}:` +
        `${mgr.isBankrupt ? 1 : 0}:${mgr.bankruptcyReason ?? 'none'}:${mgr.consecutiveLowCashWeeks}:${mgr.studioName}:` +
        `${mgr.studioTier}:${mgr.studioSpecialization}:${mgr.legacyScore}:${mgr.lifetimeProfit}:${mgr.lifetimeRevenue}:` +
        `${mgr.lifetimeExpenses}:${mgr.marketingTeamLevel}:${mgr.projectCapacityUsed}:${mgr.projectCapacityLimit}:` +
        `${mgr.executiveNetworkLevel}:${mgr.decisionQueue.length}:${mgr.pendingCrises.length}:${mgr.activeProjects.length}`,
      repSignature:
        `${mgr.reputation.critics}:${mgr.reputation.talent}:${mgr.reputation.distributor}:${mgr.reputation.audience}`,
      projectsSignature: mgr.activeProjects
        .map(
          (p) =>
            `${p.id}:${p.title}:${p.phase}:${p.genre}:${p.scheduledWeeksRemaining}:${p.releaseWeek ?? -1}:${p.releaseWindow ?? 'none'}:` +
            `${p.budget.actualSpend}:${p.budget.ceiling}:${p.projectedROI}:${p.finalBoxOffice ?? 0}:${p.openingWeekendGross ?? 0}:` +
            `${p.scriptQuality}:${p.conceptStrength}:${p.hypeScore}:${p.directorId ?? 'none'}:${p.castIds.join(',')}`
        )
        .join('|'),
      decisionsSignature: mgr.decisionQueue
        .map(
          (d) =>
            `${d.id}:${d.projectId ?? 'studio'}:${d.weeksUntilExpiry}:${d.options
              .map((o) => `${o.id}:${o.cashDelta}:${o.hypeDelta}:${o.studioHeatDelta}`)
              .join(',')}`
        )
        .join('|'),
      crisesSignature: mgr.pendingCrises
        .map(
          (c) =>
            `${c.id}:${c.projectId}:${c.severity}:${c.options
              .map((o) => `${o.id}:${o.cashDelta}:${o.scheduleDelta}`)
              .join(',')}`
        )
        .join('|'),
      arcsSignature: Object.entries(mgr.storyArcs)
        .map(([arcId, arc]) => `${arcId}:${arc.status}:${arc.stage}:${arc.lastUpdatedWeek}`)
        .join('|'),
      newsSignature: mgr.industryNewsLog.map((n) => `${n.id}:${n.week}:${n.studioName}:${n.heatDelta}`).join('|'),
      chronicleSignature: mgr.studioChronicle.map((c) => `${c.id}:${c.week}:${c.type}:${c.impact}`).join('|'),
      milestoneSignature: mgr.milestones.map((m) => `${m.id}:${m.unlockedWeek}:${m.value ?? -1}`).join('|'),
      awardsSignature: mgr.awardsHistory
        .map(
          (a) =>
            `${a.seasonYear}:${a.week}:${a.showName}:${a.results
              .map((r) => `${r.projectId}:${r.nominations}:${r.wins}:${r.score}`)
              .join(',')}`
        )
        .join('|'),
      genreSignature: Object.entries(mgr.genreCycles)
        .map(([genre, cycle]) => `${genre}:${cycle.demand}:${cycle.momentum}:${cycle.shockUntilWeek ?? -1}`)
        .join('|'),
      rivalsSignature: mgr.rivals
        .map(
          (r) =>
            `${r.id}:${r.studioHeat}:${r.memory.hostility}:${r.memory.respect}:${r.memory.retaliationBias}:` +
            `${r.memory.cooperationBias}:${r.lockedTalentIds.join(',')}:${r.upcomingReleases
              .map((f) => `${f.id}:${f.releaseWeek}:${f.genre}`)
              .join(',')}`
        )
        .join('|'),
      releaseRevealSignature: `${mgr.pendingReleaseReveals.join(',')}|${mgr.pendingFinalReleaseReveals.join(',')}|${mgr.releaseReports
        .map((r) => `${r.projectId}:${r.weekResolved}:${r.roi}:${r.outcome}`)
        .join('|')}`,
      availabilitySignature: `${mgr.firstSessionComplete ? 1 : 0}:${mgr.getActiveExclusivePartner() ?? 'none'}:${mgr.exclusivePartnerUntilWeek ?? -1}`,
    };
  }));

  const reveal        = manager.getNextReleaseReveal();
  const isFinalReveal = !!reveal && manager.isFinalReleaseReveal(reveal.id);
  const revealReport  = reveal ? manager.getLatestReleaseReport(reveal.id) : null;
  const leaderboard   = manager.getIndustryHeatLeaderboard();
  const news          = manager.industryNewsLog.slice(0, 6);
  const chronicle     = manager.studioChronicle.slice(0, 8);
  const milestones    = manager.getActiveMilestones().slice(0, 6);
  const weeklyExpenses = manager.estimateWeeklyBurn();
  const isGameOver    = manager.isBankrupt;
  const hasLowCashWarning       = manager.consecutiveLowCashWeeks >= BANKRUPTCY_RULES.WARNING_WEEKS;
  const hasUrgentLowCashWarning = manager.consecutiveLowCashWeeks >= BANKRUPTCY_RULES.URGENT_WEEKS;

  const arcEntries = Object.entries(manager.storyArcs)
    .sort((a, b) => {
      if (a[1].status === b[1].status) return b[1].lastUpdatedWeek - a[1].lastUpdatedWeek;
      if (a[1].status === 'active')    return -1;
      if (b[1].status === 'active')    return 1;
      if (a[1].status === 'resolved')  return -1;
      return 1;
    })
    .slice(0, 8);
  const activeArcCount = arcEntries.filter(([, arc]) => arc.status === 'active').length;

  const nextAwardsWeek = (() => {
    if (manager.currentWeek < AWARDS_RULES.AWARDS_WEEK_IN_SEASON) return AWARDS_RULES.AWARDS_WEEK_IN_SEASON;
    const offset = (manager.currentWeek - AWARDS_RULES.AWARDS_WEEK_IN_SEASON) % AWARDS_RULES.SEASON_LENGTH_WEEKS;
    if (offset === 0) return manager.currentWeek + AWARDS_RULES.SEASON_LENGTH_WEEKS;
    return manager.currentWeek + (AWARDS_RULES.SEASON_LENGTH_WEEKS - offset);
  })();

  const lastAwards   = manager.awardsHistory[0];
  const genreSnapshot = manager.getGenreCycleSnapshot();
  const hotGenres     = genreSnapshot.slice(0, 3);
  const coolGenres    = [...genreSnapshot].slice(-2).reverse();
  const rivalRelations = [...manager.rivals]
    .sort((a, b) => (b.memory.hostility - b.memory.respect) - (a.memory.hostility - a.memory.respect))
    .slice(0, 4);
  const [studioNameDraft, setStudioNameDraft] = useState(manager.studioName);

  useEffect(() => {
    setStudioNameDraft(manager.studioName);
  }, [manager.studioName]);

  const canEnd = manager.canEndWeek && !isGameOver;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.goldDeep + '18', 'transparent']}
          style={styles.headerGlow}
          pointerEvents="none"
        />
        <Text style={styles.studioName}>{manager.studioName}</Text>
        <Text style={styles.weekLine}>Week {manager.currentWeek} · {TIER_LABELS[manager.studioTier] ?? manager.studioTier}</Text>
      </View>

      {/* ── Getting Started — always at top when visible ── */}
      {!manager.firstSessionComplete && (
        <GlassCard variant="teal">
          <SectionLabel label="Getting Started" />
          {[
            'Inbox decisions expire — resolve them within the listed weeks or lose the opportunity.',
            'Projects need a Director + Lead Actor + Script Quality ≥ 6.0 to advance to Pre-Production.',
            'End Turn advances time. Crises must be cleared first. Each turn costs cash from production burn.',
            'Reputation has four pillars: Critics, Talent, Distributor, and Audience. Each is affected differently.',
          ].map((tip, i) => (
            <Text key={i} style={[styles.body, { color: colors.accentTeal }]}>· {tip}</Text>
          ))}
        </GlassCard>
      )}

      {lastMessage ? (
        <GlassCard variant="teal">
          <Text style={styles.message}>{lastMessage}</Text>
        </GlassCard>
      ) : null}

      {/* ── Game Over ── */}
      {isGameOver && (
        <GlassCard variant="red">
          <SectionLabel label="Game Over" />
          <Text style={[styles.bodyStrong, { color: colors.accentRed }]}>Bankruptcy Declared</Text>
          <Text style={styles.body}>{manager.bankruptcyReason ?? 'Studio is bankrupt.'}</Text>
          <Text style={styles.muted}>Start a new run from the save menu to continue.</Text>
        </GlassCard>
      )}

      {/* ── Weekly Status ── */}
      <GlassCard style={{ gap: spacing.sp2 }}>
        <SectionLabel label="Weekly Status" />
        <View style={styles.statusRow}>
          <GlassCard variant="elevated" style={styles.statusTile}>
            <MetricTile value={manager.currentWeek} label="Week" size="sm" />
          </GlassCard>
          <GlassCard variant="elevated" style={styles.statusTile}>
            <MetricTile
              value={manager.canEndWeek ? 'Ready' : 'Blocked'}
              label="Turn"
              size="sm"
              accent={manager.canEndWeek ? colors.accentTeal : colors.accentRed}
            />
          </GlassCard>
          <GlassCard variant="elevated" style={styles.statusTile}>
            <MetricTile value={manager.activeProjects.length} label="Projects" size="sm" />
          </GlassCard>
          <GlassCard variant="elevated" style={styles.statusTile}>
            <MetricTile
              value={manager.decisionQueue.length}
              label="Inbox"
              size="sm"
              accent={manager.decisionQueue.length > 0 ? colors.goldMid : colors.textMuted}
            />
          </GlassCard>
        </View>

        {/* Cash snapshot */}
        <View style={styles.cashRow}>
          <MetricTile value={money(manager.cash)}           label="Cash"         size="sm" />
          <MetricTile value={money(weeklyExpenses)}         label="Weekly Burn"  size="sm" accent={colors.accentRed} />
          <MetricTile value={money(manager.lifetimeProfit)} label="Lifetime P/L" size="sm"
            accent={manager.lifetimeProfit >= 0 ? colors.accentTeal : colors.accentRed} />
        </View>

        {!manager.canEndWeek && (
          <Text style={styles.alert}>Resolve crisis to unlock End Turn.</Text>
        )}
        {hasLowCashWarning && (
          <Text style={styles.alert}>
            ⚠ Bankruptcy Risk: Cash below $1M for {manager.consecutiveLowCashWeeks} consecutive weeks.
            {hasUrgentLowCashWarning ? ' Emergency action required.' : ''}
          </Text>
        )}
      </GlassCard>

      {/* ── Studio Standing ── */}
      <GlassCard variant={manager.studioHeat >= 70 ? 'gold' : 'default'}>
        <View style={styles.standingHeader}>
          <View style={{ flex: 1 }}>
            <SectionLabel label="Studio Standing" />
            <Text style={styles.tierName}>{TIER_LABELS[manager.studioTier] ?? manager.studioTier}</Text>
          </View>
          <View style={styles.heatBadge}>
            <Text style={styles.heatValue}>{manager.studioHeat.toFixed(0)}</Text>
            <Text style={styles.heatLabel}>HEAT</Text>
          </View>
        </View>
        <ProgressBar
          value={manager.studioHeat}
          color={manager.studioHeat >= 70 ? colors.accentGreen : manager.studioHeat >= 40 ? colors.goldMid : colors.accentRed}
          height={5}
          animated
        />
        <RepPillarGrid reputation={manager.reputation} style={{ marginTop: spacing.sp1 }} />
        <Text style={styles.muted}>{TIER_NEXT_GOAL[manager.studioTier]}</Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>Legacy Score: {manager.legacyScore}</Text>
      </GlassCard>

      {/* ── Blocking Crises (always visible - urgent) ── */}
      {manager.pendingCrises.length > 0 && (
        <GlassCard variant="red">
          <SectionLabel label={`Blocking Crises (${manager.pendingCrises.length})`} />
          {manager.pendingCrises.map((crisis) => (
            <GlassCard key={crisis.id} variant="elevated" style={{ gap: spacing.sp2, borderColor: colors.borderRed }}>
              <Text style={styles.muted}>
                Affects: {manager.activeProjects.find((p) => p.id === crisis.projectId)?.title ?? 'Unknown Project'}
              </Text>
              <Text style={[styles.bodyStrong, { color: colors.accentRed }]}>{crisis.title}</Text>
              <Text style={styles.body}>{crisis.body}</Text>
              <Text style={[styles.muted, { color: colors.accentRed }]}>Severity: {crisis.severity.toUpperCase()}</Text>
              <View style={styles.optionGroup}>
                {crisis.options.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[styles.optionBtn, { borderColor: colors.borderRed }]}
                    onPress={() => resolveCrisis(crisis.id, option.id)}
                  >
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionBody}>
                      {option.preview} ({signedMoney(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}{option.scheduleDelta}w)
                    </Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          ))}
        </GlassCard>
      )}

      {/* ── Decision Inbox (always visible) ── */}
      <GlassCard style={{ gap: spacing.sp2 }}>
        <SectionLabel label="Decision Inbox" />
        {manager.decisionQueue.length === 0
          ? <Text style={styles.muted}>No active decisions right now.</Text>
          : manager.decisionQueue.map((item) => (
            <GlassCard key={item.id} variant="elevated" style={{ gap: spacing.sp2 }}>
              <View style={styles.inboxHeader}>
                <Text style={styles.muted}>
                  {item.projectId
                    ? manager.activeProjects.find((p) => p.id === item.projectId)?.title ?? 'Unknown Project'
                    : 'Studio-wide'}
                </Text>
                <View style={[styles.expiryPill, { borderColor: item.weeksUntilExpiry <= 1 ? colors.borderRed : colors.borderGold }]}>
                  <Text style={[styles.expiryText, { color: item.weeksUntilExpiry <= 1 ? colors.accentRed : colors.goldMid }]}>
                    {Math.max(0, item.weeksUntilExpiry)}w left
                  </Text>
                </View>
              </View>
              <Text style={styles.bodyStrong}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <View style={styles.optionGroup}>
                {item.options.map((option) => (
                  <Pressable
                    key={option.id}
                    style={styles.optionBtn}
                    onPress={() => resolveDecision(item.id, option.id)}
                  >
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionBody}>{option.preview} ({signedMoney(option.cashDelta)})</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          ))
        }
      </GlassCard>

      {/* ════════════════════════════════════════════
          COLLAPSIBLE SECTIONS
          ════════════════════════════════════════════ */}

      {/* ── Operations (grouped collapsible) ── */}
      <CollapsibleCard
        title="Operations"
        badge={`Cap ${manager.projectCapacityUsed}/${manager.projectCapacityLimit}`}
        badgeColor={manager.projectCapacityUsed >= manager.projectCapacityLimit ? colors.accentRed : colors.accentTeal}
        defaultOpen={false}
      >
        {/* Capacity */}
        <View>
          <SectionLabel label="Capacity" />
          <View style={[styles.capRow, { marginTop: spacing.sp1 }]}>
            <MetricTile value={`L${manager.marketingTeamLevel}`}    label="Marketing"    size="sm" />
            <MetricTile value={`${manager.projectCapacityUsed}/${manager.projectCapacityLimit}`} label="Slots" size="sm" />
            <MetricTile value={`L${manager.executiveNetworkLevel}`} label="Exec Network" size="sm" />
          </View>
          <ProgressBar
            value={(manager.projectCapacityUsed / manager.projectCapacityLimit) * 100}
            color={manager.projectCapacityUsed >= manager.projectCapacityLimit ? colors.accentRed : colors.accentTeal}
            height={4}
            animated
            style={{ marginTop: spacing.sp2 }}
          />
          <View style={[styles.actionsRow, { marginTop: spacing.sp2 }]}>
            <PremiumButton label="Upgrade Marketing" onPress={upgradeMarketingTeam}  disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
            <PremiumButton label="Expand Capacity"   onPress={upgradeStudioCapacity} disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
          </View>
        </View>

        {/* Studio Identity */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sp3, gap: spacing.sp2 }}>
          <SectionLabel label="Studio Identity" />
          <TextInput
            value={studioNameDraft}
            onChangeText={setStudioNameDraft}
            placeholder="Enter studio name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={32}
          />
          <PremiumButton label="Rename Studio" onPress={() => renameStudio(studioNameDraft)} variant="secondary" size="sm" />

          <SectionLabel label="Specialization" style={{ marginTop: spacing.sp1 }} />
          <Text style={styles.muted}>Choose one focus. Pivoting later costs cash and partner trust.</Text>
          <View style={styles.actionsRow}>
            {SPECIALIZATION_OPTIONS.map((option) => (
              <PremiumButton
                key={option.key}
                label={option.label}
                onPress={() => setStudioSpecialization(option.key)}
                disabled={isGameOver}
                variant={manager.studioSpecialization === option.key ? 'primary' : 'secondary'}
                size="sm"
                style={styles.flexBtn}
              />
            ))}
          </View>

          <SectionLabel label="Departments" style={{ marginTop: spacing.sp1 }} />
          <Text style={styles.muted}>
            Development L{manager.departmentLevels.development} · Production L{manager.departmentLevels.production} · Distribution L{manager.departmentLevels.distribution}
          </Text>
          <View style={styles.actionsRow}>
            <PremiumButton label="Invest Dev"  onPress={() => investDepartment('development')} disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
            <PremiumButton label="Invest Prod" onPress={() => investDepartment('production')}  disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
            <PremiumButton label="Invest Dist" onPress={() => investDepartment('distribution')} disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
          </View>
        </View>

        {/* Strategic Levers */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sp3, gap: spacing.sp2 }}>
          <SectionLabel label="Strategic Levers" />
          <Text style={styles.muted}>Lock in a distribution partner for favourable deal terms. Poach executive talent for network bonuses.</Text>
          <Text style={styles.body}>
            Partner: <Text style={{ color: colors.goldMid }}>{manager.getActiveExclusivePartner() ?? 'None'}</Text>
            {manager.exclusivePartnerUntilWeek ? ` (to W${manager.exclusivePartnerUntilWeek})` : ''}
          </Text>
          <View style={styles.actionsRow}>
            {PARTNER_OPTIONS.map((partner) => (
              <PremiumButton
                key={partner}
                label={partner.split(' ')[0]}
                onPress={() => signExclusivePartner(partner)}
                disabled={isGameOver}
                variant="secondary"
                size="sm"
                style={styles.flexBtn}
              />
            ))}
          </View>
          <PremiumButton label="Poach Executive Team" onPress={poachExecutiveTeam} disabled={isGameOver} variant="gold-outline" size="sm" />
        </View>

        {/* Turn Length */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sp3, gap: spacing.sp2 }}>
          <SectionLabel label="Turn Length" />
          <Text style={styles.muted}>Current: {manager.turnLengthWeeks} week{manager.turnLengthWeeks === 1 ? '' : 's'} per turn</Text>
          <View style={styles.actionsRow}>
            {([
              { weeks: 1 as const, desc: 'More control, safer pacing' },
              { weeks: 2 as const, desc: 'Faster flow, bigger swings' },
            ] as const).map(({ weeks, desc }) => (
              <Pressable
                key={weeks}
                style={[
                  styles.turnBtn,
                  manager.turnLengthWeeks === weeks ? styles.turnBtnActive : null,
                ]}
                disabled={isGameOver}
                onPress={() => setTurnLength(weeks)}
              >
                <Text style={[styles.optionTitle, manager.turnLengthWeeks === weeks ? { color: colors.goldMid } : null]}>
                  {weeks} Week{weeks > 1 ? 's' : ''}
                </Text>
                <Text style={styles.optionBody}>{desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </CollapsibleCard>

      {/* ── Story Arcs ── */}
      <CollapsibleCard
        title="Story Arcs"
        badge={activeArcCount > 0 ? `${activeArcCount} Active` : undefined}
        badgeColor={colors.goldMid}
        defaultOpen={activeArcCount > 0}
      >
        {arcEntries.length === 0
          ? <Text style={styles.muted}>No major arc threads have started yet.</Text>
          : arcEntries.map(([arcId, arc]) => {
            const arcColor = arc.status === 'resolved' ? colors.accentTeal : arc.status === 'failed' ? colors.accentRed : colors.goldMid;
            return (
              <GlassCard key={arcId} variant="elevated" style={{ gap: 4 }}>
                <View style={styles.arcRow}>
                  <Text style={styles.bodyStrong}>{ARC_LABELS[arcId] ?? arcId}</Text>
                  <View style={[styles.arcBadge, { borderColor: arcColor + '50', backgroundColor: arcColor + '12' }]}>
                    <Text style={[styles.arcStatus, { color: arcColor }]}>{arc.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.muted}>Stage {arc.stage} · Last updated W{arc.lastUpdatedWeek}</Text>
              </GlassCard>
            );
          })
        }
      </CollapsibleCard>

      {/* ── Last Week Summary ── */}
      {manager.lastWeekSummary && (
        <CollapsibleCard title="Last Week Summary" defaultOpen>
          <Text style={[styles.body, { color: manager.lastWeekSummary.cashDelta >= 0 ? colors.accentTeal : colors.accentRed }]}>
            Cash {signedMoney(manager.lastWeekSummary.cashDelta)}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.muted}>· {event}</Text>
          ))}
        </CollapsibleCard>
      )}

      {/* ── Genre Cycles ── */}
      <CollapsibleCard title="Genre Cycles">
        <Text style={[styles.muted, { color: colors.accentTeal, fontFamily: typography.fontBodySemiBold }]}>↑ Heating</Text>
        {hotGenres.map((entry) => (
          <View key={`hot-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{capitalize(entry.genre)}</Text>
            <Text style={[styles.muted, { color: colors.accentTeal }]}>
              {entry.demand.toFixed(2)}× ({entry.momentum >= 0 ? '+' : ''}{Math.round(entry.momentum * 1000) / 10}%)
            </Text>
          </View>
        ))}
        <Text style={[styles.muted, { color: colors.accentRed, fontFamily: typography.fontBodySemiBold, marginTop: 4 }]}>↓ Cooling</Text>
        {coolGenres.map((entry) => (
          <View key={`cool-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{capitalize(entry.genre)}</Text>
            <Text style={[styles.muted, { color: colors.accentRed }]}>
              {entry.demand.toFixed(2)}× ({entry.momentum >= 0 ? '+' : ''}{Math.round(entry.momentum * 1000) / 10}%)
            </Text>
          </View>
        ))}
      </CollapsibleCard>

      {/* ── Industry Heat Leaderboard ── */}
      <CollapsibleCard title="Industry Leaderboard">
        {leaderboard.map((entry, index) => (
          <View key={entry.name} style={styles.leaderRow}>
            <Text style={[styles.body, entry.isPlayer ? { color: colors.goldMid, fontFamily: typography.fontBodyBold } : null]}>
              #{index + 1} {entry.name}
            </Text>
            <Text style={[styles.body, entry.isPlayer ? { color: colors.goldMid, fontFamily: typography.fontBodyBold } : null]}>
              {entry.heat.toFixed(0)}
            </Text>
          </View>
        ))}
      </CollapsibleCard>

      {/* ── Rival Relations ── */}
      <CollapsibleCard title="Rival Relations">
        {rivalRelations.map((rival) => {
          const stance = manager.getRivalStance(rival);
          return (
            <View key={rival.id} style={styles.leaderRow}>
              <Text style={styles.body}>{rival.name}</Text>
              <Text style={[styles.muted, { color: stanceColor(stance) }]}>
                {stanceLabel(stance)} · H{rival.memory.hostility}/R{rival.memory.respect}
              </Text>
            </View>
          );
        })}
      </CollapsibleCard>

      {/* ── Awards Pulse ── */}
      <CollapsibleCard title="Awards Pulse">
        <Text style={styles.body}>Next awards week: <Text style={{ color: colors.goldMid }}>W{nextAwardsWeek}</Text></Text>
        {lastAwards ? (
          <>
            <Text style={styles.bodyStrong}>{lastAwards.headline}</Text>
            {lastAwards.results.slice(0, 3).map((result) => (
              <Text key={`${lastAwards.seasonYear}-${result.projectId}`} style={styles.muted}>
                {result.title}: {result.nominations} nom(s), {result.wins} win(s)
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>No awards seasons have resolved yet.</Text>
        )}
      </CollapsibleCard>

      {/* ── Milestones ── */}
      <CollapsibleCard
        title="Milestones"
        badge={milestones.length > 0 ? `${milestones.length}` : undefined}
        badgeColor={colors.goldMid}
      >
        {milestones.length === 0
          ? <Text style={styles.muted}>No milestones unlocked yet.</Text>
          : milestones.map((milestone) => (
            <View key={`${milestone.id}-${milestone.unlockedWeek}`} style={styles.leaderRow}>
              <Text style={styles.bodyStrong}>🏅 {milestone.title}</Text>
              <Text style={styles.muted}>W{milestone.unlockedWeek}</Text>
            </View>
          ))
        }
      </CollapsibleCard>

      {/* ── Studio Chronicle ── */}
      <CollapsibleCard title="Studio Chronicle">
        {chronicle.length === 0
          ? <Text style={styles.muted}>No defining moments yet.</Text>
          : chronicle.map((entry) => (
            <View key={entry.id} style={styles.chronicleEntry}>
              <Text style={styles.chronicleWeek}>W{entry.week} {CHRONICLE_ICONS[entry.type] ?? '·'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.chronicleHeadline,
                  entry.impact === 'positive' ? { color: colors.accentTeal } :
                  entry.impact === 'negative' ? { color: colors.accentRed } : null,
                ]}>
                  {entry.headline}
                </Text>
                {entry.detail && <Text style={styles.muted}>{entry.detail}</Text>}
              </View>
            </View>
          ))
        }
      </CollapsibleCard>

      {/* ── Industry News ── */}
      <CollapsibleCard title="Industry News">
        {news.length === 0
          ? <Text style={styles.muted}>No major rival movement yet.</Text>
          : news.map((item) => (
            <Text key={item.id} style={styles.muted}>W{item.week}: {item.headline}</Text>
          ))
        }
      </CollapsibleCard>

      {/* ── Actions ── */}
      <PremiumButton
        label="Run Optional Action (+Hype)"
        onPress={runOptionalAction}
        disabled={isGameOver}
        variant="secondary"
        size="md"
        fullWidth
      />
      <PremiumButton
        label="Advance To Next Decision"
        onPress={advanceToNextDecision}
        disabled={!canEnd}
        variant="secondary"
        size="md"
        fullWidth
      />
      <PremiumButton
        label={isGameOver ? 'Game Over' : manager.canEndWeek ? `End Turn (${manager.turnLengthWeeks}w)` : 'Resolve Crisis First'}
        onPress={endWeek}
        disabled={!canEnd}
        variant="primary"
        size="lg"
        fullWidth
      />

      {/* ── Release Reveal Modal ── */}
      <ReleaseRevealModal
        reveal={reveal}
        isFinalReveal={isFinalReveal}
        revealReport={revealReport}
        dismissReleaseReveal={dismissReleaseReveal}
      />

    </ScrollView>
  );
}
