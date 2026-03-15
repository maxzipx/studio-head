import type { MovieGenre, RivalStudio, Talent, TalentRole } from '../types';
import { createId } from '../id';
import { TALENT_LIFECYCLE } from '../balance-constants';
import {
  TALENT_GEN_CONFIG,
  TALENT_GENRES,
  TALENT_POOL_SIZES,
  getTalentRoleProfile,
} from '../data/talent-gen-config';
import { reserveSeededTalentName } from '../talent-names';
import { clamp, roundTo, roundMoney, seededUnit } from '../utils';

function createInitialRelationship(studioRelationship: number): Talent['relationshipMemory'] {
  const trust = Math.round(clamp(35 + studioRelationship * 45, 0, 100));
  const loyalty = Math.round(clamp(30 + studioRelationship * 40, 0, 100));
  return {
    trust,
    loyalty,
    interactionHistory: [],
  };
}

export function createInitialRivalMemory(
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
  const worldSalt = (worldSeed % 97) * TALENT_GEN_CONFIG.nameSeed.genreWorldSaltScale;
  const [primary, secondary, tertiary, wildcard] = pickDistinctGenres(seedIndex, seedOffset);
  const roleProfile = TALENT_GEN_CONFIG.genreFit[getTalentRoleProfile(role)];

  return {
    [primary]: roundTo(
      clamp(
        roleProfile.primary + seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.genreFit[0] + worldSalt) * TALENT_GEN_CONFIG.genreFit.primarySpread,
        TALENT_GEN_CONFIG.genreFit.clamp.primary[0],
        TALENT_GEN_CONFIG.genreFit.clamp.primary[1]
      ),
      2
    ),
    [secondary]: roundTo(
      clamp(
        roleProfile.secondary + seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.genreFit[1] + worldSalt) * TALENT_GEN_CONFIG.genreFit.secondarySpread,
        TALENT_GEN_CONFIG.genreFit.clamp.secondary[0],
        TALENT_GEN_CONFIG.genreFit.clamp.secondary[1]
      ),
      2
    ),
    [tertiary]: roundTo(
      clamp(
        roleProfile.tertiary + seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.genreFit[2] + worldSalt) * TALENT_GEN_CONFIG.genreFit.tertiarySpread,
        TALENT_GEN_CONFIG.genreFit.clamp.tertiary[0],
        TALENT_GEN_CONFIG.genreFit.clamp.tertiary[1]
      ),
      2
    ),
    [wildcard]: roundTo(
      clamp(
        TALENT_GEN_CONFIG.genreFit.wildcardBase +
          seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.genreFit[3] + worldSalt) * TALENT_GEN_CONFIG.genreFit.wildcardSpread,
        TALENT_GEN_CONFIG.genreFit.clamp.wildcard[0],
        TALENT_GEN_CONFIG.genreFit.clamp.wildcard[1]
      ),
      2
    ),
  };
}

function pickAgentTier(starPower: number, reputation: number, seedIndex: number, worldSeed: number): Talent['agentTier'] {
  const worldSalt = (worldSeed % 83) * TALENT_GEN_CONFIG.nameSeed.agentWorldSaltScale;
  const agencyScore = starPower * 6 + reputation * 0.52 + seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.agentTier + worldSalt) * 10;
  if (agencyScore >= 105) return 'aea';
  if (agencyScore >= 94) return 'wma';
  if (agencyScore >= 84) return 'tca';
  return 'independent';
}

