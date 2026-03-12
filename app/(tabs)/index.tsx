import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BANKRUPTCY_RULES } from '@/src/domain/balance-constants';
import { useGameStore } from '@/src/state/game-context';
import { selectHQView } from '@/src/state/view-selectors';
import { GlassCard, MetricsStrip, PremiumButton, SectionLabel } from '@/src/ui/components';
import { TIER_LABELS } from '@/src/ui/hq/hq-helpers';
import { FoundingSetupOverlay } from '@/src/ui/hq/FoundingSetupOverlay';
import { HqInboxSection } from '@/src/ui/hq/HqInboxSection';
import { HqIndustryPanel } from '@/src/ui/hq/HqIndustryPanel';
import { HqOperationsCard } from '@/src/ui/hq/HqOperationsCard';
import { HqStandingCard } from '@/src/ui/hq/HqStandingCard';
import { HqTimelinePanel } from '@/src/ui/hq/HqTimelinePanel';
import { HqTutorialOverlay } from '@/src/ui/hq/HqTutorialOverlay';
import { HqWeeklyStatusCard } from '@/src/ui/hq/HqWeeklyStatusCard';
import { ReleaseRevealModal } from '@/src/ui/hq/ReleaseRevealModal';
import { styles } from '@/src/ui/hq/hq-styles';
import { useHqDerivedState } from '@/src/ui/hq/useHqDerivedState';
import { colors } from '@/src/ui/tokens';
import { useShallow } from 'zustand/react/shallow';

