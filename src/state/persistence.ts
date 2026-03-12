import AsyncStorage from '@react-native-async-storage/async-storage';

import { MEMORY_RULES, STUDIO_STARTING } from '../domain/balance-constants';
import { createSeedTalentPool } from '../domain/seeds';
import { StudioManager } from '../domain/studio-manager';
import type { ChronicleEntryImpact, ChronicleEntryType, MovieGenre } from '../domain/types';

const SAVE_KEY = 'pg.save.v1';
const SAVE_VERSION = 1;

interface StoredManager extends Record<string, unknown> {
  lastEventWeek?: [string, number][];
  studioHeat?: number;
}

interface SaveEnvelope {
  version: number;
  savedAt: string;
  manager: StoredManager;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeRestoredManager(manager: StudioManager): void {
  const defaults = new StudioManager();
  const scriptMarketTargetOffers = 4;

  if (typeof manager.studioName !== 'string' || manager.studioName.trim().length < 1) {
    manager.studioName = defaults.studioName;
  }
  if (!Number.isFinite((manager as StudioManager & { talentSeed?: number }).talentSeed)) {
    (manager as StudioManager & { talentSeed: number }).talentSeed = 0;
  }
  (manager as StudioManager & { talentSeed: number }).talentSeed = Math.max(
    0,
    Math.floor(Math.abs((manager as StudioManager & { talentSeed: number }).talentSeed))
  );
  if (!Number.isFinite(manager.cash)) manager.cash = defaults.cash;
  manager.cash = Math.round(manager.cash);
  if (typeof manager.isBankrupt !== 'boolean') manager.isBankrupt = false;
  if (typeof manager.bankruptcyReason !== 'string' && manager.bankruptcyReason !== null) {
    manager.bankruptcyReason = null;
  }
  if (!Number.isFinite(manager.consecutiveLowCashWeeks)) manager.consecutiveLowCashWeeks = 0;
  if (typeof manager.firstSessionComplete !== 'boolean') manager.firstSessionComplete = false;
  if (!Number.isFinite(manager.lifetimeRevenue)) manager.lifetimeRevenue = 0;
  if (!Number.isFinite(manager.lifetimeExpenses)) manager.lifetimeExpenses = 0;
  if (!Number.isFinite(manager.lifetimeProfit)) manager.lifetimeProfit = manager.lifetimeRevenue - manager.lifetimeExpenses;
  if (!Number.isFinite(manager.marketingTeamLevel)) manager.marketingTeamLevel = 1;
  manager.marketingTeamLevel = Math.min(5, Math.max(1, Math.round(manager.marketingTeamLevel)));
  if (!Number.isFinite(manager.studioCapacityUpgrades)) manager.studioCapacityUpgrades = 0;
  manager.studioCapacityUpgrades = Math.max(0, Math.round(manager.studioCapacityUpgrades));
  if (
    manager.studioSpecialization !== 'balanced' &&
    manager.studioSpecialization !== 'blockbuster' &&
    manager.studioSpecialization !== 'prestige' &&
    manager.studioSpecialization !== 'indie'
  ) {
    manager.studioSpecialization = 'balanced';
  }
  if (
    manager.pendingSpecialization !== 'balanced' &&
    manager.pendingSpecialization !== 'blockbuster' &&
    manager.pendingSpecialization !== 'prestige' &&
    manager.pendingSpecialization !== 'indie'
  ) {
    manager.pendingSpecialization = manager.studioSpecialization;
  }
  if (!Number.isFinite(manager.specializationCommittedWeek)) manager.specializationCommittedWeek = null;
  if (
    manager.foundingProfile !== 'none' &&
    manager.foundingProfile !== 'starDriven' &&
    manager.foundingProfile !== 'dataDriven' &&
    manager.foundingProfile !== 'franchiseVision' &&
    manager.foundingProfile !== 'culturalBrand'
  ) {
    manager.foundingProfile = 'none';
  }
  if (typeof manager.needsFoundingSetup !== 'boolean') manager.needsFoundingSetup = false;
  if (!Number.isFinite(manager.foundingSetupCompletedWeek)) manager.foundingSetupCompletedWeek = null;
  if (typeof manager.animationDivisionUnlocked !== 'boolean') manager.animationDivisionUnlocked = false;
  if (!Number.isFinite(manager.lastGeneratedCrisisWeek)) manager.lastGeneratedCrisisWeek = null;
  if (typeof manager.generatedCrisisThisTurn !== 'boolean') manager.generatedCrisisThisTurn = false;
  if (!Number.isFinite(manager.lastScaleOverheadWeek)) manager.lastScaleOverheadWeek = 1;
  manager.lastScaleOverheadWeek = Math.max(1, Math.round(manager.lastScaleOverheadWeek));
  // Tutorial restore intentionally happens in three passes: validate the enum,
  // derive missing booleans from that sanitized state, then normalize the
  // combination into one terminal shape. Reordering these steps changes
  // migration behavior for malformed or legacy saves.
  if (
    manager.tutorialState !== 'none' &&
    manager.tutorialState !== 'hqIntro' &&
    manager.tutorialState !== 'strategy' &&
    manager.tutorialState !== 'firstProject' &&
    manager.tutorialState !== 'marketing' &&
    manager.tutorialState !== 'talent' &&
    manager.tutorialState !== 'risk' &&
    manager.tutorialState !== 'complete'
  ) {
    manager.tutorialState = manager.tutorialCompleted || manager.tutorialDismissed ? 'complete' : 'hqIntro';
  }
  if (typeof manager.tutorialCompleted !== 'boolean') manager.tutorialCompleted = manager.tutorialState === 'complete';
  if (typeof manager.tutorialDismissed !== 'boolean') manager.tutorialDismissed = false;
  if (manager.tutorialDismissed) {
    manager.tutorialState = 'complete';
    manager.tutorialCompleted = false;
  } else if (manager.tutorialCompleted || manager.tutorialState === 'complete') {
    manager.tutorialState = 'complete';
    manager.tutorialCompleted = true;
    manager.tutorialDismissed = false;
  } else if (manager.tutorialState === 'none') {
    manager.tutorialState = 'hqIntro';
  }
  if (!isRecord(manager.departmentLevels)) {
    manager.departmentLevels = { development: 0, production: 0, distribution: 0 };
  }
  manager.departmentLevels.development = Number.isFinite(manager.departmentLevels.development)
    ? Math.max(0, Math.min(4, Math.round(manager.departmentLevels.development)))
    : 0;
  manager.departmentLevels.production = Number.isFinite(manager.departmentLevels.production)
    ? Math.max(0, Math.min(4, Math.round(manager.departmentLevels.production)))
    : 0;
  manager.departmentLevels.distribution = Number.isFinite(manager.departmentLevels.distribution)
    ? Math.max(0, Math.min(4, Math.round(manager.departmentLevels.distribution)))
    : 0;
  if (typeof manager.exclusiveDistributionPartner !== 'string' && manager.exclusiveDistributionPartner !== null) {
    manager.exclusiveDistributionPartner = null;
  }
  if (!Number.isFinite(manager.exclusivePartnerUntilWeek)) manager.exclusivePartnerUntilWeek = null;
  if (!Number.isFinite(manager.executiveNetworkLevel)) manager.executiveNetworkLevel = 0;
  manager.executiveNetworkLevel = Math.max(0, Math.min(3, Math.round(manager.executiveNetworkLevel)));
  if (typeof manager.marketInitialized !== 'boolean') manager.marketInitialized = false;
  if (!Number.isFinite(manager.lastMarketBurstWeek)) manager.lastMarketBurstWeek = 0;
  manager.lastMarketBurstWeek = Math.max(0, Math.round(manager.lastMarketBurstWeek));
  if (!Number.isFinite(manager.marketDirectorIdx)) manager.marketDirectorIdx = 0;
  manager.marketDirectorIdx = Math.max(0, Math.round(manager.marketDirectorIdx));
  if (!Number.isFinite(manager.marketActorIdx)) manager.marketActorIdx = 0;
  manager.marketActorIdx = Math.max(0, Math.round(manager.marketActorIdx));
  if (!Number.isFinite(manager.marketLeadActorIdx)) manager.marketLeadActorIdx = 0;
  manager.marketLeadActorIdx = Math.max(0, Math.round(manager.marketLeadActorIdx));
  if (!Number.isFinite(manager.marketLeadActressIdx)) manager.marketLeadActressIdx = 0;
  manager.marketLeadActressIdx = Math.max(0, Math.round(manager.marketLeadActressIdx));

  if (!isRecord(manager.reputation)) {
    manager.reputation = {
      critics: STUDIO_STARTING.REPUTATION_PILLAR,
      talent: STUDIO_STARTING.REPUTATION_PILLAR,
      distributor: STUDIO_STARTING.REPUTATION_PILLAR,
      audience: STUDIO_STARTING.REPUTATION_PILLAR,
    };
  } else {
    const rep = manager.reputation as Record<string, unknown>;
    for (const field of ['critics', 'talent', 'distributor', 'audience']) {
      if (!Number.isFinite(rep[field])) rep[field] = STUDIO_STARTING.REPUTATION_PILLAR;
      rep[field] = Math.min(100, Math.max(0, rep[field] as number));
    }
  }

  if (!Number.isFinite(manager.currentWeek) || manager.currentWeek < 1) {
    manager.currentWeek = defaults.currentWeek;
  }
  manager.currentWeek = Math.max(1, Math.round(manager.currentWeek));
  manager.turnLengthWeeks = defaults.turnLengthWeeks;

  if (!Array.isArray(manager.pendingCrises)) manager.pendingCrises = [];
  if (!Array.isArray(manager.distributionOffers)) manager.distributionOffers = [];
  manager.distributionOffers = manager.distributionOffers.filter(
    (offer) => offer.releaseWindow === 'wideTheatrical' || offer.releaseWindow === 'limitedTheatrical'
  );
  if (!Array.isArray(manager.pendingReleaseReveals)) manager.pendingReleaseReveals = [];
  if (!Array.isArray(manager.pendingFinalReleaseReveals)) manager.pendingFinalReleaseReveals = [];
  if (!Array.isArray(manager.decisionQueue)) manager.decisionQueue = defaults.decisionQueue;
  manager.decisionQueue = manager.decisionQueue
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string')
    .map((entry) => {
      const rawOptions = Array.isArray(entry.options) ? entry.options : [];
      const options = rawOptions
        .filter((opt) => isRecord(opt) && typeof opt.id === 'string' && typeof opt.label === 'string')
        .map((opt) => ({
          id: String(opt.id),
          label: String(opt.label),
          preview: typeof opt.preview === 'string' ? opt.preview : '',
          cashDelta: Number.isFinite(opt.cashDelta) ? Number(opt.cashDelta) : 0,
          scriptQualityDelta: Number.isFinite(opt.scriptQualityDelta) ? Number(opt.scriptQualityDelta) : 0,
          hypeDelta: Number.isFinite(opt.hypeDelta) ? Number(opt.hypeDelta) : 0,
          ...(Number.isFinite(opt.studioHeatDelta) ? { studioHeatDelta: Number(opt.studioHeatDelta) } : {}),
          ...(Number.isFinite(opt.criticsDelta) ? { criticsDelta: Number(opt.criticsDelta) } : {}),
          ...(Number.isFinite(opt.talentRepDelta) ? { talentRepDelta: Number(opt.talentRepDelta) } : {}),
          ...(Number.isFinite(opt.distributorRepDelta) ? { distributorRepDelta: Number(opt.distributorRepDelta) } : {}),
          ...(Number.isFinite(opt.audienceDelta) ? { audienceDelta: Number(opt.audienceDelta) } : {}),
          ...(Number.isFinite(opt.scheduleDelta) ? { scheduleDelta: Math.round(Number(opt.scheduleDelta)) } : {}),
          ...(Number.isFinite(opt.releaseWeekShift) ? { releaseWeekShift: Math.round(Number(opt.releaseWeekShift)) } : {}),
          ...(Number.isFinite(opt.marketingDelta) ? { marketingDelta: Number(opt.marketingDelta) } : {}),
          ...(Number.isFinite(opt.overrunRiskDelta) ? { overrunRiskDelta: Number(opt.overrunRiskDelta) } : {}),
          ...(typeof opt.setFlag === 'string' ? { setFlag: opt.setFlag } : {}),
          ...(typeof opt.clearFlag === 'string' ? { clearFlag: opt.clearFlag } : {}),
          ...(Number.isFinite(opt.setArcStage) ? { setArcStage: Math.round(Number(opt.setArcStage)) } : {}),
          ...(Number.isFinite(opt.advanceArcBy) ? { advanceArcBy: Math.round(Number(opt.advanceArcBy)) } : {}),
          ...(typeof opt.resolveArc === 'boolean' ? { resolveArc: opt.resolveArc } : {}),
          ...(typeof opt.failArc === 'boolean' ? { failArc: opt.failArc } : {}),
        }));
      return {
        id: String(entry.id),
        projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
        title: String(entry.title).slice(0, 140),
        body: typeof entry.body === 'string' ? entry.body : '',
        weeksUntilExpiry: Number.isFinite(entry.weeksUntilExpiry) ? Math.round(Number(entry.weeksUntilExpiry)) : 1,
        ...(typeof entry.onExpireClearFlag === 'string' ? { onExpireClearFlag: entry.onExpireClearFlag } : {}),
        ...(entry.category === 'creative' ||
        entry.category === 'marketing' ||
        entry.category === 'operations' ||
        entry.category === 'finance' ||
        entry.category === 'talent'
          ? { category: entry.category }
          : {}),
        ...(typeof entry.sourceEventId === 'string' ? { sourceEventId: entry.sourceEventId } : {}),
        ...(typeof entry.arcId === 'string' ? { arcId: entry.arcId } : {}),
        ...(Number.isFinite(entry.arcStage) ? { arcStage: Math.round(Number(entry.arcStage)) } : {}),
        options,
      };
    })
    .filter((entry) => entry.options.length > 0)
    .slice(0, 24);
  if (!Array.isArray(manager.inboxNotifications)) manager.inboxNotifications = [];
  manager.inboxNotifications = manager.inboxNotifications
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string')
    .map((entry) => ({
      id: String(entry.id),
      week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
      kind:
        entry.kind === 'negotiationSuccess' || entry.kind === 'scriptAcquired'
          ? entry.kind
          : 'negotiationSuccess',
      title: String(entry.title).slice(0, 120),
      body: typeof entry.body === 'string' ? entry.body.slice(0, 240) : '',
      projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
    }))
    .slice(0, 40);
  if (!Array.isArray(manager.activeProjects)) manager.activeProjects = defaults.activeProjects;
  for (const project of manager.activeProjects) {
    if (!isRecord(project.castRequirements)) {
      project.castRequirements = { actorCount: 1, actressCount: 0 };
    }
    if (!Number.isFinite(project.castRequirements.actorCount)) project.castRequirements.actorCount = 1;
    if (!Number.isFinite(project.castRequirements.actressCount)) project.castRequirements.actressCount = 0;
    project.castRequirements.actorCount = Math.max(0, Math.round(project.castRequirements.actorCount));
    project.castRequirements.actressCount = Math.max(0, Math.round(project.castRequirements.actressCount));

    if (!isRecord(project.budgetPlan)) {
      const fallbackDirector = Math.round(project.budget.ceiling * 0.1);
      const fallbackCastActor = Math.round(project.budget.ceiling * 0.15 * Math.max(0, project.castRequirements.actorCount));
      const fallbackCastActress = Math.round(project.budget.ceiling * 0.15 * Math.max(0, project.castRequirements.actressCount));
      project.budgetPlan = {
        directorPlanned: fallbackDirector,
        castPlannedTotal: fallbackCastActor + fallbackCastActress,
        castPlannedActor: fallbackCastActor,
        castPlannedActress: fallbackCastActress,
      };
    }
    if (!Number.isFinite(project.budgetPlan.directorPlanned)) project.budgetPlan.directorPlanned = Math.round(project.budget.ceiling * 0.1);
    if (!Number.isFinite(project.budgetPlan.castPlannedActor)) {
      project.budgetPlan.castPlannedActor = Math.round(project.budget.ceiling * 0.15 * Math.max(0, project.castRequirements.actorCount));
    }
    if (!Number.isFinite(project.budgetPlan.castPlannedActress)) {
      project.budgetPlan.castPlannedActress = Math.round(project.budget.ceiling * 0.15 * Math.max(0, project.castRequirements.actressCount));
    }
    if (!Number.isFinite(project.budgetPlan.castPlannedTotal)) {
      project.budgetPlan.castPlannedTotal = project.budgetPlan.castPlannedActor + project.budgetPlan.castPlannedActress;
    }
    project.budgetPlan.directorPlanned = Math.max(0, Math.round(project.budgetPlan.directorPlanned));
    project.budgetPlan.castPlannedActor = Math.max(0, Math.round(project.budgetPlan.castPlannedActor));
    project.budgetPlan.castPlannedActress = Math.max(0, Math.round(project.budgetPlan.castPlannedActress));
    project.budgetPlan.castPlannedTotal = Math.max(
      0,
      Math.round(Math.max(project.budgetPlan.castPlannedTotal, project.budgetPlan.castPlannedActor + project.budgetPlan.castPlannedActress))
    );

    if (
      project.phase !== 'released' &&
      project.releaseWindow &&
      project.releaseWindow !== 'wideTheatrical' &&
      project.releaseWindow !== 'limitedTheatrical'
    ) {
      project.releaseWindow = null;
    }
    if (typeof project.releaseWeekLocked !== 'boolean') project.releaseWeekLocked = false;
    if (!Number.isFinite(project.editorialScore)) project.editorialScore = 5;
    project.editorialScore = Math.min(10, Math.max(0, project.editorialScore));
    if (!Number.isFinite(project.postPolishPasses)) project.postPolishPasses = 0;
    project.postPolishPasses = Math.min(2, Math.max(0, Math.round(project.postPolishPasses)));
    if (!Number.isFinite(project.awardsNominations)) project.awardsNominations = 0;
    if (!Number.isFinite(project.awardsWins)) project.awardsWins = 0;
    project.awardsNominations = Math.max(0, Math.round(project.awardsNominations));
    project.awardsWins = Math.max(0, Math.round(project.awardsWins));
    if (!['none', 'submitted', 'selected', 'buzzed', 'snubbed'].includes(project.festivalStatus)) {
      project.festivalStatus = 'none';
    }
    if (typeof project.festivalTarget !== 'string' && project.festivalTarget !== null) {
      project.festivalTarget = null;
    }
    if (!Number.isFinite(project.festivalSubmissionWeek)) project.festivalSubmissionWeek = null;
    if (!Number.isFinite(project.festivalResolutionWeek)) project.festivalResolutionWeek = null;
    if (!Number.isFinite(project.festivalBuzz)) project.festivalBuzz = 0;
    project.festivalBuzz = Math.min(100, Math.max(0, Math.round(project.festivalBuzz)));
    if (typeof project.franchiseId !== 'string' && project.franchiseId !== null) {
      project.franchiseId = null;
    }
    if (!Number.isFinite(project.franchiseEpisode)) project.franchiseEpisode = null;
    if (project.franchiseEpisode !== null) {
      project.franchiseEpisode = Math.max(1, Math.round(project.franchiseEpisode));
    }
    if (typeof project.sequelToProjectId !== 'string' && project.sequelToProjectId !== null) {
      project.sequelToProjectId = null;
    }
    if (!Number.isFinite(project.franchiseCarryoverHype)) project.franchiseCarryoverHype = 0;
    project.franchiseCarryoverHype = Math.min(100, Math.max(0, Math.round(project.franchiseCarryoverHype)));
    if (!['none', 'safe', 'balanced', 'reinvention'].includes(project.franchiseStrategy)) {
      project.franchiseStrategy = project.franchiseId ? 'balanced' : 'none';
    }
    if (typeof project.greenlightApproved !== 'boolean') project.greenlightApproved = false;
    if (!Number.isFinite(project.greenlightWeek)) project.greenlightWeek = null;
    if (!Number.isFinite(project.greenlightFeePaid)) project.greenlightFeePaid = 0;
    if (!Number.isFinite(project.greenlightLockedCeiling)) project.greenlightLockedCeiling = null;
    if (!Number.isFinite(project.sentBackForRewriteCount)) project.sentBackForRewriteCount = 0;
    if (typeof project.testScreeningCompleted !== 'boolean') project.testScreeningCompleted = false;
    if (!Number.isFinite(project.testScreeningWeek)) project.testScreeningWeek = null;
    if (!Number.isFinite(project.testScreeningCriticalLow)) project.testScreeningCriticalLow = null;
    if (!Number.isFinite(project.testScreeningCriticalHigh)) project.testScreeningCriticalHigh = null;
    if (
      project.testScreeningAudienceSentiment !== 'weak' &&
      project.testScreeningAudienceSentiment !== 'mixed' &&
      project.testScreeningAudienceSentiment !== 'strong'
    ) {
      project.testScreeningAudienceSentiment = null;
    }
    if (!Number.isFinite(project.reshootCount)) project.reshootCount = 0;
    if (!Number.isFinite(project.trackingProjectionOpening)) project.trackingProjectionOpening = null;
    if (!Number.isFinite(project.trackingConfidence)) project.trackingConfidence = null;
    if (!Number.isFinite(project.trackingLeverageAmount)) project.trackingLeverageAmount = 0;
    if (typeof project.trackingSettled !== 'boolean') project.trackingSettled = false;
    if (!Number.isFinite(project.merchandiseWeeksRemaining)) project.merchandiseWeeksRemaining = 0;
    if (!Number.isFinite(project.merchandiseWeeklyRevenue)) project.merchandiseWeeklyRevenue = 0;
    if (typeof project.adaptedFromIpId !== 'string' && project.adaptedFromIpId !== null) project.adaptedFromIpId = null;
  }
  if (!Array.isArray(manager.franchises)) manager.franchises = [];
  manager.franchises = manager.franchises
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string')
    .map((entry) => ({
      id: String(entry.id),
      name: typeof entry.name === 'string' ? entry.name : 'Untitled Franchise',
      genre: typeof entry.genre === 'string' ? entry.genre : 'drama',
      rootProjectId: typeof entry.rootProjectId === 'string' ? entry.rootProjectId : '',
      projectIds: Array.isArray(entry.projectIds)
        ? entry.projectIds.filter((id): id is string => typeof id === 'string')
        : [],
      releasedProjectIds: Array.isArray(entry.releasedProjectIds)
        ? entry.releasedProjectIds.filter((id): id is string => typeof id === 'string')
        : [],
      activeProjectId: typeof entry.activeProjectId === 'string' || entry.activeProjectId === null ? entry.activeProjectId : null,
      momentum: Number.isFinite(entry.momentum) ? Math.min(100, Math.max(0, Number(entry.momentum))) : 40,
      fatigue: Number.isFinite(entry.fatigue) ? Math.min(100, Math.max(0, Number(entry.fatigue))) : 10,
      lastReleaseWeek: Number.isFinite(entry.lastReleaseWeek) ? Math.max(1, Math.round(entry.lastReleaseWeek as number)) : null,
      cadenceBufferWeeks: Number.isFinite(entry.cadenceBufferWeeks)
        ? Math.min(40, Math.max(0, Math.round(entry.cadenceBufferWeeks as number)))
        : 0,
      brandResetCount: Number.isFinite(entry.brandResetCount) ? Math.max(0, Math.round(entry.brandResetCount as number)) : 0,
      legacyCastingCampaignCount: Number.isFinite(entry.legacyCastingCampaignCount)
        ? Math.max(0, Math.round(entry.legacyCastingCampaignCount as number))
        : 0,
      hiatusPlanCount: Number.isFinite(entry.hiatusPlanCount) ? Math.max(0, Math.round(entry.hiatusPlanCount as number)) : 0,
    }))
    .filter((franchise) => franchise.projectIds.length > 0);
  if (!Array.isArray(manager.talentPool)) manager.talentPool = createSeedTalentPool((manager as StudioManager & { talentSeed: number }).talentSeed);
  for (const talent of manager.talentPool) {
    const legacyAgentTierMap: Record<string, string> = {
      caa: 'aea',
      wme: 'wma',
      uta: 'tca',
    };
    if (typeof talent.agentTier === 'string' && legacyAgentTierMap[talent.agentTier]) {
      talent.agentTier = legacyAgentTierMap[talent.agentTier] as typeof talent.agentTier;
    }
    if (
      talent.agentTier !== 'aea' &&
      talent.agentTier !== 'wma' &&
      talent.agentTier !== 'tca' &&
      talent.agentTier !== 'independent'
    ) {
      talent.agentTier = 'independent';
    }

    if (!isRecord(talent.relationshipMemory)) {
      const baselineTrust = Math.round(Math.min(100, Math.max(0, 35 + talent.studioRelationship * 45)));
      const baselineLoyalty = Math.round(Math.min(100, Math.max(0, 30 + talent.studioRelationship * 40)));
      talent.relationshipMemory = {
        trust: baselineTrust,
        loyalty: baselineLoyalty,
        interactionHistory: [],
      };
    } else {
      if (!Number.isFinite(talent.relationshipMemory.trust)) talent.relationshipMemory.trust = 50;
      if (!Number.isFinite(talent.relationshipMemory.loyalty)) talent.relationshipMemory.loyalty = 50;
      talent.relationshipMemory.trust = Math.min(100, Math.max(0, Math.round(talent.relationshipMemory.trust)));
      talent.relationshipMemory.loyalty = Math.min(100, Math.max(0, Math.round(talent.relationshipMemory.loyalty)));
      if (!Array.isArray(talent.relationshipMemory.interactionHistory)) {
        talent.relationshipMemory.interactionHistory = [];
      }
      talent.relationshipMemory.interactionHistory = talent.relationshipMemory.interactionHistory
        .filter((entry) => isRecord(entry) && typeof entry.note === 'string')
        .slice(-MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX)
        .map((entry) => ({
          week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
          kind: typeof entry.kind === 'string' ? entry.kind : 'negotiationOpened',
          trustDelta: Number.isFinite(entry.trustDelta) ? Math.round(entry.trustDelta as number) : 0,
          loyaltyDelta: Number.isFinite(entry.loyaltyDelta) ? Math.round(entry.loyaltyDelta as number) : 0,
          note: String(entry.note),
          projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
        }));
    }
    talent.studioRelationship = Math.min(
      1,
      Math.max(0, (talent.relationshipMemory.trust * 0.62 + talent.relationshipMemory.loyalty * 0.38) / 100)
    );
    if (!Number.isFinite(talent.marketWindowExpiresWeek)) {
      talent.marketWindowExpiresWeek = null;
    }
    if (talent.marketWindowExpiresWeek !== null) {
      talent.marketWindowExpiresWeek = Math.max(manager.currentWeek, Math.round(talent.marketWindowExpiresWeek));
    }
  }
  if (!Array.isArray(manager.scriptMarket)) manager.scriptMarket = defaults.scriptMarket;
  if (manager.scriptMarket.length > scriptMarketTargetOffers) {
    manager.scriptMarket = manager.scriptMarket.slice(0, scriptMarketTargetOffers);
  }
  manager.scriptMarket = manager.scriptMarket
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string')
    .map((entry) => ({
      id: String(entry.id),
      title: String(entry.title),
      genre: typeof entry.genre === 'string' ? entry.genre : 'drama',
      ...(entry.marketTier === 'bargain' || entry.marketTier === 'standard' || entry.marketTier === 'biddingWar'
        ? { marketTier: entry.marketTier }
        : {}),
      askingPrice: Number.isFinite(entry.askingPrice) ? Math.max(25_000, Math.round(Number(entry.askingPrice))) : 300_000,
      scriptQuality: Number.isFinite(entry.scriptQuality) ? Math.min(9.9, Math.max(1, Number(entry.scriptQuality))) : 7,
      conceptStrength: Number.isFinite(entry.conceptStrength) ? Math.min(9.9, Math.max(1, Number(entry.conceptStrength))) : 7,
      logline: typeof entry.logline === 'string' ? entry.logline : '',
      expiresInWeeks: Number.isFinite(entry.expiresInWeeks) ? Math.max(0, Math.round(Number(entry.expiresInWeeks))) : 3,
    }))
    .slice(0, scriptMarketTargetOffers);
  if (manager.scriptMarket.length === 0) {
    const managerWithRefill = manager as unknown as { refillScriptMarket?: (events: string[]) => void };
    if (typeof managerWithRefill.refillScriptMarket === 'function') {
      managerWithRefill.refillScriptMarket([]);
    }
  }
  const managerWithMarketRefresh = manager as unknown as { refreshTalentMarket?: () => void };
  const visibleTalent = manager.talentPool.filter(
    (talent) => talent.availability === 'available' && talent.marketWindowExpiresWeek !== null
  ).length;
  if (visibleTalent === 0 && typeof managerWithMarketRefresh.refreshTalentMarket === 'function') {
    managerWithMarketRefresh.refreshTalentMarket();
  }
  if (!Array.isArray(manager.rivals)) manager.rivals = defaults.rivals;
  for (const rival of manager.rivals) {
    const baseline = defaults.rivals.find((item) => item.personality === rival.personality) ?? defaults.rivals[0];
    rival.calendarPressureLockUntilWeek = Number.isFinite(rival.calendarPressureLockUntilWeek)
      ? Math.round(rival.calendarPressureLockUntilWeek as number)
      : null;
    if (rival.calendarPressureLockUntilWeek !== null && rival.calendarPressureLockUntilWeek < manager.currentWeek) {
      rival.calendarPressureLockUntilWeek = null;
    }
    rival.lastPressuredProjectId = typeof rival.lastPressuredProjectId === 'string' ? rival.lastPressuredProjectId : null;
    if (!isRecord(rival.memory)) {
      rival.memory = {
        hostility: baseline.memory.hostility,
        respect: baseline.memory.respect,
        retaliationBias: baseline.memory.retaliationBias,
        cooperationBias: baseline.memory.cooperationBias,
        interactionHistory: [],
      };
    } else {
      if (!Number.isFinite(rival.memory.hostility)) rival.memory.hostility = baseline.memory.hostility;
      if (!Number.isFinite(rival.memory.respect)) rival.memory.respect = baseline.memory.respect;
      if (!Number.isFinite(rival.memory.retaliationBias)) rival.memory.retaliationBias = baseline.memory.retaliationBias;
      if (!Number.isFinite(rival.memory.cooperationBias)) rival.memory.cooperationBias = baseline.memory.cooperationBias;
      rival.memory.hostility = Math.min(100, Math.max(0, Math.round(rival.memory.hostility)));
      rival.memory.respect = Math.min(100, Math.max(0, Math.round(rival.memory.respect)));
      rival.memory.retaliationBias = Math.min(100, Math.max(0, Math.round(rival.memory.retaliationBias)));
      rival.memory.cooperationBias = Math.min(100, Math.max(0, Math.round(rival.memory.cooperationBias)));
      if (!Array.isArray(rival.memory.interactionHistory)) rival.memory.interactionHistory = [];
      rival.memory.interactionHistory = rival.memory.interactionHistory
        .filter((entry) => isRecord(entry) && typeof entry.note === 'string')
        .slice(-MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX)
        .map((entry) => ({
          week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
          kind: typeof entry.kind === 'string' ? entry.kind : 'counterplayEscalation',
          hostilityDelta: Number.isFinite(entry.hostilityDelta) ? Math.round(entry.hostilityDelta as number) : 0,
          respectDelta: Number.isFinite(entry.respectDelta) ? Math.round(entry.respectDelta as number) : 0,
          note: String(entry.note),
          projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
        }));
    }
  }
  if (!Array.isArray(manager.industryNewsLog)) manager.industryNewsLog = [];
  if (!isRecord(manager.genreCycles)) manager.genreCycles = defaults.genreCycles;
  for (const genre of Object.keys(defaults.genreCycles) as MovieGenre[]) {
    const defaultState = defaults.genreCycles[genre];
    const raw = (manager.genreCycles as Record<string, unknown>)[genre];
    if (!isRecord(raw)) {
      manager.genreCycles[genre] = { ...defaultState };
      continue;
    }
    const demand = Number.isFinite(raw.demand) ? Number(raw.demand) : defaultState.demand;
    const momentum = Number.isFinite(raw.momentum) ? Number(raw.momentum) : defaultState.momentum;
    const shockDirection =
      raw.shockDirection === 'surge' || raw.shockDirection === 'slump' ? raw.shockDirection : null;
    const shockLabel = typeof raw.shockLabel === 'string' ? raw.shockLabel.slice(0, 80) : null;
    const shockStrength = Number.isFinite(raw.shockStrength) ? Number(raw.shockStrength) : null;
    const rawShockUntilWeek = Number.isFinite(raw.shockUntilWeek) ? Number(raw.shockUntilWeek) : null;
    const hasActiveShock =
      !!shockDirection &&
      !!shockLabel &&
      shockStrength !== null &&
      rawShockUntilWeek !== null &&
      rawShockUntilWeek >= manager.currentWeek;
    manager.genreCycles[genre] = {
      demand: Math.min(1.4, Math.max(0.68, demand)),
      momentum: Math.min(0.06, Math.max(-0.06, momentum)),
      shockDirection: hasActiveShock ? shockDirection : null,
      shockLabel: hasActiveShock ? shockLabel : null,
      shockStrength: hasActiveShock ? Math.min(0.04, Math.max(0.005, shockStrength)) : null,
      shockUntilWeek: hasActiveShock ? Math.round(rawShockUntilWeek) : null,
    };
  }
  if (!Array.isArray(manager.awardsHistory)) manager.awardsHistory = [];
  manager.awardsHistory = manager.awardsHistory
    .filter((entry) => isRecord(entry) && Array.isArray(entry.results))
    .map((entry) => ({
      seasonYear: Number.isFinite(entry.seasonYear) ? Math.max(1, Math.round(entry.seasonYear as number)) : 1,
      week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
      showName: typeof entry.showName === 'string' ? entry.showName : 'Global Film Honors',
      headline: typeof entry.headline === 'string' ? entry.headline : 'Awards season update.',
      results: (entry.results as unknown[])
        .filter((result): result is Record<string, unknown> => isRecord(result) && typeof result.title === 'string')
        .map((result) => ({
          projectId: typeof result.projectId === 'string' ? result.projectId : 'unknown',
          title: String(result.title),
          nominations: Number.isFinite(result.nominations) ? Math.max(0, Math.round(result.nominations as number)) : 0,
          wins: Number.isFinite(result.wins) ? Math.max(0, Math.round(result.wins as number)) : 0,
          score: Number.isFinite(result.score) ? Math.max(0, Math.min(100, Number(result.score))) : 0,
        })),
    }))
    .slice(0, 24);
  if (!Array.isArray(manager.awardsSeasonsProcessed)) manager.awardsSeasonsProcessed = [];
  manager.awardsSeasonsProcessed = manager.awardsSeasonsProcessed
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(1, Math.round(value)))
    .slice(-20);
  if (!Array.isArray(manager.studioChronicle)) manager.studioChronicle = [];
  manager.studioChronicle = manager.studioChronicle
    .filter((entry) => isRecord(entry) && typeof entry.headline === 'string')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : `chron-${Math.random().toString(36).slice(2, 10)}`,
      week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
      type: (['filmRelease', 'arcResolution', 'tierAdvance', 'awardsOutcome', 'festivalOutcome', 'crisisResolved', 'studioFounding'] as string[]).includes(entry.type as string)
        ? (entry.type as ChronicleEntryType)
        : ('filmRelease' as ChronicleEntryType),
      headline: String(entry.headline).slice(0, 200),
      ...(typeof entry.detail === 'string' ? { detail: entry.detail.slice(0, 200) } : {}),
      ...(typeof entry.projectTitle === 'string' ? { projectTitle: entry.projectTitle } : {}),
      impact: (['positive', 'negative', 'neutral'] as string[]).includes(entry.impact as string)
        ? (entry.impact as ChronicleEntryImpact)
        : ('neutral' as ChronicleEntryImpact),
    }))
    .slice(0, 100);
  if (!Array.isArray(manager.releaseReports)) manager.releaseReports = [];
  manager.releaseReports = manager.releaseReports
    .filter((entry) => isRecord(entry) && typeof entry.title === 'string')
    .map((entry) => ({
      projectId: typeof entry.projectId === 'string' ? entry.projectId : 'unknown',
      title: String(entry.title).slice(0, 100),
      weekResolved: Number.isFinite(entry.weekResolved) ? Math.max(1, Math.round(entry.weekResolved as number)) : manager.currentWeek,
      totalBudget: Number.isFinite(entry.totalBudget) ? Math.max(0, Math.round(entry.totalBudget as number)) : 0,
      totalGross: Number.isFinite(entry.totalGross) ? Math.max(0, Math.round(entry.totalGross as number)) : 0,
      studioNet: Number.isFinite(entry.studioNet) ? Math.round(entry.studioNet as number) : 0,
      profit: Number.isFinite(entry.profit) ? Math.round(entry.profit as number) : 0,
      roi: Number.isFinite(entry.roi) ? Number(entry.roi) : 0,
      openingWeekend: Number.isFinite(entry.openingWeekend) ? Math.max(0, Math.round(entry.openingWeekend as number)) : 0,
      critics: Number.isFinite(entry.critics) ? Math.max(0, Math.min(100, Math.round(entry.critics as number))) : 0,
      audience: Number.isFinite(entry.audience) ? Math.max(0, Math.min(100, Math.round(entry.audience as number))) : 0,
      outcome: entry.outcome === 'blockbuster' || entry.outcome === 'hit' || entry.outcome === 'flop' ? entry.outcome : 'hit',
      wasRecordOpening: !!entry.wasRecordOpening,
      breakdown: isRecord(entry.breakdown)
        ? {
            script: Number.isFinite(entry.breakdown.script) ? Math.round(entry.breakdown.script as number) : 0,
            direction: Number.isFinite(entry.breakdown.direction) ? Math.round(entry.breakdown.direction as number) : 0,
            starPower: Number.isFinite(entry.breakdown.starPower) ? Math.round(entry.breakdown.starPower as number) : 0,
            marketing: Number.isFinite(entry.breakdown.marketing) ? Math.round(entry.breakdown.marketing as number) : 0,
            timing: Number.isFinite(entry.breakdown.timing) ? Math.round(entry.breakdown.timing as number) : 0,
            genreCycle: Number.isFinite(entry.breakdown.genreCycle) ? Math.round(entry.breakdown.genreCycle as number) : 0,
          }
        : { script: 0, direction: 0, starPower: 0, marketing: 0, timing: 0, genreCycle: 0 },
    }))
    .slice(0, 60);
  if (!Array.isArray(manager.milestones)) manager.milestones = [];
  manager.milestones = manager.milestones
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string')
    .map((entry) => ({
      id: entry.id,
      title: String(entry.title),
      description: typeof entry.description === 'string' ? entry.description : '',
      unlockedWeek: Number.isFinite(entry.unlockedWeek) ? Math.max(1, Math.round(entry.unlockedWeek as number)) : manager.currentWeek,
      value: Number.isFinite(entry.value) ? Number(entry.value) : undefined,
    }))
    .slice(0, 30);
  if (!Array.isArray(manager.ownedIps)) manager.ownedIps = [];
  manager.ownedIps = manager.ownedIps
    .filter((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.name === 'string')
    .map((entry) => ({
      id: String(entry.id),
      name: String(entry.name),
      kind:
        entry.kind === 'book' || entry.kind === 'game' || entry.kind === 'comic' || entry.kind === 'superhero'
          ? entry.kind
          : 'book',
      genre: typeof entry.genre === 'string' ? entry.genre : 'drama',
      acquisitionCost: Number.isFinite(entry.acquisitionCost) ? Math.max(0, Math.round(entry.acquisitionCost as number)) : 0,
      qualityBonus: Number.isFinite(entry.qualityBonus) ? Number(entry.qualityBonus) : 0,
      hypeBonus: Number.isFinite(entry.hypeBonus) ? Number(entry.hypeBonus) : 0,
      prestigeBonus: Number.isFinite(entry.prestigeBonus) ? Number(entry.prestigeBonus) : 0,
      commercialBonus: Number.isFinite(entry.commercialBonus) ? Number(entry.commercialBonus) : 0,
      expiresWeek: Number.isFinite(entry.expiresWeek) ? Math.max(1, Math.round(entry.expiresWeek as number)) : manager.currentWeek + 8,
      usedProjectId: typeof entry.usedProjectId === 'string' || entry.usedProjectId === null ? entry.usedProjectId : null,
      major: !!entry.major,
    }))
    .slice(0, 20);
  if (!Array.isArray(manager.playerNegotiations)) manager.playerNegotiations = [];
  manager.playerNegotiations = manager.playerNegotiations
    .filter(
      (entry) =>
        isRecord(entry) &&
        typeof entry.talentId === 'string' &&
        typeof entry.projectId === 'string'
    )
    .map((entry) => ({
      talentId: String(entry.talentId),
      projectId: String(entry.projectId),
      openedWeek: Number.isFinite(entry.openedWeek)
        ? Math.min(manager.currentWeek, Math.max(1, Math.round(Number(entry.openedWeek))))
        : manager.currentWeek,
      rounds: Number.isFinite(entry.rounds) ? Math.max(0, Math.round(Number(entry.rounds))) : 0,
      holdLineCount: Number.isFinite(entry.holdLineCount) ? Math.max(0, Math.round(Number(entry.holdLineCount))) : 0,
      ...(Number.isFinite(entry.offerSalaryMultiplier) ? { offerSalaryMultiplier: Number(entry.offerSalaryMultiplier) } : {}),
      ...(Number.isFinite(entry.offerBackendPoints) ? { offerBackendPoints: Number(entry.offerBackendPoints) } : {}),
      ...(Number.isFinite(entry.offerPerksBudget) ? { offerPerksBudget: Math.max(0, Number(entry.offerPerksBudget)) } : {}),
      ...(Number.isFinite(entry.lastComputedChance) ? { lastComputedChance: Number(entry.lastComputedChance) } : {}),
      ...(typeof entry.lastResponse === 'string' ? { lastResponse: entry.lastResponse } : {}),
    }))
    .slice(0, 40);
  if (!Array.isArray(manager.recentDecisionCategories)) manager.recentDecisionCategories = [];

  if (!isRecord(manager.storyFlags)) manager.storyFlags = {};
  if (!isRecord(manager.storyArcs)) manager.storyArcs = {};
  if (
    manager.lastWeekSummary &&
    (!Number.isFinite(manager.lastWeekSummary.week) ||
      !Number.isFinite(manager.lastWeekSummary.cashDelta) ||
      !Array.isArray(manager.lastWeekSummary.events))
  ) {
    manager.lastWeekSummary = null;
  }
}

