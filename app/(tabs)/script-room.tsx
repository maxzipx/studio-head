import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function recommendationLabel(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return 'Strong Buy';
  if (value === 'conditional') return 'Conditional Buy';
  return 'Pass';
}

export default function ScriptRoomScreen() {
  const { manager, acquireScript, passScript, startNegotiation, adjustNegotiation, attachTalent, acquireIpRights, developFromIp, lastMessage } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      acquireScript: state.acquireScript,
      passScript: state.passScript,
      startNegotiation: state.startNegotiation,
      adjustNegotiation: state.adjustNegotiation,
      attachTalent: state.attachTalent,
      acquireIpRights: state.acquireIpRights,
      developFromIp: state.developFromIp,
      lastMessage: state.lastMessage,
      developmentSignature: mgr.activeProjects
        .filter((project) => project.phase === 'development')
        .map(
          (p) =>
            `${p.id}:${p.title}:${p.genre}:${p.scriptQuality}:${p.conceptStrength}:${p.directorId ?? 'none'}:${p.castIds.join(',')}:` +
            `${p.hypeScore}:${p.budget.actualSpend}:${p.budget.ceiling}:${p.franchiseId ?? 'none'}:${p.franchiseEpisode ?? 0}`
        )
        .join('|'),
      talentSignature: mgr.talentPool
        .map(
          (t) =>
            `${t.id}:${t.role}:${t.starPower}:${t.craftScore}:${t.availability}:${t.attachedProjectId ?? 'none'}:` +
            `${t.unavailableUntilWeek ?? -1}`
        )
        .join('|'),
      ipMarketSignature: mgr.ownedIps
        .map(
          (ip) =>
            `${ip.id}:${ip.kind}:${ip.name}:${ip.major}:${ip.acquisitionCost}:${ip.expiresWeek}:${ip.usedProjectId ?? 'none'}`
        )
        .join('|'),
      scriptMarketSignature: mgr.scriptMarket
        .map(
          (s) =>
            `${s.id}:${s.title}:${s.genre}:${s.askingPrice}:${s.scriptQuality}:${s.conceptStrength}:${s.expiresInWeeks}`
        )
        .join('|'),
      negotiationSignature: mgr.playerNegotiations
        .map(
          (n) =>
            `${n.talentId}:${n.projectId}:${n.rounds ?? 0}:${n.holdLineCount ?? 0}:${n.offerSalaryMultiplier ?? -1}:` +
            `${n.offerBackendPoints ?? -1}:${n.offerPerksBudget ?? -1}`
        )
        .join('|'),
    };
  }));
  const developmentProjects = manager.activeProjects.filter((project) => project.phase === 'development');
  const availableDirectors = manager.getAvailableTalentForRole('director');
  const availableLeads = manager.getAvailableTalentForRole('leadActor');
  const ipMarket = manager.ownedIps.filter((ip) => !ip.usedProjectId && ip.expiresWeek >= manager.currentWeek);
  const majorIpCommitments = manager.getMajorIpCommitments();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Script Room</Text>
      <Text style={styles.subtitle}>Acquire projects, evaluate projections, and open negotiations</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <Pressable style={styles.actionButton} onPress={() => setShowHelp((value) => !value)}>
        <Text style={styles.actionText}>{showHelp ? 'Hide Help' : 'Show Help'}</Text>
      </Pressable>
      {showHelp ? (
        <View style={styles.card}>
          <Text style={styles.bodyStrong}>How to read this screen</Text>
          <Text style={styles.muted}>1) Buy scripts with strong score/ROI fit.</Text>
          <Text style={styles.muted}>2) Attach a director and lead actor, then run greenlight from project detail.</Text>
          <Text style={styles.muted}>3) Use negotiation rounds to target the highlighted pressure point.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.bodyStrong}>
          Capacity {manager.projectCapacityUsed}/{manager.projectCapacityLimit}
        </Text>
        <Text style={styles.muted}>You cannot acquire new projects above capacity.</Text>
      </View>

      {majorIpCommitments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.bodyStrong}>Major IP Commitments</Text>
          {majorIpCommitments.map((commitment) => (
            <Text key={commitment.ipId} style={styles.muted}>
              {commitment.name}: {commitment.requiredReleases - commitment.remainingReleases}/{commitment.requiredReleases} delivered | deadline W
              {commitment.deadlineWeek}
              {commitment.isBlocking ? ' | CONTRACT LOCK ACTIVE' : ''}
              {commitment.breached ? ' | DEFAULTED' : ''}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IP Marketplace</Text>
        {ipMarket.length === 0 ? <Text style={styles.muted}>No active IP opportunities this week.</Text> : null}
        {ipMarket.map((ip) => (
          <View key={ip.id} style={styles.card}>
            <Text style={styles.cardTitle}>{ip.name}</Text>
            <Text style={styles.muted}>
              {ip.kind.toUpperCase()} | {capitalize(ip.genre)} | Expires W{ip.expiresWeek}
            </Text>
            <Text style={styles.muted}>
              Rights {money(ip.acquisitionCost)} | Bonuses: +{ip.hypeBonus} hype, +{ip.qualityBonus.toFixed(1)} quality
            </Text>
            {ip.major ? <Text style={styles.warning}>Major IP contract: 3-release obligation applies once rights are secured.</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={() => acquireIpRights(ip.id)}>
                <Text style={styles.actionText}>Acquire Rights</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => developFromIp(ip.id)}>
                <Text style={styles.actionText}>Start Adaptation</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {manager.playerNegotiations.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Negotiations</Text>
          <View style={styles.card}>
            {manager.playerNegotiations.map((entry) => {
              const talent = manager.talentPool.find((item) => item.id === entry.talentId);
              const project = manager.activeProjects.find((item) => item.id === entry.projectId);
              const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
              const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
              return (
                <View key={`${entry.projectId}-${entry.talentId}`} style={styles.subCard}>
                  <Text style={styles.bodyStrong}>
                    {talent?.name ?? 'Talent'} for {project?.title ?? 'Project'}
                  </Text>
                  <Text style={styles.muted}>
                    Opened week {entry.openedWeek} | resolves on next End Turn | close chance {chance !== null ? pct(chance) : '--'}
                  </Text>
                  {snapshot ? (
                    <>
                      <Text style={styles.muted}>
                        Rounds: {snapshot.rounds}/4 ({snapshot.roundsRemaining} left) | Pressure point: {snapshot.pressurePoint}
                      </Text>
                      <Text style={styles.muted}>
                        Offer: Salary {snapshot.salaryMultiplier.toFixed(2)}x | Backend {snapshot.backendPoints.toFixed(1)}pts | Perks{' '}
                        {money(snapshot.perksBudget)}
                      </Text>
                      <Text style={styles.muted}>
                        Ask: Salary {snapshot.demandSalaryMultiplier.toFixed(2)}x | Backend {snapshot.demandBackendPoints.toFixed(1)}pts | Perks{' '}
                        {money(snapshot.demandPerksBudget)}
                      </Text>
                      <Text style={styles.signal}>{snapshot.signal}</Text>
                      <View style={styles.negotiationActions}>
                        <Pressable
                          style={styles.negotiationButton}
                          onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenSalary')}>
                          <Text style={styles.negotiationButtonText}>+Salary</Text>
                        </Pressable>
                        <Pressable
                          style={styles.negotiationButton}
                          onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenBackend')}>
                          <Text style={styles.negotiationButtonText}>+Backend</Text>
                        </Pressable>
                        <Pressable
                          style={styles.negotiationButton}
                          onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'sweetenPerks')}>
                          <Text style={styles.negotiationButtonText}>+Perks</Text>
                        </Pressable>
                        <Pressable
                          style={styles.negotiationButton}
                          onPress={() => adjustNegotiation(entry.projectId, entry.talentId, 'holdFirm')}>
                          <Text style={styles.negotiationButtonText}>Hold Line</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Offers</Text>
        {manager.scriptMarket.length === 0 ? (
          <Text style={styles.muted}>No open script offers this week.</Text>
        ) : (
          manager.scriptMarket.map((script) => (
            <View key={script.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{script.title}</Text>
                <Text style={styles.genre}>{script.genre}</Text>
              </View>
              <Text style={styles.body}>{script.logline}</Text>
              <Text style={styles.muted}>Ask: {money(script.askingPrice)} | Expires in {script.expiresInWeeks}w</Text>
              <Text style={styles.muted}>
                Script: {script.scriptQuality.toFixed(1)} | Concept: {script.conceptStrength.toFixed(1)}
              </Text>
              {(() => {
                const evalResult = manager.evaluateScriptPitch(script.id);
                if (!evalResult) return null;
                return (
                  <View style={styles.subCard}>
                    <Text style={styles.bodyStrong}>
                      {recommendationLabel(evalResult.recommendation)} | Score {evalResult.score.toFixed(0)}
                    </Text>
                    <Text style={styles.muted}>
                      Est ROI {evalResult.expectedROI.toFixed(2)}x | Talent fit {pct(evalResult.fitScore)} | Risk {evalResult.riskLabel}
                    </Text>
                  </View>
                );
              })()}
              <View style={styles.actions}>
                <Pressable style={styles.actionButton} onPress={() => acquireScript(script.id)}>
                  <Text style={styles.actionText}>Acquire</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => passScript(script.id)}>
                  <Text style={styles.actionText}>Pass</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Development Attachments</Text>
        {developmentProjects.length === 0 ? (
          <Text style={styles.muted}>No development projects available.</Text>
        ) : (
          developmentProjects.map((project) => {
            const projection = manager.getProjectedForProject(project.id);
            const attachedDirector = manager.talentPool.find((talent) => talent.id === project.directorId);
            const castNames = project.castIds
              .map((id) => manager.talentPool.find((talent) => talent.id === id)?.name)
              .filter((value): value is string => !!value);
            return (
              <View key={project.id} style={styles.card}>
                <Text style={styles.cardTitle}>{project.title}</Text>
                <Text style={styles.body}>
                  {capitalize(project.genre)} | Director: {attachedDirector?.name ?? 'Unattached'}
                </Text>
                <Text style={styles.body}>
                  Cast attached: {project.castIds.length} {castNames.length > 0 ? `(${castNames.join(', ')})` : ''}
                </Text>
                {projection ? (
                  <Text style={styles.muted}>
                    Projection: Critic {projection.critical.toFixed(0)} | ROI {projection.roi.toFixed(2)}x
                  </Text>
                ) : null}

                <Text style={styles.subHeader}>Director</Text>
                {availableDirectors.map((talent) => (
                  <View key={talent.id} style={styles.inlineActions}>
                    <Pressable style={styles.talentButton} onPress={() => startNegotiation(project.id, talent.id)}>
                      <Text style={styles.talentText}>
                        Open: {talent.name} | Craft {talent.craftScore.toFixed(1)} | {talent.agentTier.toUpperCase()}
                      </Text>
                      <Text style={styles.talentMeta}>Chance {pct(manager.getNegotiationChance(talent.id, project.id) ?? 0)}</Text>
                    </Pressable>
                    <Pressable style={styles.quickButton} onPress={() => attachTalent(project.id, talent.id)}>
                      <Text style={styles.quickText}>Quick Close {pct(manager.getQuickCloseChance(talent.id) ?? 0)}</Text>
                    </Pressable>
                  </View>
                ))}

                <Text style={styles.subHeader}>Lead Actor</Text>
                {availableLeads.map((talent) => (
                  <View key={talent.id} style={styles.inlineActions}>
                    <Pressable style={styles.talentButton} onPress={() => startNegotiation(project.id, talent.id)}>
                      <Text style={styles.talentText}>
                        Open: {talent.name} | Star {talent.starPower.toFixed(1)} | {talent.agentTier.toUpperCase()}
                      </Text>
                      <Text style={styles.talentMeta}>Chance {pct(manager.getNegotiationChance(talent.id, project.id) ?? 0)}</Text>
                    </Pressable>
                    <Pressable style={styles.quickButton} onPress={() => attachTalent(project.id, talent.id)}>
                      <Text style={styles.quickText}>Quick Close {pct(manager.getQuickCloseChance(talent.id) ?? 0)}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </View>
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
    gap: 14,
    paddingBottom: 120,
  },
  title: {
    color: tokens.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    marginTop: -2,
  },
  message: {
    color: tokens.accentTeal,
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
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
  subCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 8,
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: tokens.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  genre: {
    color: tokens.accentGold,
    textTransform: 'capitalize',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 13,
  },
  bodyStrong: {
    color: tokens.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  muted: {
    color: tokens.textMuted,
    fontSize: 12,
  },
  warning: {
    color: tokens.accentGold,
    fontSize: 12,
  },
  signal: {
    color: tokens.accentGold,
    fontSize: 12,
  },
  negotiationActions: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 3,
  },
  negotiationButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  negotiationButtonText: {
    color: tokens.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    color: tokens.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  subHeader: {
    color: tokens.textPrimary,
    marginTop: 8,
    fontWeight: '600',
    fontSize: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  talentButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#202A3F',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  talentText: {
    color: tokens.textSecondary,
    fontSize: 12,
  },
  talentMeta: {
    color: tokens.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  quickButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#263754',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  quickText: {
    color: tokens.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
