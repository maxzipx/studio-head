import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AWARDS_RULES, BANKRUPTCY_RULES } from '@/src/domain/balance-constants';
import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

const TIER_LABELS: Record<string, string> = {
  indieStudio: 'Indie Studio',
  establishedIndie: 'Established Indie',
  midTier: 'Mid-Tier Studio',
  majorStudio: 'Major Studio',
  globalPowerhouse: 'Global Powerhouse',
};

const TIER_NEXT_GOAL: Record<string, string> = {
  indieStudio: 'Release 1 film and reach Heat 25 to advance',
  establishedIndie: 'Release 3 films and reach Heat 45 to advance',
  midTier: 'Release 6 films and reach Heat 65 to advance',
  majorStudio: 'Release 10 films and reach Heat 80 to advance',
  globalPowerhouse: 'You have reached the summit.',
};

const ARC_LABELS: Record<string, string> = {
  'awards-circuit': 'Awards Run',
  'exhibitor-power-play': 'Exhibitor Power Play',
  'exhibitor-war': 'Theater Access Battle',
  'financier-control': 'Investor Pressure',
  'franchise-pivot': 'Universe Gamble',
  'leak-piracy': 'Leak Fallout',
  'talent-meltdown': 'Volatile Star Cycle',
  'passion-project': "The Director's Vision",
};

const CHRONICLE_ICONS: Record<string, string> = {
  filmRelease: '🎬',
  arcResolution: '⭐',
  tierAdvance: '📈',
  awardsOutcome: '🏆',
  festivalOutcome: '🎪',
  crisisResolved: '🔧',
};

const SPECIALIZATION_OPTIONS: Array<{ key: 'balanced' | 'blockbuster' | 'prestige' | 'indie'; label: string }> = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'blockbuster', label: 'Blockbuster' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'indie', label: 'Indie' },
];