export const SERIALIZE_MANAGER_KEYS = [
  'studioName',
  'cash',
  'reputation',
  'isBankrupt',
  'bankruptcyReason',
  'consecutiveLowCashWeeks',
  'firstSessionComplete',
  'currentWeek',
  'turnLengthWeeks',
  'pendingCrises',
  'distributionOffers',
  'pendingReleaseReveals',
  'decisionQueue',
  'inboxNotifications',
  'activeProjects',
  'franchises',
  'talentSeed',
  'talentPool',
  'scriptMarket',
  'rivals',
  'industryNewsLog',
  'playerNegotiations',
  'storyFlags',
  'storyArcs',
  'recentDecisionCategories',
  'lastWeekSummary',
  'awardsHistory',
  'awardsSeasonsProcessed',
  'genreCycles',
  'studioChronicle',
  'releaseReports',
  'pendingFinalReleaseReveals',
  'milestones',
  'lifetimeRevenue',
  'lifetimeProfit',
  'lifetimeExpenses',
  'marketingTeamLevel',
  'ownedIps',
  'studioCapacityUpgrades',
  'studioSpecialization',
  'pendingSpecialization',
  'specializationCommittedWeek',
  'foundingProfile',
  'needsFoundingSetup',
  'foundingSetupCompletedWeek',
  'animationDivisionUnlocked',
  'lastGeneratedCrisisWeek',
  'generatedCrisisThisTurn',
  'lastScaleOverheadWeek',
  'tutorialState',
  'tutorialCompleted',
  'tutorialDismissed',
  'departmentLevels',
  'exclusiveDistributionPartner',
  'exclusivePartnerUntilWeek',
  'executiveNetworkLevel',
  'marketInitialized',
  'lastMarketBurstWeek',
  'marketDirectorIdx',
  'marketActorIdx',
  'marketLeadActorIdx',
  'marketLeadActressIdx',
] as const;

