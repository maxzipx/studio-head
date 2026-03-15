import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { selectSlateView } from '@/src/state/view-selectors';
import { GlassCard, MetricTile, MetricsStrip, PremiumButton, SectionLabel } from '@/src/ui/components';
import { colors } from '@/src/ui/tokens';
import { money } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/slate/slate-styles';
import { SlateScriptCard } from '@/src/ui/slate/SlateScriptCard';
import { SlateProjectCard } from '@/src/ui/slate/SlateProjectCard';
import { SlateDistributionCard } from '@/src/ui/slate/SlateDistributionCard';

export default function SlateScreen() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const {
    manager,
    acquireScript,
    advancePhase,
    passScript,
    setReleaseWeek,
    confirmReleaseWeek,
    acceptOffer,
    counterOffer,
    walkAwayOffer,
    lastMessage,
    scriptsSignature,
  } = useGameStore(useShallow(selectSlateView));
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

  const navigateToProject = (projectId: string) => {
    router.push({ pathname: '/project/[id]', params: { id: projectId } });
  };

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
          <GlassCard variant="amber">
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
            <Text style={styles.helpBody}>In distribution, you will receive competing acquisition offers from rival distributors with guarantees, P&A, and rev-share. Suggested release weeks must be confirmed before rivals can force a collision or the film can release.</Text>
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
          {!manager.animationDivisionUnlocked ? (
            <Text style={styles.metaText}>
              Animation scripts enter the market after you found the Animation Division in HQ.
            </Text>
          ) : null}
          {visibleScriptMarket.length === 0
            ? <Text style={styles.empty}>No active script offers this week.</Text>
            : visibleScriptMarket.map((script) => (
              <SlateScriptCard
                key={script.id}
                script={script}
                evalResult={manager.evaluateScriptPitch(script.id)}
                onAcquire={handleAcquireScript}
                onPass={passScript}
              />
            ))
          }
        </View>

        {/* ── In-Flight Projects ── */}
        <View style={styles.section}>
          <SectionLabel label="In-Flight Projects" />
          {inFlight.length === 0
            ? <Text style={styles.empty}>No projects currently moving through production phases.</Text>
            : inFlight.map((project) => (
              <SlateProjectCard
                key={project.id}
                project={project}
                projection={manager.getProjectedForProject(project.id)}
                talentPool={manager.talentPool}
                isNewlyAcquired={manager.newlyAcquiredProjectId === project.id}
                onOpenDetail={navigateToProject}
                onAdvancePhase={advancePhase}
              />
            ))
          }
        </View>

        {/* ── Distribution Desk ── */}
        <View style={styles.section}>
          <SectionLabel label="Distribution Desk" />
          {distribution.length === 0
            ? <Text style={styles.empty}>No projects in distribution phase.</Text>
            : distribution.map((project) => (
              <SlateDistributionCard
                key={project.id}
                project={project}
                offers={manager.getOffersForProject(project.id)}
                pressure={pressureForWeek(project.releaseWeek)}
                onSetReleaseWeek={setReleaseWeek}
                onConfirmReleaseWeek={confirmReleaseWeek}
                onAcceptOffer={acceptOffer}
                onCounterOffer={counterOffer}
                onWalkAway={walkAwayOffer}
                onOpenDetail={navigateToProject}
                onAdvancePhase={advancePhase}
              />
            ))
          }
        </View>

      </ScrollView>
    </View>
  );
}
