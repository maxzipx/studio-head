import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { GlassCard, MetricTile, MetricsStrip, PremiumButton, ProgressBar, SectionLabel } from '@/src/ui/components';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';
import {
  buildSlateOffersSignature,
  buildSlateProjectsSignature,
  buildSlateRivalsSignature,
  buildSlateScriptsSignature,
} from '@/src/state/view-signatures';

function money(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function recommendationLabel(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return 'Strong Buy';
  if (value === 'conditional') return 'Conditional';
  return 'Pass';
}

function recommendationColor(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return colors.accentGreen;
  if (value === 'conditional') return colors.goldMid;
  return colors.accentRed;
}

function phaseColor(phase: string): string {
  if (phase === 'development') return colors.accentGreen;
  if (phase === 'preProduction') return colors.goldMid;
  if (phase === 'production') return colors.ctaBlue;
  if (phase === 'postProduction') return colors.accentGreen;
  if (phase === 'distribution') return colors.goldDeep;
  return colors.textMuted;
}

function phaseProgress(phase: string, weeksRemaining: number): number {
  const totals: Record<string, number> = {
    development: 4, preProduction: 8, production: 14, postProduction: 6, distribution: 3,
  };
  const total = totals[phase] ?? 1;
  return Math.max(0, Math.min(100, ((total - weeksRemaining) / total) * 100));
}

export default function SlateScreen() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const {
    manager,
    acquireScript,
    advancePhase,
    passScript,
    setReleaseWeek,
    acceptOffer,
    counterOffer,
    walkAwayOffer,
    lastMessage,
    scriptsSignature,
  } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      acquireScript: state.acquireScript,
      advancePhase: state.advancePhase,
      passScript: state.passScript,
      setReleaseWeek: state.setReleaseWeek,
      acceptOffer: state.acceptOffer,
      counterOffer: state.counterOffer,
      walkAwayOffer: state.walkAwayOffer,
      lastMessage: state.lastMessage,
      projectsSignature: buildSlateProjectsSignature(mgr.activeProjects),
      scriptsSignature: buildSlateScriptsSignature(mgr.scriptMarket),
      offersSignature: buildSlateOffersSignature(mgr.distributionOffers),
      rivalsSignature: buildSlateRivalsSignature(mgr.rivals),
    };
  }));
  const [hiddenAcquiredScriptIds, setHiddenAcquiredScriptIds] = useState<string[]>([]);
  const [acquisitionPopup, setAcquisitionPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  const projects = manager.activeProjects;
  const inFlight = projects.filter((p) => p.phase !== 'released' && p.phase !== 'distribution');
  const distribution = projects.filter((p) => p.phase === 'distribution');
  const visibleScriptMarket = manager.scriptMarket.filter((script) => !hiddenAcquiredScriptIds.includes(script.id));
  const rivalCalendar = manager.rivals.flatMap((rival) =>
    rival.upcomingReleases.map((film) => ({
      rival: rival.name, week: film.releaseWeek, genre: film.genre, title: film.title,
    }))
  );

  useEffect(() => {
    setHiddenAcquiredScriptIds((current) => current.filter((id) => manager.scriptMarket.some((script) => script.id === id)));
  }, [manager, scriptsSignature]);

  const openAcquisitionPopup = (title: string, message: string) => {
    setAcquisitionPopup({ visible: true, title, message });
  };

  const handleAcquireScript = (scriptId: string, title: string) => {
    const wasListed = manager.scriptMarket.some((script) => script.id === scriptId);
    const beforeCount = manager.scriptMarket.length;
    acquireScript(scriptId);
    const stillListed = manager.scriptMarket.some((script) => script.id === scriptId);
    const acquired = wasListed && !stillListed && manager.scriptMarket.length < beforeCount;

    if (!acquired) {
      openAcquisitionPopup('Could not acquire script', 'Check funds, capacity, or contract locks and try again.');
      return;
    }

    setHiddenAcquiredScriptIds((current) => (current.includes(scriptId) ? current : [...current, scriptId]));
    openAcquisitionPopup('Script acquired', `"${title}" has been added to your slate.`);
  };

  function pressureForWeek(week: number | null): { label: string; color: string } {
    if (!week) return { label: 'Unknown', color: colors.textMuted };
    const overlaps = rivalCalendar.filter((film) => Math.abs(film.week - week) <= 1).length;
    if (overlaps === 0) return { label: 'Clear', color: colors.accentGreen };
    if (overlaps <= 2) return { label: 'Moderate', color: colors.goldMid };
    return { label: 'High', color: colors.accentRed };
  }

  return (
    <View style={styles.screen}>
      <Modal
        transparent
        animationType="fade"
        visible={acquisitionPopup.visible}
        onRequestClose={() => setAcquisitionPopup((current) => ({ ...current, visible: false }))}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{acquisitionPopup.title}</Text>
            <Text style={styles.modalBody}>{acquisitionPopup.message}</Text>
            <PremiumButton
              label="OK"
              onPress={() => setAcquisitionPopup((current) => ({ ...current, visible: false }))}
              variant="primary"
              size="sm"
            />
          </View>
        </View>
      </Modal>
      <MetricsStrip cash={manager.cash} heat={manager.studioHeat} week={manager.currentWeek} />
      <ScrollView contentContainerStyle={styles.content}>

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
        {showHelp && (
          <GlassCard variant="elevated">
            <Text style={styles.helpTitle}>How the Slate Works</Text>
            <Text style={styles.helpBody}>Projects move through pipeline phases automatically if they meet requirements. Without a director, required actor/actress mix, and script quality {'>='} 6.0, projects are blocked in development.</Text>
            <Text style={styles.helpBody}>During production, they burn through your cash buffer weekly based on budget size. Run out of cash, and your studio goes bankrupt.</Text>
            <Text style={styles.helpBody}>In distribution, you will receive competing acquisition offers from rival distributors with guarantees, P&A, and rev-share. Releasing a film against crowded rival release weeks significantly hurts box office returns.</Text>
          </GlassCard>
        )}

        {/* ── Pipeline Snapshot ── */}
        <GlassCard>
          <SectionLabel label="Pipeline Snapshot" />
          <View style={styles.snapshotRow}>
            {[
              { label: 'In Flight', value: inFlight.length + distribution.length },
              { label: 'Scripts', value: manager.scriptMarket.length },
              { label: 'Distribution', value: distribution.length },
            ].map(({ label, value }) => (
              <GlassCard key={label} variant="elevated" style={styles.snapshotTile}>
                <MetricTile
                  value={value}
                  label={label}
                  size="sm"
                  centered
                  labelStyle={styles.snapshotMetricLabel}
                  labelNumberOfLines={1}
                />
              </GlassCard>
            ))}
          </View>
        </GlassCard>

        {/* ── Script Room ── */}
        <View style={styles.section}>
          <SectionLabel label="Script Room" />
          {visibleScriptMarket.length === 0
            ? <Text style={styles.empty}>No active script offers this week.</Text>
            : visibleScriptMarket.map((script) => {
              const evalResult = manager.evaluateScriptPitch(script.id);
              return (
                <GlassCard key={script.id} style={{ gap: spacing.sp2 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{script.title}</Text>
                    <View style={[styles.pill, { borderColor: colors.goldMid + '50' }]}>
                      <Text style={styles.pillText}>{script.genre}</Text>
                    </View>
                  </View>
                  <Text style={styles.logline}>{script.logline}</Text>

                  <View style={styles.metricRow}>
                    <MetricTile value={money(script.askingPrice)} label="Ask" size="sm" />
                    <MetricTile
                      value={`${script.expiresInWeeks}w`}
                      label="Expires"
                      size="sm"
                      accent={script.expiresInWeeks <= 1 ? colors.accentRed : colors.textMuted}
                    />
                    {evalResult && (
                      <MetricTile
                        value={evalResult.valueScore.toFixed(0)}
                        label="Script Grade"
                        size="sm"
                        accent={evalResult.valueScore >= 70 ? colors.accentGreen : evalResult.valueScore < 55 ? colors.accentRed : colors.goldMid}
                      />
                    )}
                  </View>

                  {evalResult && (
                    <View style={styles.recRow}>
                      <View style={[styles.recBadge, {
                        borderColor: recommendationColor(evalResult.recommendation) + '60',
                        backgroundColor: recommendationColor(evalResult.recommendation) + '14',
                      }]}>
                        <Text style={[styles.recText, { color: recommendationColor(evalResult.recommendation) }]}>
                          {recommendationLabel(evalResult.recommendation)}
                        </Text>
                      </View>
                      <Text style={styles.metaText}>
                        Script Quality {evalResult.qualityScore.toFixed(0)} · Risk {evalResult.riskLabel}
                      </Text>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <PremiumButton label="Acquire" onPress={() => handleAcquireScript(script.id, script.title)} variant="primary" size="sm" style={styles.flexBtn} />
                    <PremiumButton label="Pass" onPress={() => passScript(script.id)} variant="ghost" size="sm" style={styles.flexBtn} />
                  </View>
                </GlassCard>
              );
            })
          }
        </View>

        {/* ── In-Flight Projects ── */}
        <View style={styles.section}>
          <SectionLabel label="In-Flight Projects" />
          {inFlight.length === 0
            ? <Text style={styles.empty}>No projects currently moving through production phases.</Text>
            : inFlight.map((project) => {
              const projection = manager.getProjectedForProject(project.id);
              const burnPct = (project.budget.actualSpend / project.budget.ceiling) * 100;
              const director = project.directorId
                ? manager.talentPool.find((t) => t.id === project.directorId)?.name ?? 'Unknown'
                : 'Unattached';
              const cast = project.castIds
                .map((id) => manager.talentPool.find((t) => t.id === id)?.name)
                .filter((v): v is string => !!v);
              const progress = phaseProgress(project.phase, project.scheduledWeeksRemaining);
              const phaseCol = phaseColor(project.phase);

              return (
                <GlassCard key={project.id} style={{ gap: spacing.sp2 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{project.title}</Text>
                    <View style={styles.rowMeta}>
                      {manager.newlyAcquiredProjectId === project.id ? (
                        <View style={[styles.pill, { borderColor: colors.accentGreen + '70', backgroundColor: colors.accentGreen + '1A' }]}>
                          <Text style={[styles.pillText, { color: colors.accentGreen }]}>NEW</Text>
                        </View>
                      ) : null}
                      <View style={[styles.pill, { borderColor: phaseCol + '60', backgroundColor: phaseCol + '14' }]}>
                        <Text style={[styles.pillText, { color: phaseCol }]}>{project.phase}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.rowMeta}>
                    <View style={[styles.pill, { borderColor: colors.goldMid + '40' }]}>
                      <Text style={styles.pillText}>{project.genre}</Text>
                    </View>
                    <Text style={styles.metaText}>{director}</Text>
                    {project.scheduledWeeksRemaining > 0 && (
                      <Text style={styles.metaText}>{project.scheduledWeeksRemaining}w left</Text>
                    )}
                  </View>

                  <ProgressBar value={progress} color={phaseCol} height={4} animated />

                  <View style={styles.metricRow}>
                    <MetricTile value={money(project.budget.actualSpend)} label="Spent" size="sm" />
                    <MetricTile value={money(project.budget.ceiling)} label="Ceiling" size="sm" />
                    <MetricTile
                      value={`${burnPct.toFixed(0)}%`}
                      label="Consumed"
                      size="sm"
                      accent={burnPct > 85 ? colors.accentRed : colors.goldMid}
                    />
                  </View>
                  <ProgressBar
                    value={burnPct}
                    color={burnPct > 85 ? colors.accentRed : colors.accentGreen}
                    height={3}
                    animated
                  />

                  {cast.length > 0 && <Text style={styles.metaText}>Cast: {cast.join(', ')}</Text>}

                  {projection && (
                    <GlassCard variant="elevated" style={{ gap: spacing.sp2 }}>
                      <SectionLabel label="Projection" />
                      <View style={styles.metricRow}>
                        <MetricTile
                          value={projection.critical.toFixed(0)}
                          label="Critic"
                          size="sm"
                          accent={projection.critical >= 70 ? colors.accentGreen : projection.critical < 50 ? colors.accentRed : colors.goldMid}
                        />
                        <MetricTile value={money(projection.openingLow)} label="Opening Low" size="sm" />
                        <MetricTile value={money(projection.openingHigh)} label="Opening High" size="sm" accent={colors.accentGreen} />
                      </View>
                    </GlassCard>
                  )}

                  <View style={styles.actions}>
                    <PremiumButton
                      label="Open Detail"
                      onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
                      variant="secondary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                    <PremiumButton
                      label="Advance Phase"
                      onPress={() => advancePhase(project.id)}
                      variant="primary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                  </View>
                </GlassCard>
              );
            })
          }
        </View>

        {/* ── Distribution Desk ── */}
        <View style={styles.section}>
          <SectionLabel label="Distribution Desk" />
          {distribution.length === 0
            ? <Text style={styles.empty}>No projects in distribution phase.</Text>
            : distribution.map((project) => {
              const offers = manager.getOffersForProject(project.id);
              const pressure = pressureForWeek(project.releaseWeek);
              return (
                <GlassCard key={project.id} variant="gold" style={{ gap: spacing.sp2 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{project.title}</Text>
                    <Text style={[styles.pressureLabel, { color: pressure.color }]}>
                      {pressure.label} Pressure
                    </Text>
                  </View>

                  <Text style={styles.releaseWeekLine}>
                    Release Week{' '}
                    <Text style={{ color: colors.goldMid, fontFamily: typography.fontBodyBold }}>
                      {project.releaseWeek ?? '—'}
                    </Text>
                  </Text>

                  <View style={styles.actions}>
                    <PremiumButton
                      label="Week −1"
                      onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek - 1)}
                      disabled={!project.releaseWeek}
                      variant="secondary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                    <PremiumButton
                      label="Week +1"
                      onPress={() => project.releaseWeek && setReleaseWeek(project.id, project.releaseWeek + 1)}
                      disabled={!project.releaseWeek}
                      variant="secondary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                  </View>

                  {offers.map((offer) => (
                    <GlassCard key={offer.id} variant="elevated" style={{ gap: spacing.sp2 }}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.offerPartner}>{offer.partner}</Text>
                        <View style={[styles.pill, { borderColor: colors.goldMid + '40' }]}>
                          <Text style={styles.pillText}>{offer.releaseWindow}</Text>
                        </View>
                      </View>
                      <View style={styles.metricRow}>
                        <MetricTile value={money(offer.minimumGuarantee)} label="Min Guarantee" size="sm" accent={colors.accentGreen} />
                        <MetricTile value={money(offer.pAndACommitment)} label="P&A" size="sm" />
                        <MetricTile value={`${(offer.revenueShareToStudio * 100).toFixed(0)}%`} label="Rev Share" size="sm" accent={colors.goldMid} />
                      </View>
                      <View style={styles.actions}>
                        <PremiumButton label="Accept" onPress={() => acceptOffer(project.id, offer.id)} variant="primary" size="sm" style={styles.flexBtn} />
                        <PremiumButton label="Counter" onPress={() => counterOffer(project.id, offer.id)} variant="gold-outline" size="sm" style={styles.flexBtn} />
                      </View>
                    </GlassCard>
                  ))}

                  {offers.length === 0 && (
                    <Text style={styles.empty}>No offers right now. Regenerates on End Turn.</Text>
                  )}

                  <View style={styles.actions}>
                    <PremiumButton
                      label="Open Detail"
                      onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
                      variant="secondary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                    <PremiumButton
                      label="Advance To Release"
                      onPress={() => advancePhase(project.id)}
                      variant="primary"
                      size="sm"
                      style={styles.flexBtn}
                    />
                  </View>

                  {offers.length > 0 && (
                    <PremiumButton label="Walk Away" onPress={() => walkAwayOffer(project.id)} variant="danger" size="sm" />
                  )}
                </GlassCard>
              );
            })
          }
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp4, paddingBottom: 120, gap: spacing.sp3 },
  section: { gap: spacing.sp2 },

  header: { gap: 4, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  title: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subtitle: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted, marginTop: -2 },

  message: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeSM, color: colors.accentGreen },
  empty: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },
  helpTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary, marginBottom: 4 },
  helpBody: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

  snapshotRow: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp2 },
  snapshotTile: { flex: 1, alignItems: 'center', paddingVertical: spacing.sp2, flexShrink: 1 },
  snapshotMetricLabel: { letterSpacing: typography.trackingNormal, textTransform: 'none' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeMD, color: colors.textPrimary, flex: 1, marginRight: spacing.sp2 },
  logline: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary, lineHeight: 20 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2, flexWrap: 'wrap' },
  metaText: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  metricRow: { flexDirection: 'row', gap: spacing.sp3 },

  pill: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  pillText: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, color: colors.goldMid, letterSpacing: 0.4, textTransform: 'capitalize' },

  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  recBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  recText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },

  pressureLabel: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeXS, textTransform: 'uppercase', letterSpacing: 0.6 },
  releaseWeekLine: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textSecondary },
  offerPartner: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sp4,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.r4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: spacing.sp3,
    gap: spacing.sp2,
  },
  modalTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeMD,
    color: colors.textPrimary,
  },
  modalBody: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  actions: { flexDirection: 'row', gap: spacing.sp2, marginTop: spacing.sp1, flexWrap: 'wrap' },
  flexBtn: { flex: 1 },
});