export function serializeStudioManager(manager: StudioManager): StoredManager {
  const serialized: StoredManager = {};
  const source = manager as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    serialized[key] = source[key];
  }

  const sourceLastEventWeek = (manager as unknown as { lastEventWeek?: unknown }).lastEventWeek;
  if (sourceLastEventWeek instanceof Map) {
    serialized.lastEventWeek = Array.from(sourceLastEventWeek.entries()).filter(
      (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number'
    );
  }

  return serialized;
}

/**
 * Copies only data fields from `source` into `target`, leaving target's service
 * bindings intact. Use this instead of Object.assign when hydrating a manager
 * whose services must stay bound to `target` (not the source).
 *
 * Object.assign would overwrite the private service fields (eventService,
 * releaseService, etc.) with instances that hold `this.manager = source`.
 * Once any service replaces an array field on `source` the two managers diverge
 * silently, causing decisions and script offers to work on a shadow copy that
 * the store and UI never see.
 */
export function hydrateManagerData(target: StudioManager, source: StudioManager): void {
  const src = source as unknown as Record<string, unknown>;
  const tgt = target as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    tgt[key] = src[key];
  }
  // lastEventWeek is a readonly Map — mutate it in-place rather than replacing the reference.
  const srcMap = src.lastEventWeek as Map<string, number> | undefined;
  const tgtMap = tgt.lastEventWeek as Map<string, number>;
  tgtMap.clear();
  if (srcMap instanceof Map) {
    for (const [k, v] of srcMap) {
      tgtMap.set(k, v);
    }
  }
}