export default function HQScreen() {
  const router = useRouter();
  const animationDivisionCost = 8_000_000;
  const {
    manager,
    tick,
    dismissReleaseReveal,
    dismissInboxNotification,
    endWeek,
    advanceToNextDecision,
    resolveCrisis,
    resolveDecision,
    dismissDecision,
    runOptionalAction,
    renameStudio,
    upgradeMarketingTeam,
    upgradeStudioCapacity,
    foundAnimationDivision,
    setStudioSpecialization,
    completeFoundingSetup,
    advanceTutorial,
    dismissTutorial,
    restartTutorial,
    investDepartment,
    signExclusivePartner,
    poachExecutiveTeam,
    startNewRun,
    lastMessage,
  } = useGameStore(useShallow(selectHQView));

  const {
    reveal,
    isFinalReveal,
    revealReport,
    leaderboard,
    news,
    chronicle,
    milestones,
    visibleCrises,
    visibleDecisions,
    visibleUpdates,
    inboxCount,
    weeklyExpenses,
    marketingUpgradeCost,
    capacityUpgradeCost,
    marketingTierCap,
    capacityTierCap,
    optionalActionHype,
    optionalActionMarketing,
    trackingConfidenceLo,
    trackingConfidenceHi,
    hasPendingSpecializationChange,
    specializationPivotCost,
    executivePoachCost,
    activePartner,
    partnerWeeksRemaining,
    scaleOverheadCost,
    nextScaleOverheadWeek,
    developmentUpgradeCost,
    productionUpgradeCost,
    distributionUpgradeCost,
    isGameOver,
    hasLowCashWarning,
    hasUrgentLowCashWarning,
    arcEntries,
    activeArcCount,
    nextAwardsWeek,
    lastAwards,
    hotGenres,
    coolGenres,
    rivalRelations,
    tutorialVisible,
    canEnd,
  } = useHqDerivedState(manager, tick);

  const [studioNameDraft, setStudioNameDraft] = useState(manager.studioName);
  const [confirmNewRun, setConfirmNewRun] = useState(false);
  const [showHqHelp, setShowHqHelp] = useState(false);

  useEffect(() => {
    setStudioNameDraft(manager.studioName);
  }, [manager.studioName]);

  return (
    <View style={styles.screen}>
      <MetricsStrip cash={manager.cash} heat={manager.studioHeat} week={manager.currentWeek} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.navyPrimary + '14', 'transparent']}
            style={styles.headerGlow}
            pointerEvents="none"
          />
          <Text style={styles.studioName}>{manager.studioName}</Text>
          <Text style={styles.weekLine}>Week {manager.currentWeek} | {TIER_LABELS[manager.studioTier] ?? manager.studioTier}</Text>
        </View>

        {manager.currentWeek <= 1 ? (
          <GlassCard variant="amber">
            <SectionLabel label="Getting Started" />
            {[
              'Inbox decisions expire - resolve them within the listed weeks or lose the opportunity.',
              'Projects need a Director plus the required Actor/Actress mix and Script Quality >= 6.0 to advance.',
              'End turn progresses 2 weeks. Crises must be cleared first. Each turn costs cash from production burn.',
              'Reputation has four pillars: Critics, Talent, Distributor, and Audience. Each is affected differently.',
            ].map((tip, index) => (
              <Text key={index} style={[styles.body, { color: colors.accentGreen }]}>- {tip}</Text>
            ))}
          </GlassCard>
        ) : (
          <>
            <View style={styles.actionsRow}>
              <PremiumButton
                label={showHqHelp ? 'Hide HQ Help' : 'HQ Help'}
                onPress={() => setShowHqHelp((value) => !value)}
                variant="ghost"
                size="sm"
                style={styles.choiceBtn}
              />
              {!manager.needsFoundingSetup && !tutorialVisible ? (
                <PremiumButton
                  label="Replay Tutorial"
                  onPress={restartTutorial}
                  variant="ghost"
                  size="sm"
                  style={styles.choiceBtn}
                />
              ) : null}
            </View>
            {showHqHelp ? (
              <GlassCard variant="elevated">
                <SectionLabel label="HQ Help" />
                <Text style={styles.body}>Use End Turn to progress pipeline phases and market cycles.</Text>
                <Text style={styles.body}>Studio identity changes commit on End Turn; keep cash reserved for pivots.</Text>
                <Text style={styles.body}>Before greenlight, attach a director and satisfy each project&apos;s actor/actress requirements.</Text>
                <Text style={styles.body}>Monitor Inbox often. Crises block the 2-week turn until resolved.</Text>
              </GlassCard>
            ) : null}
          </>
        )}

        {lastMessage ? (
          <GlassCard variant="amber">
            <Text style={styles.message}>{lastMessage}</Text>
          </GlassCard>
        ) : null}

        {isGameOver ? (
          <GlassCard variant="red">
            <SectionLabel label="Game Over" />
            <Text style={[styles.bodyStrong, { color: colors.accentRed }]}>Bankruptcy Declared</Text>
            <Text style={styles.body}>{manager.bankruptcyReason ?? 'Studio is bankrupt.'}</Text>
            <Text style={styles.muted}>Start a new run from the save menu to continue.</Text>
          </GlassCard>
        ) : null}

        <HqWeeklyStatusCard
          manager={manager}
          weeklyExpenses={weeklyExpenses}
          scaleOverheadCost={scaleOverheadCost}
          nextScaleOverheadWeek={nextScaleOverheadWeek}
          inboxCount={inboxCount}
          hasLowCashWarning={hasLowCashWarning}
          hasUrgentLowCashWarning={hasUrgentLowCashWarning}
        />

        <HqStandingCard manager={manager} />

        <HqInboxSection
          manager={manager}
          visibleCrises={visibleCrises}
          visibleDecisions={visibleDecisions}
          visibleUpdates={visibleUpdates}
          inboxCount={inboxCount}
          resolveCrisis={resolveCrisis}
          resolveDecision={resolveDecision}
          dismissDecision={dismissDecision}
          dismissInboxNotification={dismissInboxNotification}
        />

        <HqOperationsCard
          manager={manager}
          isGameOver={isGameOver}
          studioNameDraft={studioNameDraft}
          onStudioNameDraftChange={setStudioNameDraft}
          onRenameStudio={renameStudio}
          onUpgradeMarketingTeam={upgradeMarketingTeam}
          onUpgradeStudioCapacity={upgradeStudioCapacity}
          onFoundAnimationDivision={foundAnimationDivision}
          onRunOptionalAction={runOptionalAction}
          onSetStudioSpecialization={setStudioSpecialization}
          onInvestDepartment={investDepartment}
          onSignExclusivePartner={signExclusivePartner}
          onPoachExecutiveTeam={poachExecutiveTeam}
          optionalActionHype={optionalActionHype}
          optionalActionMarketing={optionalActionMarketing}
          trackingConfidenceLo={trackingConfidenceLo}
          trackingConfidenceHi={trackingConfidenceHi}
          marketingUpgradeCost={marketingUpgradeCost}
          capacityUpgradeCost={capacityUpgradeCost}
          marketingTierCap={marketingTierCap}
          capacityTierCap={capacityTierCap}
          hasPendingSpecializationChange={hasPendingSpecializationChange}
          specializationPivotCost={specializationPivotCost}
          executivePoachCost={executivePoachCost}
          activePartner={activePartner}
          partnerWeeksRemaining={partnerWeeksRemaining}
          developmentUpgradeCost={developmentUpgradeCost}
          productionUpgradeCost={productionUpgradeCost}
          distributionUpgradeCost={distributionUpgradeCost}
          animationDivisionCost={animationDivisionCost}
        />

        <HqIndustryPanel
          manager={manager}
          arcEntries={arcEntries}
          activeArcCount={activeArcCount}
          hotGenres={hotGenres}
          coolGenres={coolGenres}
          leaderboard={leaderboard}
          rivalRelations={rivalRelations}
          nextAwardsWeek={nextAwardsWeek}
          lastAwards={lastAwards}
        />

        <HqTimelinePanel
          manager={manager}
          milestones={milestones}
          chronicle={chronicle}
          news={news}
        />

        {confirmNewRun ? (
          <GlassCard variant="red">
            <SectionLabel label="Confirm New Run" />
            <Text style={styles.body}>This resets your current studio and starts a fresh game.</Text>
            <View style={styles.actionsRow}>
              <PremiumButton
                label="Confirm New Run"
                onPress={() => {
                  setConfirmNewRun(false);
                  startNewRun();
                }}
                variant="danger"
                size="sm"
                style={styles.flexBtn}
              />
              <PremiumButton
                label="Cancel"
                onPress={() => setConfirmNewRun(false)}
                variant="secondary"
                size="sm"
                style={styles.flexBtn}
              />
            </View>
          </GlassCard>
        ) : (
          <PremiumButton
            label="Start New Run"
            onPress={() => setConfirmNewRun(true)}
            variant="ghost"
            size="sm"
            fullWidth
          />
        )}
      </ScrollView>

      <View style={styles.stickyFooter}>
        <PremiumButton
          label="Next Decision"
          onPress={advanceToNextDecision}
          disabled={!canEnd}
          variant="secondary"
          size="sm"
          style={styles.footerBtn}
        />
        <PremiumButton
          label={isGameOver ? 'Game Over' : manager.canEndWeek ? 'End turn (progress 2 weeks)' : 'Resolve Crisis First'}
          onPress={endWeek}
          disabled={!canEnd}
          variant="primary"
          size="sm"
          style={styles.footerBtn}
        />
      </View>

      <ReleaseRevealModal
        reveal={reveal}
        isFinalReveal={isFinalReveal}
        revealReport={revealReport}
        dismissReleaseReveal={dismissReleaseReveal}
      />
      <FoundingSetupOverlay
        visible={manager.needsFoundingSetup}
        onComplete={(studioName, specialization, foundingProfile) => {
          renameStudio(studioName);
          completeFoundingSetup(specialization, foundingProfile);
        }}
      />
      <HqTutorialOverlay
        manager={manager}
        visible={tutorialVisible}
        tick={tick}
        onAdvance={advanceTutorial}
        onSkip={dismissTutorial}
        onOpenSlate={() => router.push('/slate')}
      />
    </View>
  );
}
