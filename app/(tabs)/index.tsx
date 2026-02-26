import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { AWARDS_RULES, BANKRUPTCY_RULES } from '@/src/domain/balance-constants';
import type { ReleaseReport } from '@/src/domain/types';
import { useGame } from '@/src/state/game-context';
import {
  GlassCard, MetricTile, OutcomeBadge, OutcomeType,
  PremiumButton, ProgressBar, RepPillarGrid, SectionLabel,
} from '@/src/ui/components';
import { blur, colors, radius, spacing, typography } from '@/src/ui/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}${money(Math.abs(amount))}`;
}

type ReleaseSplashTone = 'blockbuster' | 'flop' | 'record' | 'hit';

function getReleaseSplashTone(report: ReleaseReport | null): ReleaseSplashTone {
  if (!report) return 'hit';
  if (report.wasRecordOpening)        return 'record';
  if (report.outcome === 'blockbuster') return 'blockbuster';
  if (report.outcome === 'flop')        return 'flop';
  return 'hit';
}

function splashToneToOutcome(tone: ReleaseSplashTone): OutcomeType {
  if (tone === 'blockbuster') return 'blockbuster';
  if (tone === 'record')      return 'blockbuster';
  if (tone === 'flop')        return 'flop';
  return 'hit';
}

// gradient color for modal top band
function splashGradientColor(tone: ReleaseSplashTone): string {
  if (tone === 'blockbuster' || tone === 'record') return colors.accentGreen + '30';
  if (tone === 'flop') return colors.accentRed + '30';
  return '#6FAEEA30';
}

const TIER_LABELS: Record<string, string> = {
  indieStudio:       'Indie Studio',
  establishedIndie:  'Established Indie',
  midTier:           'Mid-Tier Studio',
  majorStudio:       'Major Studio',
  globalPowerhouse:  'Global Powerhouse',
};

const TIER_NEXT_GOAL: Record<string, string> = {
  indieStudio:      'Release 1 film and reach Heat 25 to advance',
  establishedIndie: 'Release 3 films and reach Heat 45 to advance',
  midTier:          'Release 6 films and reach Heat 65 to advance',
  majorStudio:      'Release 10 films and reach Heat 80 to advance',
  globalPowerhouse: 'You have reached the summit.',
};

const ARC_LABELS: Record<string, string> = {
  'awards-circuit':        'Awards Run',
  'exhibitor-power-play':  'Exhibitor Power Play',
  'exhibitor-war':         'Theater Access Battle',
  'financier-control':     'Investor Pressure',
  'franchise-pivot':       'Universe Gamble',
  'leak-piracy':           'Leak Fallout',
  'talent-meltdown':       'Volatile Star Cycle',
  'passion-project':       "The Director's Vision",
};

const CHRONICLE_ICONS: Record<string, string> = {
  filmRelease:    '🎬',
  arcResolution:  '⭐',
  tierAdvance:    '📈',
  awardsOutcome:  '🏆',
  festivalOutcome:'🎪',
  crisisResolved: '🔧',
};

const SPECIALIZATION_OPTIONS: { key: 'balanced' | 'blockbuster' | 'prestige' | 'indie'; label: string }[] = [
  { key: 'balanced',    label: 'Balanced'    },
  { key: 'blockbuster', label: 'Blockbuster' },
  { key: 'prestige',    label: 'Prestige'    },
  { key: 'indie',       label: 'Indie'       },
];

const PARTNER_OPTIONS = ['Aster Peak Pictures', 'Silverline Distribution', 'Constellation Media'];

function stanceLabel(value: string): string {
  if (value === 'hostile')     return 'Hostile';
  if (value === 'competitive') return 'Competitive';
  if (value === 'respectful')  return 'Respectful';
  return 'Neutral';
}