export function restoreStudioManager(input: StoredManager): StudioManager {
  const manager = new StudioManager();
  const target = manager as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    if (Object.hasOwn(input, key)) {
      target[key] = input[key];
    }
  }
  if (!Object.hasOwn(input, 'foundingProfile')) {
    manager.foundingProfile = 'none';
  }
  if (!Object.hasOwn(input, 'needsFoundingSetup')) {
    manager.needsFoundingSetup = false;
  }
  if (!Object.hasOwn(input, 'foundingSetupCompletedWeek')) {
    manager.foundingSetupCompletedWeek = null;
  }
  if (!Object.hasOwn(input, 'animationDivisionUnlocked')) {
    manager.animationDivisionUnlocked = false;
  }
  if (!Object.hasOwn(input, 'lastGeneratedCrisisWeek')) {
    manager.lastGeneratedCrisisWeek = null;
  }
  if (!Object.hasOwn(input, 'generatedCrisisThisTurn')) {
    manager.generatedCrisisThisTurn = false;
  }
  if (!Object.hasOwn(input, 'lastScaleOverheadWeek')) {
    manager.lastScaleOverheadWeek = 1;
  }
  if (
    !Object.hasOwn(input, 'tutorialState') &&
    !Object.hasOwn(input, 'tutorialCompleted') &&
    !Object.hasOwn(input, 'tutorialDismissed')
  ) {
    manager.tutorialState = 'complete';
    manager.tutorialCompleted = true;
    manager.tutorialDismissed = false;
  }

  // Migrate old saves that had studioHeat but no reputation
  if (!('reputation' in input) && typeof input.studioHeat === 'number') {
    const legacyHeat = Math.min(100, Math.max(0, input.studioHeat));
    manager.reputation = { critics: legacyHeat, talent: legacyHeat, distributor: legacyHeat, audience: legacyHeat };
  }

  sanitizeRestoredManager(manager);

  // Migrate talent lifecycle fields for saves predating generational talent
  for (const talent of manager.talentPool) {
    const t = talent as unknown as Record<string, unknown>;
    if (typeof t.birthWeek !== 'number') {
      const craft = typeof t.craftScore === 'number' ? t.craftScore : 5;
      const estimatedAge = 25 + Math.round(craft * 3.5);
      t.birthWeek = manager.currentWeek - estimatedAge * 52;
    }
    if (t.status !== 'active' && t.status !== 'retired' && t.status !== 'deceased') {
      t.status = 'active';
    }
    if (typeof t.retiredWeek !== 'number') {
      t.retiredWeek = null;
    }
  }

  const sourceLastEventWeek = input.lastEventWeek;
  const targetLastEventWeek = (manager as unknown as { lastEventWeek: Map<string, number> }).lastEventWeek;

  if (Array.isArray(sourceLastEventWeek)) {
    for (const entry of sourceLastEventWeek) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      if (typeof entry[0] !== 'string' || typeof entry[1] !== 'number') continue;
      targetLastEventWeek.set(entry[0], entry[1]);
    }
  } else if (sourceLastEventWeek && typeof sourceLastEventWeek === 'object') {
    for (const [eventId, week] of Object.entries(sourceLastEventWeek)) {
      if (typeof week === 'number') {
        targetLastEventWeek.set(eventId, week);
      }
    }
  }

  return manager;
}

export async function loadManagerFromStorage(): Promise<StudioManager | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveEnvelope;
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.manager) return null;
    return restoreStudioManager(parsed.manager);
  } catch {
    return null;
  }
}

export async function saveManagerToStorage(manager: StudioManager): Promise<void> {
  const serializedManager = serializeStudioManager(manager);
  await saveSerializedManagerToStorage(serializedManager);
}

export async function saveSerializedManagerToStorage(serializedManager: StoredManager): Promise<void> {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    manager: serializedManager,
  };
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}
