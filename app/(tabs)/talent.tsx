import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { GlassCard, PremiumButton, ProgressBar, SectionLabel, StarRating } from '@/src/ui/components';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, Talent } from '@/src/domain/types';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function chanceLabel(value: number): string {
  if (value >= 0.75) return 'Likely';
  if (value >= 0.5) return 'Even Odds';
  return 'Long Shot';
}

function chanceColor(value: number): string {
  if (value >= 0.75) return colors.accentGreen;
  if (value >= 0.5) return colors.goldMid;
  return colors.accentRed;
}

function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function phaseLabel(phase: string): string {
  return phase
    .replace(/([A-Z])/g, '-$1')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

function roleLabel(value: string): string {
  if (value === 'leadActor') return 'Lead Actor';
  if (value === 'supportingActor') return 'Supporting Actor';
  return value;
}

function agencyLabel(agentTier: string): string {
  if (agentTier === 'aea') return 'AEA';
  if (agentTier === 'wma') return 'WMA';
  if (agentTier === 'tca') return 'TCA';
  return 'IND';
}

function trustLevelLabel(value: string): string {
  if (value === 'hostile') return 'Hostile';
  if (value === 'wary') return 'Wary';
  if (value === 'aligned') return 'Aligned';
  if (value === 'loyal') return 'Loyal';
  return 'Neutral';
}

function trustLevelColor(value: string): string {
  if (value === 'hostile') return colors.accentRed;
  if (value === 'wary') return colors.goldMid;
  if (value === 'aligned') return colors.accentGreen;
  if (value === 'loyal') return colors.accentGreen;
  return colors.textMuted;
}

function refusalRiskColor(value: string): string {
  if (value === 'critical') return colors.accentRed;
  if (value === 'elevated') return colors.goldMid;
  return colors.accentGreen;
}

function interactionLabel(kind: string): string {
  const map: Record<string, string> = {
    negotiationOpened: 'Opened negotiation',
    negotiationSweetened: 'Sweetened terms',
    negotiationHardline: 'Held hard line',
    negotiationDeclined: 'Declined terms',
    quickCloseFailed: 'Quick-close failed',
    quickCloseSuccess: 'Quick-close success',
    dealSigned: 'Deal signed',
    dealStalled: 'Deal stalled',
    projectReleased: 'Project released',
    projectAbandoned: 'Project abandoned',
    poachedByRival: 'Poached by rival',
    counterPoachWon: 'Counter-poach won',
    counterPoachLost: 'Counter-poach lost',
  };
  return map[kind] ?? 'Interaction';
}

export default function TalentScreen() {
  const { manager, startNegotiation, adjustNegotiation, attachTalent, lastMessage } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      startNegotiation: state.startNegotiation,
      adjustNegotiation: state.adjustNegotiation,
      attachTalent: state.attachTalent,
      lastMessage: state.lastMessage,
      projectsSignature: mgr.activeProjects
        .filter((p) => p.phase === 'development')
        .map(
          (p) =>
            `${p.id}:${p.title}:${p.genre}:${p.scriptQuality}:${p.directorId ?? 'none'}:${p.castIds.join(',')}:${p.hypeScore}:` +
            `${p.budget.actualSpend}`
        )
        .join('|'),
      talentSignature: mgr.talentPool
        .map((t) => {
          const memory = t.relationshipMemory;
          const trust = memory?.trust ?? -1;
          const loyalty = memory?.loyalty ?? -1;
          const memoryTail = (memory?.interactionHistory ?? [])
            .slice(-3)
            .map((entry) => `${entry.week}:${entry.kind}:${entry.trustDelta}:${entry.loyaltyDelta}:${entry.projectId ?? 'none'}`)
            .join(',');
          return (
            `${t.id}:${t.role}:${t.availability}:${t.attachedProjectId ?? 'none'}:${t.unavailableUntilWeek ?? -1}:` +
            `${t.marketWindowExpiresWeek ?? -1}:${t.starPower}:${t.craftScore}:${t.egoLevel}:${t.agentTier}:${t.reputation}:${t.studioRelationship}:${trust}:${loyalty}:` +
            `${memoryTail}:${Object.entries(t.genreFit).map(([genre, fit]) => `${genre}:${fit}`).join(',')}`
          );
        })
        .join('|'),
      negotiationSignature: mgr.playerNegotiations
        .map(
          (n) =>
            `${n.talentId}:${n.projectId}:${n.rounds ?? 0}:${n.holdLineCount ?? 0}:${n.offerSalaryMultiplier ?? -1}:` +
            `${n.offerBackendPoints ?? -1}:${n.offerPerksBudget ?? -1}`
        )
        .join('|'),
      rivalsSignature: mgr.rivals
        .map(
          (r) =>
            `${r.id}:${r.studioHeat}:${r.lockedTalentIds.join(',')}:${r.memory.hostility}:${r.memory.respect}:` +
            `${r.memory.retaliationBias}:${r.memory.cooperationBias}`
        )
        .join('|'),
      talentChanceContext: `${mgr.reputation.talent}:${mgr.executiveNetworkLevel}:${mgr.studioSpecialization}`,
    };
  }));

  const developmentProjects = manager.activeProjects.filter((p) => p.phase === 'development');
  const developmentProjectIds = developmentProjects.map((p) => p.id).join('|');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(developmentProjects[0]?.id ?? null);
  const [showHelp, setShowHelp] = useState(false);
  const [compactView, setCompactView] = useState(true);
  const [showOpsPanels, setShowOpsPanels] = useState(false);

  const activeProject = selectedProjectId
    ? developmentProjects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  const projectLedger = manager.activeProjects.filter((p) => p.phase !== 'released');

  // Market: available talents with an active window, sorted directors first then by starPower desc
  const marketTalent: Talent[] = manager.talentPool
    .filter((t) => t.marketWindowExpiresWeek !== null && t.availability === 'available')
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
      return b.starPower - a.starPower;
    });

  // Roster: talents attached to your projects or in negotiation
  const negotiatingIds = new Set(manager.playerNegotiations.map((n) => n.talentId));
  const rosterTalent: Talent[] = manager.talentPool
    .filter((t) => t.attachedProjectId !== null || negotiatingIds.has(t.id))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
      return b.starPower - a.starPower;
    });

  const marketDirectorCount = marketTalent.filter((t) => t.role === 'director').length;
  const marketActorCount = marketTalent.filter((t) => t.role === 'leadActor').length;
  const marketDirectors = marketTalent.filter((t) => t.role === 'director');
  const marketActors = marketTalent.filter((t) => t.role === 'leadActor');
  const rosterDirectors = rosterTalent.filter((t) => t.role === 'director');
  const rosterActors = rosterTalent.filter((t) => t.role === 'leadActor');
  const rivalLockedCount = manager.talentPool.filter((t) => manager.rivals.some((r) => r.lockedTalentIds.includes(t.id))).length;
  const coolingOffCount = manager.talentPool.filter((t) => manager.getTalentNegotiationOutlook(t).blocked).length;

  useEffect(() => {
    const stillValid = !!selectedProjectId && developmentProjects.some((p) => p.id === selectedProjectId);
    if (stillValid) return;
    const fallback = developmentProjects[0]?.id ?? null;
    if (fallback !== selectedProjectId) {
      setSelectedProjectId(fallback);
    }
  }, [developmentProjectIds, selectedProjectId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.goldDeep + '15', 'transparent']}
          style={styles.headerGlow}
          pointerEvents="none"
        />
        <Text style={styles.title}>Talent Market</Text>
        <Text style={styles.subtitle}>Talent rotates weekly — negotiate before the window closes</Text>
      </View>

      {lastMessage ? (
        <GlassCard variant="blue">
          <Text style={styles.message}>{lastMessage}</Text>
        </GlassCard>
      ) : null}

      {/* ── Help ── */}
      <PremiumButton
        label={showHelp ? 'Hide Help' : 'Show Help'}
        onPress={() => setShowHelp((v) => !v)}
        variant="ghost"
        size="sm"
      />
      <View style={styles.topControls}>
        <PremiumButton
          label={compactView ? 'Compact View' : 'Expanded View'}
          onPress={() => setCompactView((v) => !v)}
          variant={compactView ? 'primary' : 'secondary'}
          size="sm"
          style={styles.controlBtn}
        />
        <PremiumButton
          label={showOpsPanels ? 'Hide Ops Panels' : 'Show Ops Panels'}
          onPress={() => setShowOpsPanels((v) => !v)}
          variant="secondary"
          size="sm"
          style={styles.controlBtn}
        />
      </View>
      {showHelp && (
        <GlassCard variant="elevated">
          <Text style={styles.helpTitle}>How the Market Works</Text>
          <Text style={styles.helpBody}>A rotating pool of talent appears each week. Lower-tier talent stays 6 weeks; elite talent stays only 3 weeks. New faces trickle in every turn to replace expired windows.</Text>
          <Text style={styles.helpBody}>Higher-star talent only appears once your studio heat or talent reputation reaches their threshold. Build your rep to unlock elite talent.</Text>
          <Text style={styles.helpBody}>Push the highlighted pressure point first to raise close chance fastest. Trust and loyalty influence future negotiations.</Text>
          <Text style={styles.helpBody}>
            <Text style={{ color: colors.goldMid, fontFamily: typography.fontBodySemiBold }}>Star</Text>
            {' = audience draw and launch heat. '}
            <Text style={{ color: colors.accentGreen, fontFamily: typography.fontBodySemiBold }}>Craft</Text>
            {' = execution quality and critic stability.'}
          </Text>
        </GlassCard>
      )}

      {/* ── Market Snapshot ── */}
      <GlassCard>
        <SectionLabel label="Market Snapshot" />
        <View style={styles.snapshotRow}>
          {[
            { label: 'Directors', value: marketDirectorCount, accent: colors.ctaBlue },
            { label: 'Actors', value: marketActorCount, accent: colors.accentGreen },
            { label: 'Negotiations', value: manager.playerNegotiations.length, accent: colors.goldMid },
            { label: 'Rival Lock', value: rivalLockedCount, accent: colors.accentRed },
            { label: 'Cooling Off', value: coolingOffCount, accent: colors.textMuted },
          ].map(({ label, value, accent }) => (
            <GlassCard key={label} variant="elevated" style={styles.snapshotTile}>
              <Text style={[styles.snapshotValue, { color: accent }]}>{value}</Text>
              <Text style={styles.snapshotLabel}>{label}</Text>
            </GlassCard>
          ))}
        </View>
      </GlassCard>

      {/* ── Development Targets ── */}
      <GlassCard>
        <SectionLabel label="Development Targets" />
        {developmentProjects.length === 0
          ? <Text style={styles.empty}>No development-phase project available for attachment right now.</Text>
          : <View style={styles.targetRow}>
            {developmentProjects.map((project) => (
              <PremiumButton
                key={project.id}
                label={`${project.title} (${capitalized(project.genre)})`}
                onPress={() => setSelectedProjectId(project.id)}
                variant={selectedProjectId === project.id ? 'primary' : 'secondary'}
                size="sm"
              />
            ))}
          </View>
        }
      </GlassCard>

      {/* ── Active Target ── */}
      {activeProject && (
        <GlassCard variant="gold">
          <SectionLabel label="Active Target" />
          <Text style={styles.activeTitle}>{activeProject.title}</Text>
          <Text style={styles.body}>{capitalized(activeProject.genre)} · {phaseLabel(activeProject.phase)}</Text>
          <Text style={styles.muted}>
            Director:{' '}
            {activeProject.directorId
              ? manager.talentPool.find((t) => t.id === activeProject.directorId)?.name ?? 'Unknown'
              : 'Unattached'}
          </Text>
          <Text style={styles.muted}>
            Cast:{' '}
            {activeProject.castIds.length > 0
              ? activeProject.castIds
                .map((id) => manager.talentPool.find((t) => t.id === id)?.name)
                .filter((v): v is string => !!v)
                .join(', ')
              : 'None attached'}
          </Text>
        </GlassCard>
      )}

      {showOpsPanels && (
        <>
          {/* ── Project Ledger ── */}
          <GlassCard>
            <SectionLabel label="Project Ledger" />
            {projectLedger.length === 0
              ? <Text style={styles.empty}>No active projects.</Text>
              : projectLedger.map((project) => {
                const director = project.directorId
                  ? manager.talentPool.find((t) => t.id === project.directorId)?.name ?? 'Unknown'
                  : 'Unattached';
                const cast = project.castIds
                  .map((id) => manager.talentPool.find((t) => t.id === id)?.name)
                  .filter((v): v is string => !!v);
                return (
                  <GlassCard key={project.id} variant="elevated" style={{ gap: 4 }}>
                    <Text style={styles.subTitle}>{project.title}</Text>
                    <Text style={styles.muted}>{capitalized(project.genre)} · {phaseLabel(project.phase)}</Text>
                    <Text style={styles.muted}>Director: {director}</Text>
                    {cast.length > 0 && <Text style={styles.muted}>Cast: {cast.join(', ')}</Text>}
                  </GlassCard>
                );
              })
            }
          </GlassCard>

          {/* ── Open Negotiations ── */}
          <GlassCard>
            <SectionLabel label="Open Negotiations" />
            {manager.playerNegotiations.length === 0
              ? <Text style={styles.empty}>No open negotiations.</Text>
              : manager.playerNegotiations.map((entry) => {
                const talent = manager.talentPool.find((t) => t.id === entry.talentId);
                const project = manager.activeProjects.find((p) => p.id === entry.projectId);
                const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
                const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
                return (
                  <GlassCard key={`${entry.projectId}-${entry.talentId}`} variant="elevated" style={{ gap: spacing.sp2 }}>
                    <View style={styles.negHeader}>
                      <Text style={styles.subTitle}>{talent?.name ?? 'Talent'}</Text>
                      {chance !== null && (
                        <View style={[styles.chancePill, { borderColor: chanceColor(chance) + '60', backgroundColor: chanceColor(chance) + '14' }]}>
                          <Text style={[styles.chanceText, { color: chanceColor(chance) }]}>
                            {pct(chance)} · {chanceLabel(chance)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.muted}>
                      {project?.title} · opened W{entry.openedWeek} · resolves on End Turn
                    </Text>

                    {snapshot && (
                      <>
                        <Text style={styles.muted}>
                          Rounds {snapshot.rounds}/4 · Pressure: {capitalized(snapshot.pressurePoint)}
                        </Text>
                        <View style={styles.offerRow}>
                          <GlassCard variant="default" style={styles.offerCol}>
                            <Text style={styles.offerLabel}>YOUR OFFER</Text>
                            <Text style={styles.offerVal}>{snapshot.salaryMultiplier.toFixed(2)}× Salary</Text>
                            <Text style={styles.offerVal}>{snapshot.backendPoints.toFixed(1)}pt Backend</Text>
                          </GlassCard>
                          <GlassCard variant="default" style={styles.offerCol}>
                            <Text style={styles.offerLabel}>THEIR ASK</Text>
                            <Text style={styles.offerVal}>{snapshot.demandSalaryMultiplier.toFixed(2)}× Salary</Text>
                            <Text style={styles.offerVal}>{snapshot.demandBackendPoints.toFixed(1)}pt Backend</Text>
                          </GlassCard>
                        </View>
                        <Text style={[styles.signal, { color: colors.goldMid }]}>{snapshot.signal}</Text>
                        <Text style={styles.muted}>
                          Counter impact: Salary +${Math.round(snapshot.sweetenSalaryRetainerDelta).toLocaleString()} retainer | Backend -{snapshot.sweetenBackendShareDeltaPct.toFixed(1)}% share | Perks +${Math.round(snapshot.sweetenPerksRetainerDelta).toLocaleString()} retainer
                        </Text>
                        <View style={styles.actions}>
                          {[
                            { label: '+Salary', action: 'sweetenSalary', pressure: 'salary' },
                            { label: '+Backend', action: 'sweetenBackend', pressure: 'backend' },
                            { label: '+Perks', action: 'sweetenPerks', pressure: 'perks' },
                            { label: 'Hold', action: 'holdFirm', pressure: null },
                          ].map(({ label, action, pressure }) => (
                            <PremiumButton
                              key={action}
                              label={label}
                              onPress={() => adjustNegotiation(entry.projectId, entry.talentId, action as any)}
                              variant={pressure === snapshot.pressurePoint ? 'primary' : 'secondary'}
                              size="sm"
                              style={styles.negBtn}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </GlassCard>
                );
              })
            }
          </GlassCard>
        </>
      )}

      {/* ── Directors In Market ── */}
      <View style={styles.roleHeaderDirector}>
        <Text style={styles.roleHeaderText}>DIRECTORS IN MARKET</Text>
        <Text style={styles.roleHeaderCount}>{marketDirectors.length}</Text>
      </View>
      {marketTalent.length === 0
        ? (
          <GlassCard variant="elevated">
            <Text style={styles.empty}>Market is initializing — advance a turn to populate talent windows.</Text>
          </GlassCard>
        )
        : marketDirectors.map((talent) => <TalentCard
          key={talent.id}
          talent={talent}
          manager={manager}
          activeProject={activeProject}
          startNegotiation={startNegotiation}
          attachTalent={attachTalent}
          showCountdown
          compact={compactView}
        />)
      }

      {/* ── Actors In Market ── */}
      <View style={styles.roleHeaderActor}>
        <Text style={styles.roleHeaderText}>ACTORS IN MARKET</Text>
        <Text style={styles.roleHeaderCount}>{marketActors.length}</Text>
      </View>
      {marketActors.map((talent) => <TalentCard
        key={talent.id}
        talent={talent}
        manager={manager}
        activeProject={activeProject}
        startNegotiation={startNegotiation}
        attachTalent={attachTalent}
        showCountdown
        compact={compactView}
      />)}

      {/* ── Your Roster ── */}
      {rosterTalent.length > 0 && (
        <>
          <View style={styles.roleHeaderRoster}>
            <Text style={styles.roleHeaderText}>YOUR ROSTER</Text>
            <Text style={styles.roleHeaderCount}>{rosterTalent.length}</Text>
          </View>
          {rosterDirectors.map((talent) => <TalentCard
            key={talent.id}
            talent={talent}
            manager={manager}
            activeProject={activeProject}
            startNegotiation={startNegotiation}
            attachTalent={attachTalent}
            showCountdown={false}
            compact={compactView}
          />)}
          {rosterActors.map((talent) => <TalentCard
            key={talent.id}
            talent={talent}
            manager={manager}
            activeProject={activeProject}
            startNegotiation={startNegotiation}
            attachTalent={attachTalent}
            showCountdown={false}
            compact={compactView}
          />)}
        </>
      )}
    </ScrollView>
  );
}

interface TalentCardProps {
  talent: Talent;
  manager: StudioManager;
  activeProject: MovieProject | null;
  startNegotiation: (projectId: string, talentId: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
  showCountdown: boolean;
  compact: boolean;
}

function TalentCard({ talent, manager, activeProject, startNegotiation, attachTalent, showCountdown, compact }: TalentCardProps) {
  const isAvailable = talent.availability === 'available';
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rival = manager.rivals.find((r) => r.lockedTalentIds.includes(talent.id));
  const attachedProject =
    talent.attachedProjectId && manager.activeProjects.find((p) => p.id === talent.attachedProjectId);
  const trustLevel = manager.getTalentTrustLevel(talent);
  const trust = talent.relationshipMemory?.trust ?? Math.round(talent.studioRelationship * 100);
  const loyalty = talent.relationshipMemory?.loyalty ?? Math.round(talent.studioRelationship * 100);
  const outlook = manager.getTalentNegotiationOutlook(talent);
  const targetChance = activeProject ? manager.getNegotiationChance(talent.id, activeProject.id) : null;
  const recentMemory = [...(talent.relationshipMemory?.interactionHistory ?? [])].slice(-3).reverse();
  const trustColor = trustLevelColor(trustLevel);

  const weeksLeft =
    showCountdown && talent.marketWindowExpiresWeek !== null
      ? Math.max(0, talent.marketWindowExpiresWeek - manager.currentWeek)
      : null;

  const windowUrgent = weeksLeft !== null && weeksLeft <= 1;
  const windowWarning = weeksLeft !== null && weeksLeft === 2;
  const showDetails = !compact || detailsOpen;

  return (
    <GlassCard
      variant={!isAvailable ? 'elevated' : 'default'}
      style={{ gap: compact ? spacing.sp1 : spacing.sp2, opacity: !isAvailable ? 0.82 : 1 }}
    >
      {/* Row 1: Name + window countdown */}
      <View style={styles.talentHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.talentName}>{talent.name}</Text>
          <Text style={styles.talentRole}>{roleLabel(talent.role)} · {agencyLabel(talent.agentTier)}</Text>
        </View>
        <View style={styles.badgeGroup}>
          {weeksLeft !== null && (
            <View style={[styles.windowChip, {
              borderColor: windowUrgent ? colors.accentRed + '70' : windowWarning ? colors.goldMid + '70' : colors.borderDefault,
              backgroundColor: windowUrgent ? colors.accentRed + '10' : windowWarning ? colors.goldMid + '10' : colors.bgElevated,
            }]}>
              <Text style={[styles.windowText, {
                color: windowUrgent ? colors.accentRed : windowWarning ? colors.goldMid : colors.textMuted,
              }]}>
                {weeksLeft === 0 ? 'Expires' : `${weeksLeft}w left`}
              </Text>
            </View>
          )}
          {!isAvailable && (
            <View style={[styles.availBadge, { borderColor: colors.textMuted + '40', backgroundColor: 'transparent' }]}>
              <Text style={[styles.availText, { color: colors.textMuted }]}>
                {rival ? `${rival.name}` : attachedProject ? 'On Set' : 'Locked'}
              </Text>
            </View>
          )}
          {compact && (
            <Pressable style={styles.detailsToggle} onPress={() => setDetailsOpen((v) => !v)}>
              <Text style={styles.detailsToggleText}>{detailsOpen ? 'Less' : 'Details'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Row 2: Star rating + craft bar */}
      <View style={[styles.statsRow, compact ? { gap: spacing.sp2 } : null]}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>STAR POWER</Text>
          <StarRating value={talent.starPower} size="md" />
          <Text style={[styles.statNum, { color: colors.goldMid }]}>{talent.starPower.toFixed(1)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>CRAFT</Text>
          <ProgressBar value={(talent.craftScore / 10) * 100} color={colors.accentGreen} height={6} animated />
          <Text style={[styles.statNum, { color: colors.accentGreen }]}>{talent.craftScore.toFixed(1)}</Text>
        </View>
      </View>

      {/* Row 3: Trust / loyalty */}
      {showDetails && (
        <View style={styles.trustRow}>
          <View style={[styles.trustBadge, { borderColor: trustColor + '50', backgroundColor: trustColor + '10' }]}>
            <Text style={[styles.trustText, { color: trustColor }]}>
              {trustLevelLabel(trustLevel)} · T{trust.toFixed(0)} L{loyalty.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.riskBadge, { borderColor: refusalRiskColor(outlook.refusalRisk) + '50' }]}>
            <Text style={[styles.riskText, { color: refusalRiskColor(outlook.refusalRisk) }]}>
              {outlook.refusalRisk === 'critical' ? 'High Risk' : outlook.refusalRisk === 'elevated' ? 'Med Risk' : 'Low Risk'}
            </Text>
          </View>
          {outlook.blocked && outlook.lockoutUntilWeek && (
            <Text style={styles.muted}>Cooling off until W{outlook.lockoutUntilWeek}</Text>
          )}
        </View>
      )}

      {showDetails && outlook.reason && (
        <Text style={[styles.alert, { color: colors.goldMid }]}>{outlook.reason}</Text>
      )}

      {activeProject && (
        <Text style={styles.muted}>
          Fit to <Text style={{ color: colors.textPrimary }}>{activeProject.title}</Text>:{' '}
          {pct(talent.genreFit[activeProject.genre] ?? 0.5)}
          {targetChance !== null && ` · Close ${pct(targetChance)}`}
        </Text>
      )}

      {attachedProject && (
        <Text style={styles.muted}>Attached: {attachedProject.title}</Text>
      )}

      {/* Recent memory */}
      {showDetails && recentMemory.length > 0 && (
        <View style={{ gap: 3 }}>
          <SectionLabel label="Recent Memory" />
          {recentMemory.map((entry, i) => (
            <Text key={`${talent.id}-${entry.week}-${i}`} style={styles.memoryLine}>
              W{entry.week}: {interactionLabel(entry.kind)}{' '}
              <Text style={{ color: entry.trustDelta >= 0 ? colors.accentGreen : colors.accentRed }}>
                ({entry.trustDelta >= 0 ? '+' : ''}{entry.trustDelta}T)
              </Text>
            </Text>
          ))}
        </View>
      )}

      {/* Rival / cooling status line */}
      {!isAvailable && rival && (
        <Text style={styles.muted}>{rival.name} · returns W{talent.unavailableUntilWeek ?? '-'}</Text>
      )}

      {/* Actions */}
      {activeProject && isAvailable && (
        <View style={styles.actions}>
          <PremiumButton
            label={`Negotiate · ${pct(manager.getNegotiationChance(talent.id, activeProject.id) ?? 0)}`}
            onPress={() => startNegotiation(activeProject.id, talent.id)}
            disabled={outlook.blocked}
            variant="gold-outline"
            size="sm"
            style={styles.flexBtn}
          />
          <PremiumButton
            label={`Quick Close · ${pct(manager.getQuickCloseChance(talent.id) ?? 0)}`}
            onPress={() => attachTalent(activeProject.id, talent.id)}
            disabled={outlook.blocked}
            variant="primary"
            size="sm"
            style={styles.flexBtn}
          />
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp4, paddingBottom: 120, gap: spacing.sp3 },

  header: { gap: 4, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  title: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subtitle: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted, marginTop: -2 },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentGreen },
  empty: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },
  body: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary, lineHeight: 20 },
  muted: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  alert: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },
  signal: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },

  helpTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary, marginBottom: 4 },
  helpBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  topControls: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap' },
  controlBtn: { flexBasis: '48%', flexGrow: 0 },

  snapshotRow: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp2, flexWrap: 'wrap' },
  snapshotTile: { minWidth: 56, alignItems: 'center', paddingVertical: spacing.sp2 },
  snapshotValue: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeLG, letterSpacing: typography.trackingTight },
  snapshotLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest, textTransform: 'uppercase' },

  targetRow: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },

  activeTitle: { fontFamily: typography.fontDisplay, fontSize: typography.sizeLG, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },

  // Negotiation
  negHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chancePill: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  chanceText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },
  offerRow: { flexDirection: 'row', gap: spacing.sp2 },
  offerCol: { flex: 1, gap: 3, padding: spacing.sp2 },
  offerLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest, textTransform: 'uppercase' },
  offerVal: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS, color: colors.textSecondary },
  roleHeaderDirector: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ctaBlue + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.ctaBlue + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderActor: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentGreen + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.accentGreen + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderRoster: {
    marginTop: spacing.sp2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.goldMid + '14',
    borderRadius: radius.r2,
    borderWidth: 1,
    borderColor: colors.goldMid + '40',
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp2,
  },
  roleHeaderText: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeXS,
    letterSpacing: typography.trackingWidest,
    color: colors.textPrimary,
  },
  roleHeaderCount: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeSM,
    color: colors.textPrimary,
  },

  // Talent card
  talentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sp2 },
  talentName: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeMD, color: colors.textPrimary },
  talentRole: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  badgeGroup: { flexDirection: 'row', gap: spacing.sp1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  windowChip: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  windowText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },
  availBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8 },
  availText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },

  statsRow: { flexDirection: 'row', gap: spacing.sp3 },
  statBlock: { flex: 1, gap: 3 },
  statLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest },
  statNum: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeXS },

  trustRow: { flexDirection: 'row', gap: spacing.sp2, alignItems: 'center', flexWrap: 'wrap' },
  trustBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  trustText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },
  riskBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'transparent' },
  riskText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },
  detailsToggle: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailsToggleText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },

  memoryLine: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },
  negBtn: { flex: 1, minWidth: 70 },
  flexBtn: { flex: 1 },
});
