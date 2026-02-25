import type { DecisionItem, MovieProject, RivalStudio, ScriptPitch, Talent } from './types';
import { createId } from './id';

function createInitialRelationship(studioRelationship: number): Talent['relationshipMemory'] {
  const trust = Math.round(Math.min(100, Math.max(0, 35 + studioRelationship * 45)));
  const loyalty = Math.round(Math.min(100, Math.max(0, 30 + studioRelationship * 40)));
  return {
    trust,
    loyalty,
    interactionHistory: [],
  };
}

function createInitialRivalMemory(
  personality: RivalStudio['personality']
): RivalStudio['memory'] {
  const baseHostility =
    personality === 'blockbusterFactory' ? 58 : personality === 'scrappyUpstart' ? 55 : 50;
  const baseRespect =
    personality === 'prestigeHunter' ? 60 : personality === 'genreSpecialist' ? 56 : 52;
  return {
    hostility: baseHostility,
    respect: baseRespect,
    retaliationBias: 50,
    cooperationBias: 45,
    interactionHistory: [],
  };
}

export function createSeedTalentPool(): Talent[] {
  return [
    {
      id: createId('talent'),
      name: 'Rhea Colton',
      role: 'director',
      starPower: 6.8,
      craftScore: 8.2,
      genreFit: { thriller: 0.95, drama: 0.88, horror: 0.8 },
      egoLevel: 5.2,
      salary: { base: 2_000_000, backendPoints: 2, perksCost: 200_000 },
      availability: 'available',
      unavailableUntilWeek: null,
      attachedProjectId: null,
      reputation: 74,
      agentTier: 'wme',
      studioRelationship: 0.2,
      relationshipMemory: createInitialRelationship(0.2),
    },
    {
      id: createId('talent'),
      name: 'Noah Kade',
      role: 'leadActor',
      starPower: 7.3,
      craftScore: 7.4,
      genreFit: { action: 0.9, thriller: 0.82, drama: 0.7 },
      egoLevel: 6.3,
      salary: { base: 3_500_000, backendPoints: 3, perksCost: 350_000 },
      availability: 'available',
      unavailableUntilWeek: null,
      attachedProjectId: null,
      reputation: 70,
      agentTier: 'caa',
      studioRelationship: 0.1,
      relationshipMemory: createInitialRelationship(0.1),
    },
    {
      id: createId('talent'),
      name: 'Mila Soren',
      role: 'leadActor',
      starPower: 5.9,
      craftScore: 8.6,
      genreFit: { drama: 0.95, comedy: 0.72, documentary: 0.6 },
      egoLevel: 3.1,
      salary: { base: 1_800_000, backendPoints: 1.5, perksCost: 120_000 },
      availability: 'available',
      unavailableUntilWeek: null,
      attachedProjectId: null,
      reputation: 78,
      agentTier: 'independent',
      studioRelationship: 0.35,
      relationshipMemory: createInitialRelationship(0.35),
    },
  ];
}

export function createSeedProjects(): MovieProject[] {
  return [
    {
      id: createId('project'),
      title: 'Night Ledger',
      genre: 'thriller',
      phase: 'production',
      budget: {
        ceiling: 24_000_000,
        aboveTheLine: 7_800_000,
        belowTheLine: 11_400_000,
        postProduction: 3_200_000,
        contingency: 1_600_000,
        overrunRisk: 0.38,
        actualSpend: 9_500_000,
      },
      scriptQuality: 7.4,
      conceptStrength: 7.1,
      editorialScore: 5,
      postPolishPasses: 0,
      directorId: null,
      castIds: [],
      productionStatus: 'onTrack',
      scheduledWeeksRemaining: 12,
      hypeScore: 33,
      marketingBudget: 2_000_000,
      releaseWindow: null,
      releaseWeek: null,
      distributionPartner: null,
      studioRevenueShare: 0.52,
      projectedROI: 1.52,
      openingWeekendGross: null,
      weeklyGrossHistory: [],
      releaseWeeksRemaining: 0,
      releaseResolved: false,
      finalBoxOffice: null,
      criticalScore: null,
      audienceScore: null,
      awardsNominations: 0,
      awardsWins: 0,
      festivalStatus: 'none',
      festivalTarget: null,
      festivalSubmissionWeek: null,
      festivalResolutionWeek: null,
      festivalBuzz: 0,
      prestige: 42,
      commercialAppeal: 68,
      originality: 57,
      controversy: 28,
      franchiseId: null,
      franchiseEpisode: null,
      sequelToProjectId: null,
      franchiseCarryoverHype: 0,
      franchiseStrategy: 'none',
    },
    {
      id: createId('project'),
      title: 'Blue Ember',
      genre: 'drama',
      phase: 'development',
      budget: {
        ceiling: 12_000_000,
        aboveTheLine: 3_800_000,
        belowTheLine: 5_400_000,
        postProduction: 1_700_000,
        contingency: 1_100_000,
        overrunRisk: 0.26,
        actualSpend: 500_000,
      },
      scriptQuality: 8.1,
      conceptStrength: 6.8,
      editorialScore: 5,
      postPolishPasses: 0,
      directorId: null,
      castIds: [],
      productionStatus: 'onTrack',
      scheduledWeeksRemaining: 18,
      hypeScore: 18,
      marketingBudget: 0,
      releaseWindow: null,
      releaseWeek: null,
      distributionPartner: null,
      studioRevenueShare: 0.52,
      projectedROI: 1.18,
      openingWeekendGross: null,
      weeklyGrossHistory: [],
      releaseWeeksRemaining: 0,
      releaseResolved: false,
      finalBoxOffice: null,
      criticalScore: null,
      audienceScore: null,
      awardsNominations: 0,
      awardsWins: 0,
      festivalStatus: 'none',
      festivalTarget: null,
      festivalSubmissionWeek: null,
      festivalResolutionWeek: null,
      festivalBuzz: 0,
      prestige: 72,
      commercialAppeal: 37,
      originality: 64,
      controversy: 14,
      franchiseId: null,
      franchiseEpisode: null,
      sequelToProjectId: null,
      franchiseCarryoverHype: 0,
      franchiseStrategy: 'none',
    },
  ];
}

