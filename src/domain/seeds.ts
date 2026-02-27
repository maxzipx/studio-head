import type {
  DecisionItem,
  MovieGenre,
  MovieProject,
  RivalStudio,
  ScriptPitch,
  Talent,
  TalentRole,
} from './types';
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

const TALENT_FIRST_NAMES = [
  'Avery', 'Blake', 'Cameron', 'Devon', 'Emerson', 'Finley', 'Gray', 'Harper',
  'Indigo', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Nico', 'Oakley', 'Parker',
  'Quinn', 'Reese', 'Sawyer', 'Taylor', 'Umber', 'Val', 'Winter', 'Zephyr',
];

const TALENT_LAST_NAMES = [
  'Arden', 'Beck', 'Calloway', 'Dalton', 'Ellis', 'Frost', 'Grady', 'Hale',
  'Irving', 'Jett', 'Keaton', 'Lane', 'Marlow', 'Nash', 'Onyx', 'Pryce',
  'Quill', 'Rowe', 'Sterling', 'Thorne',
];

const TALENT_GENRES: MovieGenre[] = [
  'action',
  'drama',
  'comedy',
  'horror',
  'thriller',
  'sciFi',
  'animation',
  'documentary',
];

const DIRECTOR_POOL_SIZE = 60;
const LEAD_ACTOR_POOL_SIZE = 200;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundMoney(value: number): number {
  return Math.round(value / 10_000) * 10_000;
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.545_312_3;
  return x - Math.floor(x);
}

function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function buildShuffledNamePool(worldSeed: number): string[] {
  const names: string[] = [];
  for (const first of TALENT_FIRST_NAMES) {
    for (const last of TALENT_LAST_NAMES) {
      names.push(`${first} ${last}`);
    }
  }
  if (worldSeed === 0) return names;

  const rng = createSeededRng(worldSeed);
  for (let i = names.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = names[i];
    names[i] = names[j];
    names[j] = temp;
  }
  return names;
}

function buildTalentName(index: number, namePool: string[]): string {
  if (index < namePool.length) return namePool[index];
  const fallbackBase = namePool[index % namePool.length] ?? `Talent ${index + 1}`;
  return `${fallbackBase} ${Math.floor(index / Math.max(1, namePool.length)) + 2}`;
}

function pickDistinctGenres(seedIndex: number, seedOffset: number): [MovieGenre, MovieGenre, MovieGenre, MovieGenre] {
  const total = TALENT_GENRES.length;
  const picks: MovieGenre[] = [];
  const bases = [
    (seedIndex + seedOffset) % total,
    (seedIndex * 3 + 1 + seedOffset) % total,
    (seedIndex * 5 + 2 + seedOffset) % total,
    (seedIndex * 7 + 3 + seedOffset) % total,
  ];

  for (const start of bases) {
    for (let step = 0; step < total; step += 1) {
      const genre = TALENT_GENRES[(start + step) % total];
      if (!picks.includes(genre)) {
        picks.push(genre);
        break;
      }
    }
  }

  return picks as [MovieGenre, MovieGenre, MovieGenre, MovieGenre];
}

function buildGenreFit(seedIndex: number, role: TalentRole, worldSeed: number): Partial<Record<MovieGenre, number>> {
  const seedOffset = worldSeed % TALENT_GENRES.length;
  const worldSalt = (worldSeed % 97) * 0.07;
  const [primary, secondary, tertiary, wildcard] = pickDistinctGenres(seedIndex, seedOffset);
  const primaryBase = role === 'director' ? 0.8 : 0.76;
  const secondaryBase = role === 'director' ? 0.67 : 0.64;
  const tertiaryBase = role === 'director' ? 0.56 : 0.54;

  return {
    [primary]: roundTo(clampNumber(primaryBase + seededUnit(seedIndex, 31 + worldSalt) * 0.2, 0.72, 0.98), 2),
    [secondary]: roundTo(clampNumber(secondaryBase + seededUnit(seedIndex, 32 + worldSalt) * 0.18, 0.55, 0.9), 2),
    [tertiary]: roundTo(clampNumber(tertiaryBase + seededUnit(seedIndex, 33 + worldSalt) * 0.16, 0.45, 0.82), 2),
    [wildcard]: roundTo(clampNumber(0.42 + seededUnit(seedIndex, 34 + worldSalt) * 0.22, 0.35, 0.75), 2),
  };
}

function pickAgentTier(starPower: number, reputation: number, seedIndex: number, worldSeed: number): Talent['agentTier'] {
  const worldSalt = (worldSeed % 83) * 0.09;
  const agencyScore = starPower * 6 + reputation * 0.52 + seededUnit(seedIndex, 44 + worldSalt) * 10;
  if (agencyScore >= 105) return 'aea';
  if (agencyScore >= 94) return 'wma';
  if (agencyScore >= 84) return 'tca';
  return 'independent';
}

