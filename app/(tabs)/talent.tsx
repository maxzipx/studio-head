import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { selectTalentView } from '@/src/state/view-selectors';
import { GlassCard, MetricsStrip, PremiumButton, SectionLabel, TalentCard } from '@/src/ui/components';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';
import type { NegotiationAction } from '@/src/domain/types';
import {
  capitalized,
  chanceColor,
  chanceLabel,
  money,
  pct,
  phaseLabel,
} from '@/src/ui/helpers/formatting';
import { useNegotiationModal } from '@/src/ui/hooks/useNegotiationModal';

export default function TalentScreen() {
  const { manager, startNegotiation, adjustNegotiation, dismissNegotiation, attachTalent, lastMessage } = useGameStore(useShallow(selectTalentView));

  const developmentProjects = manager.activeProjects.filter((p) => p.phase === 'development');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(developmentProjects[0]?.id ?? null);
  const [showHelp, setShowHelp] = useState(false);
  // Draft lever selections for open negotiations — keyed by "projectId:talentId"
  const [draftNegActions, setDraftNegActions] = useState<Record<string, NegotiationAction>>({});

  const activeProject = selectedProjectId
    ? developmentProjects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  const negModal = useNegotiationModal(manager, activeProject, startNegotiation, adjustNegotiation);

  // Market: available talents with an active window, sorted directors first then by starPower desc
  const marketTalent = manager.talentPool
    .filter((t) => t.marketWindowExpiresWeek !== null && t.availability === 'available')
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
      return b.starPower - a.starPower;
    });

  // Roster: talents attached to your projects (negotiating talents show in Open Negotiations)
  const rosterTalent = manager.talentPool
    .filter((t) => t.attachedProjectId !== null)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
      return b.starPower - a.starPower;
    });

  const marketDirectorCount = marketTalent.filter((t) => t.role === 'director').length;
  const marketActorCount = marketTalent.filter((t) => t.role === 'leadActor').length;
  const marketActressCount = marketTalent.filter((t) => t.role === 'leadActress').length;
  const marketDirectors = marketTalent.filter((t) => t.role === 'director');
  const marketActors = marketTalent.filter((t) => t.role === 'leadActor');
  const marketActresses = marketTalent.filter((t) => t.role === 'leadActress');
  const rosterDirectors = rosterTalent.filter((t) => t.role === 'director');
  const rosterActors = rosterTalent.filter((t) => t.role === 'leadActor');
  const rosterActresses = rosterTalent.filter((t) => t.role === 'leadActress');
  const rivalLockedCount = manager.talentPool.filter((t) => manager.rivals.some((r) => r.lockedTalentIds.includes(t.id))).length;
  const coolingOffCount = manager.talentPool.filter((t) => manager.getTalentNegotiationOutlook(t).blocked).length;

  useEffect(() => {
    const stillValid = !!selectedProjectId && developmentProjects.some((p) => p.id === selectedProjectId);
    if (stillValid) return;
    const fallback = developmentProjects[0]?.id ?? null;
    if (fallback !== selectedProjectId) {
      setSelectedProjectId(fallback);
    }
  }, [developmentProjects, selectedProjectId]);

  return (
    <View style={styles.screen}>
      <MetricsStrip cash={manager.cash} heat={manager.studioHeat} week={manager.currentWeek} />
      <ScrollView contentContainerStyle={styles.content}>

        {lastMessage ? (
          <GlassCard variant="blue">
            <Text style={styles.message}>{lastMessage}</Text>
          </GlassCard>
        ) : null}

        {/*  Help  */}
        <PremiumButton
          label={showHelp ? 'Hide Help' : 'Show Help'}
          onPress={() => setShowHelp((v) => !v)}
          variant="ghost"
          size="sm"
        />
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

        {/*  Market Snapshot  */}
        <GlassCard>
          <SectionLabel label="Talent Market Snapshot" />
          <View style={styles.snapshotRow}>
            {[
              { label: 'Directors', value: marketDirectorCount, accent: colors.ctaBlue },
              { label: 'Actors', value: marketActorCount, accent: colors.accentGreen },
              { label: 'Actresses', value: marketActressCount, accent: colors.goldMid },
              { label: 'Deals', value: manager.playerNegotiations.length, accent: colors.goldMid },
              { label: 'Rivals', value: rivalLockedCount, accent: colors.accentRed },
              { label: 'Cooldown', value: coolingOffCount, accent: colors.textMuted },
            ].map(({ label, value, accent }) => (
              <GlassCard key={label} variant="elevated" style={styles.snapshotTile}>
                <Text style={[styles.snapshotValue, { color: accent }]}>{value}</Text>
                <Text style={styles.snapshotLabel}>{label}</Text>
              </GlassCard>
            ))}
          </View>
        </GlassCard>

        {/*  Development Targets  */}
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

        {/*  Active Target  */}
        {activeProject && (
          <GlassCard variant="gold">
            <SectionLabel label="Active Target" />
            <Text style={styles.activeTitle}>{activeProject.title}</Text>
            <Text style={styles.body}>{capitalized(activeProject.genre)} - {phaseLabel(activeProject.phase)}</Text>
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
            <Text style={styles.muted}>
              Required: {activeProject.castRequirements.actorCount} actor(s), {activeProject.castRequirements.actressCount} actress(es)
            </Text>
          </GlassCard>
        )}

        {/* Open Negotiations */}
        <GlassCard>
          <SectionLabel label="Open Negotiations" />
          <Text style={styles.muted}>Each submission spends one round. You can change only one lever per round.</Text>
          {manager.playerNegotiations.length === 0
            ? <Text style={styles.empty}>No open negotiations.</Text>
            : manager.playerNegotiations.map((entry) => {
              const talent = manager.talentPool.find((t) => t.id === entry.talentId);
              const project = manager.activeProjects.find((p) => p.id === entry.projectId);
              const chance = manager.getNegotiationChance(entry.talentId, entry.projectId);
              const snapshot = manager.getNegotiationSnapshot(entry.projectId, entry.talentId);
              const outOfRounds = (snapshot?.rounds ?? entry.rounds ?? 0) >= 4;
              return (
                <GlassCard key={`${entry.projectId}-${entry.talentId}`} variant="elevated" style={{ gap: spacing.sp2 }}>
                  <View style={styles.negHeader}>
                    <Text style={styles.subTitle}>{talent?.name ?? 'Talent'}</Text>
                    {chance !== null && (
                      <View style={[styles.chancePill, { borderColor: chanceColor(chance) + '60', backgroundColor: chanceColor(chance) + '14' }]}>
                        <Text style={[styles.chanceText, { color: chanceColor(chance) }]}>
                          {pct(chance)} - {chanceLabel(chance)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.muted}>
                    {project?.title} - opened W{entry.openedWeek} - resolves on End Turn
                  </Text>

                  {snapshot && (
                    <>
                      <Text style={styles.muted}>
                        Rounds {snapshot.rounds}/4 - Pressure: {capitalized(snapshot.pressurePoint)}
                      </Text>
                      <View style={styles.offerRow}>
                        <GlassCard variant="default" style={styles.offerCol}>
                          <Text style={styles.offerLabel}>YOUR OFFER</Text>
                          <Text style={styles.offerVal}>Salary {money((talent?.salary.base ?? 0) * snapshot.salaryMultiplier)}</Text>
                          <Text style={styles.offerVal}>{snapshot.backendPoints.toFixed(1)}pt Backend</Text>
                        </GlassCard>
                        <GlassCard variant="default" style={styles.offerCol}>
                          <Text style={styles.offerLabel}>THEIR ASK</Text>
                          <Text style={styles.offerVal}>Salary {money((talent?.salary.base ?? 0) * snapshot.demandSalaryMultiplier)}</Text>
                          <Text style={styles.offerVal}>{snapshot.demandBackendPoints.toFixed(1)}pt Backend</Text>
                        </GlassCard>
                      </View>
                      <Text style={[styles.signal, { color: colors.goldMid }]}>{snapshot.signal}</Text>
                      <Text style={styles.muted}>
                        Counter impact: Salary +${Math.round(snapshot.sweetenSalaryRetainerDelta).toLocaleString()} retainer | Backend -{snapshot.sweetenBackendShareDeltaPct.toFixed(1)}% share | Perks +${Math.round(snapshot.sweetenPerksRetainerDelta).toLocaleString()} retainer
                      </Text>
                    </>
                  )}
                  {!snapshot && (
                    <Text style={[styles.alert, { color: colors.accentRed }]}>
                      Negotiation details failed to load. You can still submit a counter or dismiss this stuck entry.
                    </Text>
                  )}
                  {outOfRounds && (
                    <Text style={[styles.alert, { color: colors.goldMid }]}>
                      Rounds exhausted. End Turn to resolve this negotiation.
                    </Text>
                  )}
                  {(() => {
                    const draftKey = `${entry.projectId}:${entry.talentId}`;
                    const selectedAction = draftNegActions[draftKey] ?? null;
                    return (
                      <>
                        <View style={styles.actions}>
                          {[
                            { label: 'Salary+', action: 'sweetenSalary' },
                            { label: 'Backend+', action: 'sweetenBackend' },
                            { label: 'Perks+', action: 'sweetenPerks' },
                            { label: 'Hold', action: 'holdFirm' },
                          ].map(({ label, action }) => (
                            <PremiumButton
                              key={action}
                              label={label}
                              onPress={() =>
                                setDraftNegActions((prev) => ({
                                  ...prev,
                                  [draftKey]: action as NegotiationAction,
                                }))
                              }
                              variant={selectedAction === action ? 'primary' : 'secondary'}
                              size="sm"
                              disabled={outOfRounds}
                              style={styles.negBtn}
                            />
                          ))}
                        </View>
                        <View style={styles.offerRow}>
                          <PremiumButton
                            label="Drop Negotiation"
                            onPress={() => {
                              dismissNegotiation(entry.projectId, entry.talentId);
                              setDraftNegActions((prev) => {
                                const next = { ...prev };
                                delete next[draftKey];
                                return next;
                              });
                            }}
                            variant="ghost"
                            size="sm"
                            style={styles.flexBtn}
                          />
                          <PremiumButton
                            label="Submit Round"
                            onPress={() => {
                              if (selectedAction) {
                                adjustNegotiation(entry.projectId, entry.talentId, selectedAction);
                                setDraftNegActions((prev) => {
                                  const next = { ...prev };
                                  delete next[draftKey];
                                  return next;
                                });
                              }
                            }}
                            variant="primary"
                            size="sm"
                            disabled={outOfRounds || !selectedAction}
                            style={styles.flexBtn}
                          />
                        </View>
                      </>
                    );
                  })()}
                </GlassCard>
              );
            })
          }
        </GlassCard>

        {/*  Directors In Market  */}
        <View style={styles.roleHeaderDirector}>
          <Text style={styles.roleHeaderText}>DIRECTORS IN MARKET</Text>
          <Text style={styles.roleHeaderCount}>{marketDirectors.length}</Text>
        </View>
        {marketTalent.length === 0
          ? (
            <GlassCard variant="elevated">
              <Text style={styles.empty}>Market is initializing  advance a turn to populate talent windows.</Text>
            </GlassCard>
          )
          : marketDirectors.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={negModal.open}
              attachTalent={attachTalent}
              showCountdown
            />
          ))}

        {/*  Actors In Market  */}
        <View style={styles.roleHeaderActor}>
          <Text style={styles.roleHeaderText}>ACTORS IN MARKET</Text>
          <Text style={styles.roleHeaderCount}>{marketActors.length}</Text>
        </View>
        {marketActors.map((talent) => (
          <TalentCard
            key={talent.id}
            talent={talent}
            manager={manager}
            activeProject={activeProject}
            openNegotiationModal={negModal.open}
            attachTalent={attachTalent}
            showCountdown
          />
        ))}
        <View style={styles.roleHeaderActor}>
          <Text style={styles.roleHeaderText}>ACTRESSES IN MARKET</Text>
          <Text style={styles.roleHeaderCount}>{marketActresses.length}</Text>
        </View>
        {marketActresses.map((talent) => (
          <TalentCard
            key={talent.id}
            talent={talent}
            manager={manager}
            activeProject={activeProject}
            openNegotiationModal={negModal.open}
            attachTalent={attachTalent}
            showCountdown
          />
        ))}

        {/*  Your Roster  */}
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
              openNegotiationModal={negModal.open}
              attachTalent={attachTalent}
              showCountdown={false}
            />)}
            {rosterActors.map((talent) => <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={negModal.open}
              attachTalent={attachTalent}
              showCountdown={false}
            />)}
            {rosterActresses.map((talent) => <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={negModal.open}
              attachTalent={attachTalent}
              showCountdown={false}
            />)}
          </>
        )}
      </ScrollView>

      <Modal visible={!!negModal.talent} transparent animationType="fade" onRequestClose={negModal.close}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDimLayer} onPress={negModal.close} />
          <GlassCard variant="elevated" style={styles.modalCard}>
            <SectionLabel label="Open Negotiation" />
            <Text style={styles.activeTitle}>{negModal.talent?.name ?? 'Talent'}</Text>
            <Text style={styles.muted}>{activeProject?.title ?? 'No active development target selected'}</Text>
            <Text style={styles.muted}>Pick one lever for round 1. Chance updates live before you submit.</Text>

            <View style={styles.actions}>
              {[
                { label: 'Salary+', action: 'sweetenSalary' },
                { label: 'Backend+', action: 'sweetenBackend' },
                { label: 'Perks+', action: 'sweetenPerks' },
                { label: 'Hold', action: 'holdFirm' },
              ].map((item) => (
                <PremiumButton
                  key={item.action}
                  label={item.label}
                  onPress={() => negModal.setDraftAction(item.action as NegotiationAction)}
                  variant={negModal.draftAction === item.action ? 'primary' : 'secondary'}
                  size="sm"
                  style={styles.negBtn}
                />
              ))}
            </View>

            {negModal.preview?.success && negModal.preview.preview ? (
              <GlassCard variant="default" style={{ gap: spacing.sp1 }}>
                <Text style={styles.muted}>
                  Offer: {money((negModal.talent?.salary.base ?? 0) * negModal.preview.preview.salaryMultiplier)} salary  {negModal.preview.preview.backendPoints.toFixed(1)}pt backend  {money(negModal.preview.preview.perksBudget)} perks
                </Text>
                <Text style={[styles.bodyStrong, { color: chanceColor(negModal.preview.preview.chance) }]}>
                  Close chance: {pct(negModal.preview.preview.chance)} - {chanceLabel(negModal.preview.preview.chance)}
                </Text>
                <Text style={styles.muted}>
                  Their ask: {money((negModal.talent?.salary.base ?? 0) * negModal.preview.preview.demandSalaryMultiplier)} salary  {negModal.preview.preview.demandBackendPoints.toFixed(1)}pt backend  {money(negModal.preview.preview.demandPerksBudget)} perks
                </Text>
                <Text style={[styles.signal, { color: colors.goldMid }]}>{negModal.preview.preview.signal}</Text>
              </GlassCard>
            ) : (
              <Text style={[styles.alert, { color: colors.accentRed }]}>
                {negModal.preview?.message ?? 'Unable to preview this negotiation right now.'}
              </Text>
            )}

            <View style={styles.offerRow}>
              <PremiumButton
                label="Cancel"
                onPress={negModal.close}
                variant="secondary"
                size="sm"
                style={styles.flexBtn}
              />
              <PremiumButton
                label="Submit Round 1"
                onPress={negModal.submit}
                variant="primary"
                size="sm"
                disabled={negModal.submitDisabled}
                style={styles.flexBtn}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
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
  bodyStrong: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  muted: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  alert: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },
  signal: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },

  helpTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary, marginBottom: 4 },
  helpBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

  snapshotRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sp2, marginTop: spacing.sp2, flexWrap: 'wrap' },
  snapshotTile: { flexBasis: '31%', minWidth: 92, alignItems: 'center', paddingVertical: spacing.sp2, paddingHorizontal: spacing.sp1 },
  snapshotValue: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeLG, letterSpacing: typography.trackingTight },
  snapshotLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 10, color: colors.textMuted, letterSpacing: typography.trackingWide, textAlign: 'center' },

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

  actions: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },
  negBtn: { flexGrow: 1, flexBasis: '23%', minWidth: 88 },
  flexBtn: { flex: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { width: '92%', maxWidth: 520, gap: spacing.sp2, marginHorizontal: spacing.sp3 },
});



