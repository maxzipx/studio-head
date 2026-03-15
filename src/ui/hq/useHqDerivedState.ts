import { useMemo } from 'react';

import { ACTION_BALANCE, AWARDS_RULES, BANKRUPTCY_RULES } from '@/src/domain/balance-constants';
import type { StudioManager } from '@/src/domain/studio-manager';

export function useHqDerivedState(manager: StudioManager, tick: number) {
  return useMemo(() => {
    const reveal = manager.getNextReleaseReveal();
    const isFinalReveal = !!reveal && manager.isFinalReleaseReveal(reveal.id);
    const revealReport = reveal ? manager.getLatestReleaseReport(reveal.id) : null;
    const visibleCrises = manager.pendingCrises.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
    const visibleDecisions = manager.decisionQueue.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
    const visibleUpdates = manager.inboxNotifications.filter((item) => !!item && typeof item.id === 'string' && typeof item.title === 'string');
    const inboxCount = visibleCrises.length + visibleDecisions.length + visibleUpdates.length;
    const weeklyExpenses = manager.estimateWeeklyBurn();
    const marketingUpgradeCost = manager.operationsService.getMarketingTeamUpgradeCost();
    const capacityUpgradeCost = manager.operationsService.getStudioCapacityUpgradeCost();
    const marketingTierCap = manager.operationsService.getMarketingTeamTierCap();
    const capacityTierCap = manager.operationsService.getStudioCapacityUpgradeTierCap();
    const optionalActionHype =
      ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST +
      Math.max(0, manager.marketingTeamLevel - 1) * ACTION_BALANCE.MARKETING_TEAM_HYPE_BONUS_PER_LEVEL;
    const optionalActionMarketing =
      ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST +
      Math.max(0, manager.marketingTeamLevel - 1) * ACTION_BALANCE.MARKETING_TEAM_BUDGET_BONUS_PER_LEVEL;
    const trackingConfidenceLo = Math.round(Math.min(0.9, Math.max(0.6, 0.57 + manager.marketingTeamLevel * 0.075)) * 100);
    const trackingConfidenceHi = Math.round(Math.min(0.9, Math.max(0.6, 0.58 + manager.marketingTeamLevel * 0.08)) * 100);
    const hasPendingSpecializationChange = manager.pendingSpecialization !== manager.studioSpecialization;
    const specializationPivotCost = hasPendingSpecializationChange
      ? manager.specializationCommittedWeek === null
        ? 0
        : 1_000_000
      : 0;
    const executivePoachCost = manager.executiveNetworkLevel >= 3 ? null : 900_000 * (manager.executiveNetworkLevel + 1);
    const activePartner = manager.operationsService.getActiveExclusivePartner();
    const partnerWeeksRemaining = manager.exclusivePartnerUntilWeek
      ? Math.max(0, manager.exclusivePartnerUntilWeek - manager.currentWeek)
      : 0;
    const scaleOverheadCost = manager.getScaleOverheadCost();
    const nextScaleOverheadWeek = manager.lastScaleOverheadWeek + 13;
    const developmentUpgradeCost = manager.departmentLevels.development >= 4 ? null : 420_000 * (manager.departmentLevels.development + 1);
    const productionUpgradeCost = manager.departmentLevels.production >= 4 ? null : 420_000 * (manager.departmentLevels.production + 1);
    const distributionUpgradeCost = manager.departmentLevels.distribution >= 4 ? null : 420_000 * (manager.departmentLevels.distribution + 1);
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
    const genreSnapshot = manager.getGenreCycleSnapshot();
    const hotGenres = genreSnapshot.slice(0, 3);
    const coolGenres = [...genreSnapshot].slice(-2).reverse();
    const rivalRelations = [...manager.rivals]
      .sort((a, b) => (b.memory.hostility - b.memory.respect) - (a.memory.hostility - a.memory.respect))
      .slice(0, 4);
    const tutorialVisible =
      !manager.needsFoundingSetup &&
      !manager.tutorialCompleted &&
      !manager.tutorialDismissed &&
      manager.tutorialState !== 'none' &&
      manager.tutorialState !== 'complete' &&
      !reveal;
    const canEnd = manager.canEndWeek && !isGameOver;
    const projectCapacityUsed = manager.projectCapacityUsed;
    const projectCapacityLimit = manager.projectCapacityLimit;
    const cash = manager.cash;
    const currentWeek = manager.currentWeek;
    const canEndWeek = manager.canEndWeek;
    const consecutiveLowCashWeeks = manager.consecutiveLowCashWeeks;
    const lifetimeProfit = manager.lifetimeProfit;

    return {
      reveal,
      isFinalReveal,
      revealReport,
      leaderboard: manager.getIndustryHeatLeaderboard(),
      news: manager.industryNewsLog.slice(0, 6),
      chronicle: manager.studioChronicle.slice(0, 8),
      milestones: manager.getActiveMilestones().slice(0, 6),
      visibleCrises,
      visibleDecisions,
      visibleUpdates,
      inboxCount,
      weeklyExpenses,
      projectCapacityUsed,
      projectCapacityLimit,
      cash,
      currentWeek,
      canEndWeek,
      consecutiveLowCashWeeks,
      lifetimeProfit,
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
      lastAwards: manager.awardsHistory[0],
      hotGenres,
      coolGenres,
      rivalRelations,
      tutorialVisible,
      canEnd,
    };
  }, [manager, tick]);
}