const PARTNER_OPTIONS = ['Aster Peak Pictures', 'Silverline Distribution', 'Constellation Media'];
function stanceLabel(value: string): string {
  if (value === 'hostile') return 'Hostile';
  if (value === 'competitive') return 'Competitive';
  if (value === 'respectful') return 'Respectful';
  return 'Neutral';
}

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
  } =
    useGame();
  const reveal = manager.getNextReleaseReveal();
  const isFinalReveal = !!reveal && manager.isFinalReleaseReveal(reveal.id);
  const revealReport = reveal ? manager.getLatestReleaseReport(reveal.id) : null;
  const leaderboard = manager.getIndustryHeatLeaderboard();
  const news = manager.industryNewsLog.slice(0, 6);
  const chronicle = manager.studioChronicle.slice(0, 8);
  const milestones = manager.getActiveMilestones().slice(0, 6);
  const weeklyExpenses = manager.estimateWeeklyBurn();
  const readyToAdvance = manager.canEndWeek ? 'Ready' : 'Blocked';
  const isGameOver = manager.isBankrupt;
  const hasLowCashWarning = manager.consecutiveLowCashWeeks >= BANKRUPTCY_RULES.WARNING_WEEKS;
  const hasUrgentLowCashWarning = manager.consecutiveLowCashWeeks >= BANKRUPTCY_RULES.URGENT_WEEKS;
  const arcEntries = Object.entries(manager.storyArcs)
    .sort((a, b) => {
      if (a[1].status === b[1].status) return b[1].lastUpdatedWeek - a[1].lastUpdatedWeek;
      if (a[1].status === 'active') return -1;
      if (b[1].status === 'active') return 1;
      if (a[1].status === 'resolved') return -1;
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
  const lastAwards = manager.awardsHistory[0];
  const genreSnapshot = manager.getGenreCycleSnapshot();
  const hotGenres = genreSnapshot.slice(0, 3);
  const coolGenres = [...genreSnapshot].slice(-2).reverse();
  const rivalRelations = [...manager.rivals]
    .sort((a, b) => (b.memory.hostility - b.memory.respect) - (a.memory.hostility - a.memory.respect))
    .slice(0, 4);
  const anim = useRef(new Animated.Value(0)).current;
  const [studioNameDraft, setStudioNameDraft] = useState(manager.studioName);

  useEffect(() => {
    if (!reveal) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, reveal]);

  useEffect(() => {
    setStudioNameDraft(manager.studioName);
  }, [manager.studioName]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Studio HQ</Text>
      <Text style={styles.subtitle}>
        Week {manager.currentWeek} | {manager.studioName}
      </Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Studio Identity</Text>
        <TextInput
          value={studioNameDraft}
          onChangeText={setStudioNameDraft}
          placeholder="Enter studio name"
          placeholderTextColor={tokens.textMuted}
          style={styles.input}
          maxLength={32}
        />
        <Pressable style={styles.choiceButton} onPress={() => renameStudio(studioNameDraft)}>
          <Text style={styles.choiceTitle}>Rename Studio</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Week Progress</Text>
          <Text style={styles.metric}>{manager.currentWeek}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Advance Status</Text>
          <Text style={[styles.metric, manager.canEndWeek ? styles.metricReady : styles.metricBlocked]}>{readyToAdvance}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Weekly Status</Text>
        <Text style={styles.body}>Crises: {manager.pendingCrises.length}</Text>
        <Text style={styles.body}>Inbox Items: {manager.decisionQueue.length}</Text>
        <Text style={styles.body}>Active Projects: {manager.activeProjects.length}</Text>
        {!manager.canEndWeek ? <Text style={styles.alert}>Resolve crisis to unlock End Turn.</Text> : null}
        {hasLowCashWarning ? (
          <Text style={styles.alert}>
            Bankruptcy Risk: Cash below $1M for {manager.consecutiveLowCashWeeks} consecutive weeks.
            {hasUrgentLowCashWarning ? ' Emergency action required.' : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Cashflow Dashboard</Text>
        <Text style={styles.body}>Weekly Expenses: {money(weeklyExpenses)}</Text>
        <Text style={styles.body}>Lifetime Revenue: {money(manager.lifetimeRevenue)}</Text>
        <Text style={styles.body}>Lifetime Profit: {money(manager.lifetimeProfit)}</Text>
      </View>

      {isGameOver ? (
        <View style={[styles.card, styles.gameOverCard]}>
          <Text style={styles.label}>Game Over</Text>
          <Text style={styles.gameOverTitle}>Bankruptcy Declared</Text>
          <Text style={styles.body}>{manager.bankruptcyReason ?? 'Studio is bankrupt.'}</Text>
          <Text style={styles.mutedBody}>Start a new run from the save menu to continue playing.</Text>
        </View>
      ) : null}

      {!manager.firstSessionComplete ? (
        <View style={[styles.card, styles.tutorialCard]}>
          <Text style={styles.label}>Getting Started</Text>
          <Text style={styles.tutorialTip}>Inbox decisions expire - resolve them within the listed weeks or lose the opportunity and take a reputation hit.</Text>
          <Text style={styles.tutorialTip}>Projects need a director + lead actor + script quality {'>='} 6.0 to move from Development to Pre-Production.</Text>
          <Text style={styles.tutorialTip}>End Turn advances time. Crises must be cleared first. Each turn costs cash from active production burn.</Text>
          <Text style={styles.tutorialTip}>Your reputation has four pillars: Critics, Talent, Distributor, and Audience. Each is affected differently by your decisions.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Studio Standing</Text>
        <View style={styles.rowLine}>
          <Text style={styles.bodyStrong}>{TIER_LABELS[manager.studioTier] ?? manager.studioTier}</Text>
          <Text style={styles.legacyScore}>Legacy {manager.legacyScore}</Text>
        </View>
        <Text style={styles.mutedBody}>{TIER_NEXT_GOAL[manager.studioTier]}</Text>
        <View style={styles.repGrid}>
          <View style={styles.repPillar}>
            <Text style={styles.repLabel}>Critics</Text>
            <Text style={styles.repValue}>{manager.reputation.critics.toFixed(0)}</Text>
          </View>
          <View style={styles.repPillar}>
            <Text style={styles.repLabel}>Talent</Text>
            <Text style={styles.repValue}>{manager.reputation.talent.toFixed(0)}</Text>
          </View>
          <View style={styles.repPillar}>
            <Text style={styles.repLabel}>Distributor</Text>
            <Text style={styles.repValue}>{manager.reputation.distributor.toFixed(0)}</Text>
          </View>
          <View style={styles.repPillar}>
            <Text style={styles.repLabel}>Audience</Text>
            <Text style={styles.repValue}>{manager.reputation.audience.toFixed(0)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Operations Capacity</Text>
        <Text style={styles.body}>
          Marketing Team: L{manager.marketingTeamLevel} | Capacity: {manager.projectCapacityUsed}/{manager.projectCapacityLimit}
        </Text>
        <Text style={styles.body}>
          Specialization: {manager.studioSpecialization} | Exec Network: L{manager.executiveNetworkLevel}
        </Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={upgradeMarketingTeam}>
            <Text style={styles.choiceTitle}>Upgrade Marketing Team</Text>
          </Pressable>
          <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={upgradeStudioCapacity}>
            <Text style={styles.choiceTitle}>Expand Studio Capacity</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Studio Identity</Text>
        <Text style={styles.mutedBody}>Choose one focus. Pivoting later costs cash and partner trust.</Text>
        <View style={styles.actionsRow}>
          {SPECIALIZATION_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.choiceButton, manager.studioSpecialization === option.key ? styles.choiceButtonActive : null]}
              disabled={isGameOver}
              onPress={() => setStudioSpecialization(option.key)}>
              <Text style={styles.choiceTitle}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.mutedBody}>
          Departments: Dev L{manager.departmentLevels.development} | Prod L{manager.departmentLevels.production} | Dist L{manager.departmentLevels.distribution}
        </Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={() => investDepartment('development')}>
            <Text style={styles.choiceTitle}>Invest Dev</Text>
          </Pressable>
          <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={() => investDepartment('production')}>
            <Text style={styles.choiceTitle}>Invest Production</Text>
          </Pressable>
          <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={() => investDepartment('distribution')}>
            <Text style={styles.choiceTitle}>Invest Distribution</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Strategic Levers</Text>
        <Text style={styles.body}>
          Exclusive Partner: {manager.getActiveExclusivePartner() ?? 'None'} {manager.exclusivePartnerUntilWeek ? `(to W${manager.exclusivePartnerUntilWeek})` : ''}
        </Text>
        <View style={styles.actionsRow}>
          {PARTNER_OPTIONS.map((partner) => (
            <Pressable key={partner} style={styles.choiceButton} disabled={isGameOver} onPress={() => signExclusivePartner(partner)}>
              <Text style={styles.choiceTitle}>{partner.split(' ')[0]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.choiceButton} disabled={isGameOver} onPress={poachExecutiveTeam}>
          <Text style={styles.choiceTitle}>Poach Executive Team</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Turn Length</Text>
        <Text style={styles.mutedBody}>Current: {manager.turnLengthWeeks} week{manager.turnLengthWeeks === 1 ? '' : 's'} per turn</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.choiceButton, styles.turnChoiceButton, manager.turnLengthWeeks === 1 ? styles.choiceButtonActive : null]}
            disabled={isGameOver}
            onPress={() => setTurnLength(1)}>
            <Text style={styles.choiceTitle}>1 Week</Text>
            <Text style={styles.choiceBody}>Safer pacing, more control</Text>
          </Pressable>
          <Pressable
            style={[styles.choiceButton, styles.turnChoiceButton, manager.turnLengthWeeks === 2 ? styles.choiceButtonActive : null]}
            disabled={isGameOver}
            onPress={() => setTurnLength(2)}>
            <Text style={styles.choiceTitle}>2 Weeks</Text>
            <Text style={styles.choiceBody}>Faster flow, bigger swings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Story Arcs</Text>
        <Text style={styles.mutedBody}>Active arcs: {activeArcCount}</Text>
        {arcEntries.length === 0 ? <Text style={styles.mutedBody}>No major arc threads have started yet.</Text> : null}
        {arcEntries.map(([arcId, arc]) => (
          <View key={arcId} style={styles.arcRow}>
            <View style={styles.arcHeader}>
              <Text style={styles.bodyStrong}>{ARC_LABELS[arcId] ?? arcId}</Text>
              <Text
                style={[
                  styles.arcStatus,
                  arc.status === 'resolved'
                    ? styles.arcResolved
                    : arc.status === 'failed'
                      ? styles.arcFailed
                      : styles.arcActive,
                ]}>
                {arc.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.mutedBody}>
              Stage {arc.stage} | Last updated week {arc.lastUpdatedWeek}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, manager.pendingCrises.length > 0 ? styles.crisisCard : null]}>
        <Text style={styles.label}>Blocking Crises</Text>
        {manager.pendingCrises.length === 0 ? <Text style={styles.mutedBody}>No blocking crises this week.</Text> : null}
        {manager.pendingCrises.map((crisis) => (
          <View key={crisis.id} style={styles.actionCard}>
            <Text style={styles.mutedBody}>
              Affects: {manager.activeProjects.find((project) => project.id === crisis.projectId)?.title ?? 'Unknown project'}
            </Text>
            <Text style={styles.crisisTitle}>{crisis.title}</Text>
            <Text style={styles.body}>{crisis.body}</Text>
            <Text style={styles.alert}>Severity: {crisis.severity.toUpperCase()}</Text>
            {crisis.options.map((option) => (
              <Pressable key={option.id} style={styles.choiceButton} onPress={() => resolveCrisis(crisis.id, option.id)}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>
                  {option.preview} ({signedMoney(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}
                  {option.scheduleDelta}w)
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Decision Inbox</Text>
        {manager.decisionQueue.length === 0 ? <Text style={styles.mutedBody}>No active decisions right now.</Text> : null}
        {manager.decisionQueue.map((item) => (
          <View key={item.id} style={styles.actionCard}>
            <Text style={styles.mutedBody}>
              Scope: {item.projectId ? manager.activeProjects.find((project) => project.id === item.projectId)?.title ?? 'Unknown project' : 'Studio-wide'}
            </Text>
            <Text style={styles.bodyStrong}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.mutedBody}>Expires in {Math.max(0, item.weeksUntilExpiry)} week(s)</Text>
            {item.options.map((option) => (
              <Pressable key={option.id} style={styles.choiceButton} onPress={() => resolveDecision(item.id, option.id)}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>
                  {option.preview} ({signedMoney(option.cashDelta)})
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Industry Heat Leaderboard</Text>
        {leaderboard.map((entry, index) => (
          <View key={entry.name} style={styles.rowLine}>
            <Text style={[styles.body, entry.isPlayer ? styles.playerRow : null]}>
              #{index + 1} {entry.name}
            </Text>
            <Text style={[styles.body, entry.isPlayer ? styles.playerRow : null]}>{entry.heat.toFixed(0)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Rival Relations</Text>
        {rivalRelations.map((rival) => (
          <View key={rival.id} style={styles.rowLine}>
            <Text style={styles.body}>{rival.name}</Text>
            <Text style={styles.mutedBody}>
              {stanceLabel(manager.getRivalStance(rival))} | H{rival.memory.hostility} / R{rival.memory.respect}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Awards Pulse</Text>
        <Text style={styles.body}>Next awards week: W{nextAwardsWeek}</Text>
        {lastAwards ? (
          <>
            <Text style={styles.bodyStrong}>{lastAwards.headline}</Text>
            {lastAwards.results.slice(0, 3).map((result) => (
              <Text key={`${lastAwards.seasonYear}-${result.projectId}`} style={styles.mutedBody}>
                {result.title}: {result.nominations} nom(s), {result.wins} win(s)
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.mutedBody}>No awards seasons have resolved yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Genre Cycles</Text>
        <Text style={styles.bodyStrong}>Heating</Text>
        {hotGenres.map((entry) => (
          <Text key={`hot-${entry.genre}`} style={styles.mutedBody}>
            {entry.genre}: {entry.demand.toFixed(2)}x ({entry.momentum >= 0 ? '+' : ''}
            {Math.round(entry.momentum * 1000) / 10}% momentum)
          </Text>
        ))}
        <Text style={styles.bodyStrong}>Cooling</Text>
        {coolGenres.map((entry) => (
          <Text key={`cool-${entry.genre}`} style={styles.mutedBody}>
            {entry.genre}: {entry.demand.toFixed(2)}x ({entry.momentum >= 0 ? '+' : ''}
            {Math.round(entry.momentum * 1000) / 10}% momentum)
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Milestones</Text>
        {milestones.length === 0 ? <Text style={styles.mutedBody}>No milestones unlocked yet.</Text> : null}
        {milestones.map((milestone) => (
          <View key={`${milestone.id}-${milestone.unlockedWeek}`} style={styles.rowLine}>
            <Text style={styles.bodyStrong}>{milestone.title}</Text>
            <Text style={styles.mutedBody}>W{milestone.unlockedWeek}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Studio Chronicle</Text>
        {chronicle.length === 0 ? (
          <Text style={styles.mutedBody}>No defining moments yet.</Text>
        ) : (
          chronicle.map((entry) => (
            <View key={entry.id} style={styles.chronicleEntry}>
              <Text style={styles.chronicleWeekLabel}>
                W{entry.week} {CHRONICLE_ICONS[entry.type] ?? '·'}
              </Text>
              <View style={styles.chronicleTextBlock}>
                <Text
                  style={[
                    styles.chronicleHeadline,
                    entry.impact === 'positive'
                      ? styles.positiveText
                      : entry.impact === 'negative'
                        ? styles.negativeText
                        : null,
                  ]}
                >
                  {entry.headline}
                </Text>
                {entry.detail ? (
                  <Text style={styles.chronicleDetail}>{entry.detail}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Industry News Feed</Text>
        {news.length === 0 ? <Text style={styles.mutedBody}>No major rival movement yet.</Text> : null}
        {news.map((item) => (
          <Text key={item.id} style={styles.mutedBody}>
            W{item.week}: {item.headline}
          </Text>
        ))}
      </View>

      {manager.lastWeekSummary ? (
        <View style={styles.card}>
          <Text style={styles.label}>Last Week Summary</Text>
          <Text style={styles.body}>
            Cash Delta: {manager.lastWeekSummary.cashDelta >= 0 ? '+' : '-'}
            {money(Math.abs(manager.lastWeekSummary.cashDelta))}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.mutedBody}>
              - {event}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable
        style={[styles.secondaryButton, isGameOver ? styles.disabledSecondaryButton : null]}
        disabled={isGameOver}
        onPress={runOptionalAction}>
        <Text style={styles.secondaryButtonText}>Run Optional Action (+Hype)</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, !manager.canEndWeek || isGameOver ? styles.disabledSecondaryButton : null]}
        disabled={!manager.canEndWeek || isGameOver}
        onPress={advanceToNextDecision}>
        <Text style={styles.secondaryButtonText}>Advance To Next Decision</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, !manager.canEndWeek || isGameOver ? styles.disabledButton : null]}
        disabled={!manager.canEndWeek || isGameOver}
        onPress={endWeek}>
        <Text style={styles.primaryButtonText}>
          {isGameOver
            ? 'Game Over'
            : manager.canEndWeek
              ? `End Turn (${manager.turnLengthWeeks}w)`
              : 'Resolve Crisis First'}
        </Text>
      </Pressable>

      <Modal
        visible={!!reveal}
        transparent
        animationType="none"
        onRequestClose={() => reveal && dismissReleaseReveal(reveal.id)}>
        <View style={styles.modalOverlay}>
          {reveal ? (
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.97, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <Text style={styles.modalTitle}>{isFinalReveal ? 'Final Box Office Report' : 'Opening Weekend Reveal'}</Text>
              <Text style={styles.modalFilm}>{reveal.title}</Text>
              {isFinalReveal && revealReport ? (
                <>
                  <Text style={styles.modalStat}>Outcome: {revealReport.outcome.toUpperCase()}</Text>
                  <Text style={styles.modalStat}>Total Gross: {money(revealReport.totalGross)}</Text>
                  <Text style={styles.modalStat}>Studio Net: {money(revealReport.studioNet)}</Text>
                  <Text style={styles.modalStat}>Profit / Loss: {money(revealReport.profit)}</Text>
                  <Text style={styles.modalStat}>ROI: {revealReport.roi.toFixed(2)}x</Text>
                  <Text style={styles.modalSub}>
                    Drivers S:{revealReport.breakdown.script >= 0 ? '+' : ''}
                    {revealReport.breakdown.script} D:{revealReport.breakdown.direction >= 0 ? '+' : ''}
                    {revealReport.breakdown.direction} Star:{revealReport.breakdown.starPower >= 0 ? '+' : ''}
                    {revealReport.breakdown.starPower}
                  </Text>
                  <Text style={styles.modalSub}>
                    Mkt:{revealReport.breakdown.marketing >= 0 ? '+' : ''}
                    {revealReport.breakdown.marketing} Time:{revealReport.breakdown.timing >= 0 ? '+' : ''}
                    {revealReport.breakdown.timing} Cycle:{revealReport.breakdown.genreCycle >= 0 ? '+' : ''}
                    {revealReport.breakdown.genreCycle}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.modalStat}>Opening Weekend: {money(reveal.openingWeekendGross ?? 0)}</Text>
                  <Text style={styles.modalStat}>Critics: {reveal.criticalScore?.toFixed(0) ?? '--'}</Text>
                  <Text style={styles.modalStat}>Audience: {reveal.audienceScore?.toFixed(0) ?? '--'}</Text>
                  <Text style={styles.modalSub}>Partner: {reveal.distributionPartner ?? 'Pending'}</Text>
                  <Text style={styles.modalSub}>Run Length Forecast: {reveal.releaseWeeksRemaining} weeks</Text>
                </>
              )}

              <Pressable style={styles.modalButton} onPress={() => dismissReleaseReveal(reveal.id)}>
                <Text style={styles.modalButtonText}>Continue</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bgPrimary,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  title: {
    color: tokens.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: tokens.textSecondary,
    marginTop: -2,
    marginBottom: 8,
    fontSize: 13,
  },
  message: {
    color: tokens.accentTeal,
    marginBottom: 4,
    fontSize: 13,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    color: tokens.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 14,
    gap: 6,
  },
  crisisCard: {
    borderColor: tokens.accentRed,
  },
  label: {
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '600',
  },
  metric: {
    color: tokens.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  metricReady: {
    color: tokens.accentTeal,
  },
  metricBlocked: {
    color: tokens.accentRed,
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
  },
  bodyStrong: {
    color: tokens.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedBody: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  actionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 6,
  },
  arcRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 4,
  },
  arcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  arcStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  arcActive: {
    color: tokens.accentGold,
  },
  arcResolved: {
    color: tokens.accentTeal,
  },
  arcFailed: {
    color: tokens.accentRed,
  },
  alert: {
    color: tokens.accentRed,
    marginTop: 4,
    fontSize: 13,
  },
  crisisTitle: {
    color: tokens.accentRed,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 9,
    gap: 3,
  },
  turnChoiceButton: {
    flex: 1,
  },
  choiceButtonActive: {
    borderColor: tokens.accentGold,
    backgroundColor: '#3B2E14',
  },
  choiceTitle: {
    color: tokens.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  choiceBody: {
    color: tokens.textMuted,
    fontSize: 12,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  playerRow: {
    color: tokens.accentGold,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: tokens.accentGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#241B0D',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: tokens.bgElevated,
    borderColor: tokens.border,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: tokens.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#5A4C31',
  },
  disabledSecondaryButton: {
    opacity: 0.55,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.accentGold,
    backgroundColor: tokens.bgSurface,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    color: tokens.accentGold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalFilm: {
    color: tokens.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  modalStat: {
    color: tokens.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalSub: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  modalButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: tokens.accentGold,
  },
  modalButtonText: {
    color: '#241B0D',
    fontSize: 14,
    fontWeight: '700',
  },
  tutorialCard: {
    borderColor: tokens.accentTeal,
    backgroundColor: '#0A1F1E',
  },
  gameOverCard: {
    borderColor: tokens.accentRed,
    backgroundColor: '#2A1212',
  },
  gameOverTitle: {
    color: tokens.accentRed,
    fontSize: 17,
    fontWeight: '700',
  },
  tutorialTip: {
    color: tokens.accentTeal,
    fontSize: 13,
    lineHeight: 19,
  },
  repGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  repPillar: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  repLabel: {
    color: tokens.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repValue: {
    color: tokens.accentGold,
    fontSize: 20,
    fontWeight: '700',
  },
  legacyScore: {
    color: tokens.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chronicleEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  chronicleWeekLabel: {
    color: tokens.textMuted,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 44,
    paddingTop: 1,
  },
  chronicleTextBlock: {
    flex: 1,
  },
  chronicleHeadline: {
    color: tokens.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  chronicleDetail: {
    color: tokens.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  positiveText: {
    color: tokens.accentTeal,
  },
  negativeText: {
    color: tokens.accentRed,
  },
});