function buildTalentSeed(seedIndex: number, role: TalentRole, worldSeed: number, namePool: string[]): Talent {
  const worldSalt = (worldSeed % 251) * 0.11;
  const starPower = roundTo(
    clampNumber(
      4.1 + seededUnit(seedIndex, 11 + worldSalt) * 5.7 + (role === 'director' ? 0.35 : 0),
      3.8,
      9.9
    ),
    1
  );

  const craftScore = roundTo(
    clampNumber(
      4.6 + seededUnit(seedIndex, 12 + worldSalt) * 5.1 + (role === 'director' ? 0.85 : 0),
      4,
      9.9
    ),
    1
  );

  const egoLevel = roundTo(
    clampNumber(
      2 + seededUnit(seedIndex, 13 + worldSalt) * 7.4 + (role === 'leadActor' ? 0.45 : 0),
      1.8,
      9.8
    ),
    1
  );

  const reputation = Math.round(
    clampNumber(45 + seededUnit(seedIndex, 14 + worldSalt) * 46 + (role === 'director' ? 3 : 0), 40, 96)
  );
  const studioRelationship = roundTo(clampNumber(0.05 + seededUnit(seedIndex, 15 + worldSalt) * 0.57, 0.02, 0.75), 2);

  const baseSalary =
    role === 'director'
      ? roundMoney(550_000 + craftScore * 220_000 + starPower * 95_000 + seededUnit(seedIndex, 16 + worldSalt) * 500_000)
      : roundMoney(650_000 + starPower * 260_000 + craftScore * 110_000 + seededUnit(seedIndex, 16 + worldSalt) * 650_000);

  const backendPoints = roundTo(
    clampNumber(0.6 + starPower * 0.28 + craftScore * 0.12 + seededUnit(seedIndex, 17 + worldSalt) * 0.9, 0.5, 5.5),
    1
  );

  const perksCost = roundMoney(
    50_000 + egoLevel * 55_000 + starPower * 22_000 + seededUnit(seedIndex, 18 + worldSalt) * 120_000
  );

  return {
    id: createId('talent'),
    name: buildTalentName(seedIndex, namePool),
    role,
    starPower,
    craftScore,
    genreFit: buildGenreFit(seedIndex, role, worldSeed),
    egoLevel,
    salary: {
      base: baseSalary,
      backendPoints,
      perksCost,
    },
    availability: 'available',
    unavailableUntilWeek: null,
    attachedProjectId: null,
    reputation,
    agentTier: pickAgentTier(starPower, reputation, seedIndex, worldSeed),
    studioRelationship,
    relationshipMemory: createInitialRelationship(studioRelationship),
  };
}

export function createSeedTalentPool(worldSeed = 0): Talent[] {
  const normalizedSeed = Number.isFinite(worldSeed) ? Math.max(0, Math.floor(Math.abs(worldSeed))) : 0;
  const namePool = buildShuffledNamePool(normalizedSeed);
  const talentPool: Talent[] = [];
  let seedIndex = 0;

  for (let i = 0; i < DIRECTOR_POOL_SIZE; i += 1) {
    talentPool.push(buildTalentSeed(seedIndex, 'director', normalizedSeed, namePool));
    seedIndex += 1;
  }

  for (let i = 0; i < LEAD_ACTOR_POOL_SIZE; i += 1) {
    talentPool.push(buildTalentSeed(seedIndex, 'leadActor', normalizedSeed, namePool));
    seedIndex += 1;
  }

  return talentPool;
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
      greenlightApproved: true,
      greenlightWeek: 0,
      greenlightFeePaid: 0,
      greenlightLockedCeiling: 24_000_000,
      sentBackForRewriteCount: 0,
      testScreeningCompleted: false,
      testScreeningWeek: null,
      testScreeningCriticalLow: null,
      testScreeningCriticalHigh: null,
      testScreeningAudienceSentiment: null,
      reshootCount: 0,
      trackingProjectionOpening: null,
      trackingConfidence: null,
      trackingLeverageAmount: 0,
      trackingSettled: false,
      merchandiseWeeksRemaining: 0,
      merchandiseWeeklyRevenue: 0,
      adaptedFromIpId: null,
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
      greenlightApproved: false,
      greenlightWeek: null,
      greenlightFeePaid: 0,
      greenlightLockedCeiling: null,
      sentBackForRewriteCount: 0,
      testScreeningCompleted: false,
      testScreeningWeek: null,
      testScreeningCriticalLow: null,
      testScreeningCriticalHigh: null,
      testScreeningAudienceSentiment: null,
      reshootCount: 0,
      trackingProjectionOpening: null,
      trackingConfidence: null,
      trackingLeverageAmount: 0,
      trackingSettled: false,
      merchandiseWeeksRemaining: 0,
      merchandiseWeeklyRevenue: 0,
      adaptedFromIpId: null,
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

