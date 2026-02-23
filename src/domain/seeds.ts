import type { DecisionItem, MovieProject, RivalStudio, ScriptPitch, Talent } from './types';

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSeedTalentPool(): Talent[] {
  return [
    {
      id: id('talent'),
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
    },
    {
      id: id('talent'),
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
    },
    {
      id: id('talent'),
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
    },
  ];
}

export function createSeedProjects(): MovieProject[] {
  return [
    {
      id: id('project'),
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
    },
    {
      id: id('project'),
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
    },
  ];
}

export function createOpeningDecisions(): DecisionItem[] {
  return [
    {
      id: id('decision'),
      projectId: null,
      title: 'Spec Script Offer: "Glass Harbor"',
      body: 'Asking price is $420K. Agency asks for answer within two weeks.',
      weeksUntilExpiry: 2,
      options: [
        {
          id: id('option'),
          label: 'Acquire Script',
          preview: 'Add a strong thriller script to development slate.',
          cashDelta: -420_000,
          scriptQualityDelta: 0.8,
          hypeDelta: 0,
        },
        {
          id: id('option'),
          label: 'Pass',
          preview: 'No spend this week, potential relationship hit with agency.',
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
      id: id('script'),
      title: 'Glass Harbor',
      genre: 'thriller',
      askingPrice: 420_000,
      scriptQuality: 7.8,
      conceptStrength: 7.2,
      logline: 'A washed-up forensic accountant uncovers a port-city cartel ledger tied to his family.',
      expiresInWeeks: 2,
    },
    {
      id: id('script'),
      title: 'Murmur Theory',
      genre: 'sciFi',
      askingPrice: 580_000,
      scriptQuality: 7.1,
      conceptStrength: 8.4,
      logline: 'A quantum linguist discovers spoken language can alter local reality in tiny, dangerous ways.',
      expiresInWeeks: 3,
    },
    {
      id: id('script'),
      title: 'Last Train Sunday',
      genre: 'drama',
      askingPrice: 250_000,
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
      id: id('rival'),
      name: 'Meridian Pictures',
      personality: 'prestigeHunter',
      studioHeat: 61,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
    },
    {
      id: id('rival'),
      name: 'Apex Global',
      personality: 'blockbusterFactory',
      studioHeat: 74,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
    },
    {
      id: id('rival'),
      name: 'Neon Slate',
      personality: 'genreSpecialist',
      studioHeat: 56,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
    },
    {
      id: id('rival'),
      name: 'Harbor Road',
      personality: 'streamingFirst',
      studioHeat: 52,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
    },
    {
      id: id('rival'),
      name: 'Freehold Films',
      personality: 'scrappyUpstart',
      studioHeat: 41,
      activeReleases: [],
      upcomingReleases: [],
      lockedTalentIds: [],
    },
  ];
}