function stanceColor(value: string): string {
  if (value === 'hostile')     return colors.accentRed;
  if (value === 'competitive') return colors.goldMid;
  if (value === 'respectful')  return colors.accentTeal;
  return colors.textMuted;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  } = useGame();

  const reveal        = manager.getNextReleaseReveal();
  const isFinalReveal = !!reveal && manager.isFinalReleaseReveal(reveal.id);
  const revealReport  = reveal ? manager.getLatestReleaseReport(reveal.id) : null;
  const splashTone    = getReleaseSplashTone(revealReport);
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

  const anim = useRef(new Animated.Value(0)).current;
  const [studioNameDraft, setStudioNameDraft] = useState(manager.studioName);

  useEffect(() => {
    if (!reveal) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue:          1,
      duration:         380,
      easing:           Easing.out(Easing.cubic),
      useNativeDriver:  true,
    }).start();
  }, [anim, reveal]);

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

      {/* ── Tutorial ── */}
      {!manager.firstSessionComplete && (
        <GlassCard variant="teal">
          <SectionLabel label="Getting Started" />
          {[
            'Inbox decisions expire — resolve them within the listed weeks or lose the opportunity.',
            'Projects need a director + lead actor + script quality ≥ 6.0 to advance to Pre-Production.',
            'End Turn advances time. Crises must be cleared first. Each turn costs cash from production burn.',
            'Reputation has four pillars: Critics, Talent, Distributor, and Audience. Each is affected differently.',
          ].map((tip, i) => (
            <Text key={i} style={[styles.body, { color: colors.accentTeal }]}>· {tip}</Text>
          ))}
        </GlassCard>
      )}

      {/* ── Weekly Status ── */}
      <GlassCard style={{ gap: spacing.sp2 }}>
        <SectionLabel label="Weekly Status" />
        <View style={styles.statusRow}>
          <GlassCard variant="elevated" style={styles.statusTile}>
            <MetricTile
              value={manager.currentWeek}
              label="Week"
              size="sm"
            />
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
            <MetricTile
              value={manager.activeProjects.length}
              label="Projects"
              size="sm"
            />
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
          <MetricTile value={money(manager.cash)}        label="Cash"         size="sm" />
          <MetricTile value={money(weeklyExpenses)}      label="Weekly Burn"  size="sm" accent={colors.accentRed} />
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

      {/* ── Blocking Crises ── */}
      {manager.pendingCrises.length > 0 && (
        <GlassCard variant="red">
          <SectionLabel label={`Blocking Crises (${manager.pendingCrises.length})`} />
          {manager.pendingCrises.map((crisis) => (
            <GlassCard key={crisis.id} variant="elevated" style={{ gap: spacing.sp2, borderColor: colors.borderRed }}>
              <Text style={styles.muted}>
                Affects: {manager.activeProjects.find((p) => p.id === crisis.projectId)?.title ?? 'Unknown project'}
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

      {/* ── Decision Inbox ── */}
      <GlassCard style={{ gap: spacing.sp2 }}>
        <SectionLabel label="Decision Inbox" />
        {manager.decisionQueue.length === 0
          ? <Text style={styles.muted}>No active decisions right now.</Text>
          : manager.decisionQueue.map((item) => (
            <GlassCard key={item.id} variant="elevated" style={{ gap: spacing.sp2 }}>
              <View style={styles.inboxHeader}>
                <Text style={styles.muted}>
                  {item.projectId
                    ? manager.activeProjects.find((p) => p.id === item.projectId)?.title ?? 'Unknown project'
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

      {/* ── Operations Capacity ── */}
      <GlassCard>
        <SectionLabel label="Operations Capacity" />
        <View style={styles.capRow}>
          <MetricTile value={`L${manager.marketingTeamLevel}`} label="Marketing" size="sm" />
          <MetricTile value={`${manager.projectCapacityUsed}/${manager.projectCapacityLimit}`} label="Capacity"  size="sm" />
          <MetricTile value={`L${manager.executiveNetworkLevel}`} label="Exec Network" size="sm" />
        </View>
        <ProgressBar
          value={(manager.projectCapacityUsed / manager.projectCapacityLimit) * 100}
          color={manager.projectCapacityUsed >= manager.projectCapacityLimit ? colors.accentRed : colors.accentTeal}
          height={4}
          animated
        />
        <View style={styles.actionsRow}>
          <PremiumButton label="Upgrade Marketing" onPress={upgradeMarketingTeam}   disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
          <PremiumButton label="Expand Capacity"   onPress={upgradeStudioCapacity}  disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
        </View>
      </GlassCard>

      {/* ── Studio Identity ── */}
      <GlassCard>
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

        <SectionLabel label="Specialization" style={{ marginTop: spacing.sp2 }} />
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

        <SectionLabel label="Departments" style={{ marginTop: spacing.sp2 }} />
        <Text style={styles.muted}>
          Dev L{manager.departmentLevels.development} · Prod L{manager.departmentLevels.production} · Dist L{manager.departmentLevels.distribution}
        </Text>
        <View style={styles.actionsRow}>
          <PremiumButton label="Invest Dev"    onPress={() => investDepartment('development')} disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
          <PremiumButton label="Invest Prod"   onPress={() => investDepartment('production')}  disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
          <PremiumButton label="Invest Dist"   onPress={() => investDepartment('distribution')} disabled={isGameOver} variant="secondary" size="sm" style={styles.flexBtn} />
        </View>
      </GlassCard>

      {/* ── Strategic Levers ── */}
      <GlassCard>
        <SectionLabel label="Strategic Levers" />
        <Text style={styles.body}>
          Exclusive Partner: <Text style={{ color: colors.goldMid }}>{manager.getActiveExclusivePartner() ?? 'None'}</Text>
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
      </GlassCard>

      {/* ── Turn Length ── */}
      <GlassCard>
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
      </GlassCard>

      {/* ── Story Arcs ── */}
      <GlassCard>
        <SectionLabel label={`Story Arcs${activeArcCount > 0 ? ` · ${activeArcCount} Active` : ''}`} />
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
      </GlassCard>

      {/* ── Industry Heat Leaderboard ── */}
      <GlassCard>
        <SectionLabel label="Industry Heat Leaderboard" />
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
      </GlassCard>

      {/* ── Rival Relations ── */}
      <GlassCard>
        <SectionLabel label="Rival Relations" />
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
      </GlassCard>

      {/* ── Awards Pulse ── */}
      <GlassCard>
        <SectionLabel label="Awards Pulse" />
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
      </GlassCard>

      {/* ── Genre Cycles ── */}
      <GlassCard>
        <SectionLabel label="Genre Cycles" />
        <Text style={[styles.muted, { color: colors.accentTeal, fontFamily: typography.fontBodySemiBold }]}>↑ Heating</Text>
        {hotGenres.map((entry) => (
          <View key={`hot-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{entry.genre}</Text>
            <Text style={[styles.muted, { color: colors.accentTeal }]}>
              {entry.demand.toFixed(2)}× ({entry.momentum >= 0 ? '+' : ''}{Math.round(entry.momentum * 1000) / 10}%)
            </Text>
          </View>
        ))}
        <Text style={[styles.muted, { color: colors.accentRed, fontFamily: typography.fontBodySemiBold, marginTop: 4 }]}>↓ Cooling</Text>
        {coolGenres.map((entry) => (
          <View key={`cool-${entry.genre}`} style={styles.leaderRow}>
            <Text style={styles.body}>{entry.genre}</Text>
            <Text style={[styles.muted, { color: colors.accentRed }]}>
              {entry.demand.toFixed(2)}× ({entry.momentum >= 0 ? '+' : ''}{Math.round(entry.momentum * 1000) / 10}%)
            </Text>
          </View>
        ))}
      </GlassCard>

      {/* ── Milestones ── */}
      <GlassCard>
        <SectionLabel label="Milestones" />
        {milestones.length === 0
          ? <Text style={styles.muted}>No milestones unlocked yet.</Text>
          : milestones.map((milestone) => (
            <View key={`${milestone.id}-${milestone.unlockedWeek}`} style={styles.leaderRow}>
              <Text style={styles.bodyStrong}>🏅 {milestone.title}</Text>
              <Text style={styles.muted}>W{milestone.unlockedWeek}</Text>
            </View>
          ))
        }
      </GlassCard>

      {/* ── Studio Chronicle ── */}
      <GlassCard>
        <SectionLabel label="Studio Chronicle" />
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
      </GlassCard>

      {/* ── Industry News ── */}
      <GlassCard>
        <SectionLabel label="Industry News" />
        {news.length === 0
          ? <Text style={styles.muted}>No major rival movement yet.</Text>
          : news.map((item) => (
            <Text key={item.id} style={styles.muted}>W{item.week}: {item.headline}</Text>
          ))
        }
      </GlassCard>

      {/* ── Last Week Summary ── */}
      {manager.lastWeekSummary && (
        <GlassCard>
          <SectionLabel label="Last Week Summary" />
          <Text style={[styles.body, { color: manager.lastWeekSummary.cashDelta >= 0 ? colors.accentTeal : colors.accentRed }]}>
            Cash {signedMoney(manager.lastWeekSummary.cashDelta)}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.muted}>· {event}</Text>
          ))}
        </GlassCard>
      )}

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
      <Modal
        visible={!!reveal}
        transparent
        animationType="none"
        onRequestClose={() => reveal && dismissReleaseReveal(reveal.id)}
      >
        <BlurView intensity={blur.modal} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalDimLayer} />
          {reveal && (
            <Animated.View
              style={[
                styles.modalContent,
                {
                  opacity: anim,
                  transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                    { scale:      anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                  ],
                },
              ]}
            >
              {/* Gradient top band based on outcome */}
              {isFinalReveal && revealReport && (
                <LinearGradient
                  colors={[splashGradientColor(splashTone), 'transparent']}
                  style={styles.modalTopBand}
                  pointerEvents="none"
                />
              )}

              <Text style={styles.modalLabel}>
                {isFinalReveal ? 'Final Box Office Report' : 'Opening Weekend Reveal'}
              </Text>
              <Text style={styles.modalFilmTitle}>{reveal.title}</Text>

              {isFinalReveal && revealReport ? (
                <>
                  <OutcomeBadge outcome={splashToneToOutcome(splashTone)} size="md" style={styles.outcomeBadge} />

                  <View style={styles.modalStatsGrid}>
                    <MetricTile value={money(revealReport.totalGross)} label="Total Gross"  size="md" centered />
                    <MetricTile value={money(revealReport.studioNet)}  label="Studio Net"   size="md" centered accent={colors.accentTeal} />
                  </View>
                  <View style={styles.modalStatsGrid}>
                    <MetricTile value={money(revealReport.profit)}    label="Profit / Loss" size="sm" centered accent={revealReport.profit >= 0 ? colors.accentTeal : colors.accentRed} />
                    <MetricTile value={`${revealReport.roi.toFixed(2)}×`} label="ROI"       size="sm" centered accent={revealReport.roi >= 2 ? colors.accentTeal : revealReport.roi < 1 ? colors.accentRed : colors.goldMid} />
                  </View>

                  {revealReport.wasRecordOpening && (
                    <Text style={styles.recordLine}>🏆 New studio opening-weekend record</Text>
                  )}

                  {/* Performance drivers */}
                  <GlassCard variant="elevated" style={{ gap: spacing.sp2 }}>
                    <SectionLabel label="Performance Drivers" />
                    {[
                      { key: 'Script',     val: revealReport.breakdown.script     },
                      { key: 'Direction',  val: revealReport.breakdown.direction  },
                      { key: 'Star Power', val: revealReport.breakdown.starPower  },
                      { key: 'Marketing',  val: revealReport.breakdown.marketing  },
                      { key: 'Timing',     val: revealReport.breakdown.timing     },
                      { key: 'Genre Cycle',val: revealReport.breakdown.genreCycle },
                    ].map(({ key, val }) => (
                      <View key={key} style={styles.driverRow}>
                        <Text style={styles.driverLabel}>{key}</Text>
                        <ProgressBar
                          value={50 + val}
                          color={val >= 0 ? colors.accentTeal : colors.accentRed}
                          height={5}
                          style={styles.driverBar}
                        />
                        <Text style={[styles.driverVal, { color: val >= 0 ? colors.accentTeal : colors.accentRed }]}>
                          {val >= 0 ? '+' : ''}{val}
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                </>
              ) : (
                <>
                  <View style={styles.modalStatsGrid}>
                    <MetricTile value={money(reveal.openingWeekendGross ?? 0)} label="Opening Weekend" size="md" centered />
                  </View>
                  <View style={styles.modalStatsGrid}>
                    <MetricTile value={reveal.criticalScore?.toFixed(0) ?? '--'} label="Critics"  size="sm" centered accent={colors.accentTeal} />
                    <MetricTile value={reveal.audienceScore?.toFixed(0)  ?? '--'} label="Audience" size="sm" centered accent={colors.goldMid} />
                    <MetricTile value={`${reveal.releaseWeeksRemaining}w`}        label="Forecast" size="sm" centered />
                  </View>
                  <Text style={styles.muted}>Partner: {reveal.distributionPartner ?? 'Pending'}</Text>
                </>
              )}

              <PremiumButton
                label="Continue"
                onPress={() => dismissReleaseReveal(reveal.id)}
                variant="primary"
                size="lg"
                fullWidth
                style={{ marginTop: spacing.sp2 }}
              />
            </Animated.View>
          )}
        </BlurView>
      </Modal>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp4, gap: spacing.sp3, paddingBottom: 120 },

  // Header
  header:     { gap: 3, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  studioName: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  weekLine:   { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentTeal },
  body:    { fontFamily: typography.fontBody,        fontSize: typography.sizeSM, color: colors.textSecondary },
  bodyStrong: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  muted:   { fontFamily: typography.fontBody,        fontSize: typography.sizeXS, color: colors.textMuted },
  alert:   { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.accentRed },

  // Weekly status
  statusRow: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp1 },
  statusTile: { flex: 1, paddingVertical: spacing.sp2, paddingHorizontal: spacing.sp1 },
  cashRow:   { flexDirection: 'row', gap: spacing.sp3 },

  // Studio standing
  standingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sp2 },
  tierName:       { fontFamily: typography.fontDisplay, fontSize: typography.sizeLG, color: colors.textPrimary, letterSpacing: typography.trackingTight, marginTop: 2 },
  heatBadge:      { alignItems: 'center', gap: 1 },
  heatValue:      { fontFamily: typography.fontDisplay, fontSize: typography.sizeXL, color: colors.goldMid, letterSpacing: typography.trackingTight },
  heatLabel:      { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest },

  // Decision inbox
  inboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expiryPill:  { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  expiryText:  { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },

  // Option buttons (decisions / crises)
  optionGroup: { gap: spacing.sp2, marginTop: spacing.sp1 },
  optionBtn:   {
    borderRadius:    radius.r2,
    borderWidth:     1,
    borderColor:     colors.borderDefault,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding:         spacing.sp2 + 2,
    gap:             3,
  },
  optionTitle: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  optionBody:  { fontFamily: typography.fontBody,          fontSize: typography.sizeXS, color: colors.textMuted },

  // Operations
  capRow:     { flexDirection: 'row', gap: spacing.sp3, marginTop: spacing.sp1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp2 },
  flexBtn:    { flex: 1 },

  // Studio identity
  input: {
    borderRadius:    radius.r2,
    borderWidth:     1,
    borderColor:     colors.borderDefault,
    backgroundColor: colors.bgElevated,
    color:           colors.textPrimary,
    fontFamily:      typography.fontBody,
    paddingHorizontal: spacing.sp3,
    paddingVertical:   spacing.sp2,
    fontSize:          typography.sizeSM,
  },

  // Turn length
  turnBtn: {
    flex: 1,
    borderRadius:    radius.r2,
    borderWidth:     1,
    borderColor:     colors.borderDefault,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding:         spacing.sp2 + 2,
    gap:             3,
  },
  turnBtnActive: {
    borderColor:     colors.borderGold,
    backgroundColor: 'rgba(212,168,67,0.10)',
  },

  // Arcs
  arcRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arcBadge:  { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  arcStatus: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.6 },

  // Leaderboard / rows
  leaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },

  // Chronicle
  chronicleEntry:   { flexDirection: 'row', gap: spacing.sp2, alignItems: 'flex-start', paddingVertical: 3 },
  chronicleWeek:    { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.textMuted, minWidth: 40 },
  chronicleHeadline:{ fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeSM, color: colors.textPrimary, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,10,15,0.55)' },
  modalContent: {
    width:           '100%',
    maxWidth:        480,
    borderRadius:    radius.r4,
    borderWidth:     1,
    borderColor:     colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding:         spacing.sp5,
    gap:             spacing.sp3,
    overflow:        'hidden',
    margin:          spacing.sp4,
  },
  modalTopBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  modalLabel: {
    fontFamily:    typography.fontBodySemiBold,
    fontSize:      typography.sizeXS,
    color:         colors.goldMid,
    textTransform: 'uppercase',
    letterSpacing: typography.trackingWidest,
  },
  modalFilmTitle: {
    fontFamily:    typography.fontDisplay,
    fontSize:      typography.sizeXL,
    color:         colors.textPrimary,
    letterSpacing: typography.trackingTight,
  },
  outcomeBadge:    { alignSelf: 'flex-start' },
  modalStatsGrid:  { flexDirection: 'row', gap: spacing.sp4 },
  recordLine:      { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.goldMid },
  driverRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  driverLabel:     { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, width: 72 },
  driverBar:       { flex: 1 },
  driverVal:       { fontFamily: typography.fontBodyBold, fontSize: typography.sizeXS, width: 28, textAlign: 'right' },
});