function buildTalentSeed(seedIndex: number, role: TalentRole, worldSeed: number, usedNames: Set<string>): Talent {
  const worldSalt = (worldSeed % 251) * TALENT_GEN_CONFIG.nameSeed.worldSaltScale;
  const roleProfile = getTalentRoleProfile(role);
  const starPower = roundTo(
    clamp(
      TALENT_GEN_CONFIG.starPower.base +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.starPower + worldSalt) * TALENT_GEN_CONFIG.starPower.spread +
        (role === 'director' ? TALENT_GEN_CONFIG.starPower.directorBonus : 0),
      TALENT_GEN_CONFIG.starPower.clamp[0],
      TALENT_GEN_CONFIG.starPower.clamp[1]
    ),
    1
  );

  const craftScore = roundTo(
    clamp(
      TALENT_GEN_CONFIG.craftScore.base +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.craftScore + worldSalt) * TALENT_GEN_CONFIG.craftScore.spread +
        (role === 'director' ? TALENT_GEN_CONFIG.craftScore.directorBonus : 0),
      TALENT_GEN_CONFIG.craftScore.clamp[0],
      TALENT_GEN_CONFIG.craftScore.clamp[1]
    ),
    1
  );

  const egoLevel = roundTo(
    clamp(
      TALENT_GEN_CONFIG.egoLevel.base +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.egoLevel + worldSalt) * TALENT_GEN_CONFIG.egoLevel.spread +
        (roleProfile === 'cast' ? TALENT_GEN_CONFIG.egoLevel.leadBonus : 0),
      TALENT_GEN_CONFIG.egoLevel.clamp[0],
      TALENT_GEN_CONFIG.egoLevel.clamp[1]
    ),
    1
  );

  const reputation = Math.round(
    clamp(
      TALENT_GEN_CONFIG.reputation.base +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.reputation + worldSalt) * TALENT_GEN_CONFIG.reputation.spread +
        (role === 'director' ? TALENT_GEN_CONFIG.reputation.directorBonus : 0),
      TALENT_GEN_CONFIG.reputation.clamp[0],
      TALENT_GEN_CONFIG.reputation.clamp[1]
    )
  );
  const studioRelationship = roundTo(
    clamp(
      TALENT_GEN_CONFIG.studioRelationship.base +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.studioRelationship + worldSalt) * TALENT_GEN_CONFIG.studioRelationship.spread,
      TALENT_GEN_CONFIG.studioRelationship.clamp[0],
      TALENT_GEN_CONFIG.studioRelationship.clamp[1]
    ),
    2
  );

  const baseSalary =
    role === 'director'
      ? roundMoney(
          TALENT_GEN_CONFIG.salary.director.base +
            craftScore * TALENT_GEN_CONFIG.salary.director.craftScale +
            starPower * TALENT_GEN_CONFIG.salary.director.starScale +
            seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.salary + worldSalt) * TALENT_GEN_CONFIG.salary.director.spread
        )
      : roundMoney(
          TALENT_GEN_CONFIG.salary.cast.base +
            starPower * TALENT_GEN_CONFIG.salary.cast.starScale +
            craftScore * TALENT_GEN_CONFIG.salary.cast.craftScale +
            seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.salary + worldSalt) * TALENT_GEN_CONFIG.salary.cast.spread
        );

  const backendPoints = roundTo(
    clamp(
      TALENT_GEN_CONFIG.backendPoints.base +
        starPower * TALENT_GEN_CONFIG.backendPoints.starScale +
        craftScore * TALENT_GEN_CONFIG.backendPoints.craftScale +
        seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.backendPoints + worldSalt) * TALENT_GEN_CONFIG.backendPoints.spread,
      TALENT_GEN_CONFIG.backendPoints.clamp[0],
      TALENT_GEN_CONFIG.backendPoints.clamp[1]
    ),
    1
  );

  const perksCost = roundMoney(
    TALENT_GEN_CONFIG.perksCost.base +
      egoLevel * TALENT_GEN_CONFIG.perksCost.egoScale +
      starPower * TALENT_GEN_CONFIG.perksCost.starScale +
      seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.perksCost + worldSalt) * TALENT_GEN_CONFIG.perksCost.spread
  );

  // Age: Box-Muller approximation using two seeded uniform samples.
  // Higher craftScore nudges age older; high starPower + low craft nudges younger.
  const u1 = Math.max(0.0001, seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.ageU1 + worldSalt));
  const u2 = seededUnit(seedIndex, TALENT_GEN_CONFIG.salts.ageU2 + worldSalt);
  const normalSample = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const craftAgeBias = (craftScore - 6) * TALENT_GEN_CONFIG.age.craftBiasScale;
  const starYouthBias =
    starPower > TALENT_GEN_CONFIG.age.starYouthStarThreshold && craftScore < TALENT_GEN_CONFIG.age.starYouthCraftThreshold
      ? TALENT_GEN_CONFIG.age.starYouthBias
      : 0;
  const rawAge = TALENT_LIFECYCLE.SEED_MEAN_AGE + normalSample * TALENT_LIFECYCLE.SEED_AGE_STDDEV + craftAgeBias + starYouthBias;
  const age = clamp(Math.round(rawAge), TALENT_LIFECYCLE.SEED_MIN_AGE, TALENT_LIFECYCLE.SEED_MAX_AGE);
  const birthWeek = -(age * 52);

  return {
    id: createId('talent'),
    name: reserveSeededTalentName({
      worldSeed,
      role,
      sequenceIndex: seedIndex,
      usedNames,
    }),
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
    marketWindowExpiresWeek: null,
    birthWeek,
    status: 'active',
    retiredWeek: null,
  };
}

export function createSeedTalentPool(worldSeed = 0): Talent[] {
  const normalizedSeed = Number.isFinite(worldSeed) ? Math.max(0, Math.floor(Math.abs(worldSeed))) : 0;
  const talentPool: Talent[] = [];
  const usedNames = new Set<string>();
  let seedIndex = 0;

  for (let i = 0; i < TALENT_POOL_SIZES.director; i += 1) {
    talentPool.push(buildTalentSeed(seedIndex, 'director', normalizedSeed, usedNames));
    seedIndex += 1;
  }

  for (let i = 0; i < TALENT_POOL_SIZES.leadActor; i += 1) {
    talentPool.push(buildTalentSeed(seedIndex, 'leadActor', normalizedSeed, usedNames));
    seedIndex += 1;
  }

  for (let i = 0; i < TALENT_POOL_SIZES.leadActress; i += 1) {
    talentPool.push(buildTalentSeed(seedIndex, 'leadActress', normalizedSeed, usedNames));
    seedIndex += 1;
  }

  return talentPool;
}