export function createOpeningDecisions(): DecisionItem[] {
  return [
    {
      id: createId('decision'),
      projectId: null,
      title: 'First Call: Script Doctor on Night Ledger',
      body: 'Welcome to the chair. Night Ledger is your flagship thriller already in production, with script quality at 7.4. A script doctor is offering a two-week polish sprint for $360K that could push quality to 8.2 and improve awards and critic upside. Decisions like this expire if you advance too many weeks without resolving them.',
      weeksUntilExpiry: 3,
      category: 'creative',
      options: [
        {
          id: createId('option'),
          label: 'Fund the Sprint',
          preview: 'Script quality +0.8 - brings Night Ledger to 8.2, a strong prestige threshold.',
          cashDelta: -360_000,
          scriptQualityDelta: 0.8,
          hypeDelta: 2,
          criticsDelta: 1,
        },
        {
          id: createId('option'),
          label: 'Pass for Now',
          preview: 'Save $360K. Night Ledger stays at current quality.',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: -1,
        },
      ],
    },
  ];
}

export function createSeedScriptMarket(): ScriptPitch[] {
  return [
    {
      id: createId('script'),
      title: 'Glass Harbor',
      genre: 'thriller',
      askingPrice: 360_000,
      scriptQuality: 7.8,
      conceptStrength: 7.2,
      logline: 'A washed-up forensic accountant uncovers a port-city cartel ledger tied to his family.',
      expiresInWeeks: 2,
    },
    {
      id: createId('script'),
      title: 'Murmur Theory',
      genre: 'sciFi',
      askingPrice: 520_000,
      scriptQuality: 7.1,
      conceptStrength: 8.4,
      logline: 'A quantum linguist discovers spoken language can alter local reality in tiny, dangerous ways.',
      expiresInWeeks: 3,
    },
    {
      id: createId('script'),
      title: 'Last Train Sunday',
      genre: 'drama',
      askingPrice: 220_000,
      scriptQuality: 8.3,
      conceptStrength: 6.4,
      logline: 'Three estranged siblings reunite over one weekend to decide the fate of their family theater.',
      expiresInWeeks: 2,
    },
  ];
}

export function createSeedRivals(): RivalStudio[] {
  return [
    {
      id: createId('rival'),
      name: 'Meridian Pictures',
      personality: 'prestigeHunter',
      studioHeat: 61,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
      memory: createInitialRivalMemory('prestigeHunter'),
    },
    {
      id: createId('rival'),
      name: 'Apex Global',
      personality: 'blockbusterFactory',
      studioHeat: 74,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
      memory: createInitialRivalMemory('blockbusterFactory'),
    },
    {
      id: createId('rival'),
      name: 'Neon Slate',
      personality: 'genreSpecialist',
      studioHeat: 56,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
      memory: createInitialRivalMemory('genreSpecialist'),
    },
    {
      id: createId('rival'),
      name: 'Harbor Road',
      personality: 'streamingFirst',
      studioHeat: 52,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
      memory: createInitialRivalMemory('streamingFirst'),
    },
    {
      id: createId('rival'),
      name: 'Freehold Films',
      personality: 'scrappyUpstart',
      studioHeat: 41,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
      memory: createInitialRivalMemory('scrappyUpstart'),
    },
  ];
}

