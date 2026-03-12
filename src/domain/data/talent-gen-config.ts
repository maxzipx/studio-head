import type { MovieGenre, TalentRole } from '../types';

export const TALENT_GENRES: MovieGenre[] = [
  'action',
  'drama',
  'comedy',
  'horror',
  'thriller',
  'sciFi',
  'animation',
  'documentary',
];

export const TALENT_POOL_SIZES: Record<'director' | 'leadActor' | 'leadActress', number> = {
  director: 60,
  leadActor: 135,
  leadActress: 135,
};

export const TALENT_GEN_CONFIG = {
  nameSeed: {
    worldSaltScale: 0.11,
    genreWorldSaltScale: 0.07,
    agentWorldSaltScale: 0.09,
  },
  genreFit: {
    director: { primary: 0.8, secondary: 0.67, tertiary: 0.56 },
    cast: { primary: 0.76, secondary: 0.64, tertiary: 0.54 },
    primarySpread: 0.2,
    secondarySpread: 0.18,
    tertiarySpread: 0.16,
    wildcardBase: 0.42,
    wildcardSpread: 0.22,
    clamp: {
      primary: [0.72, 0.98] as const,
      secondary: [0.55, 0.9] as const,
      tertiary: [0.45, 0.82] as const,
      wildcard: [0.35, 0.75] as const,
    },
  },
  starPower: { base: 4.1, spread: 5.7, directorBonus: 0.35, clamp: [3.8, 9.9] as const },
  craftScore: { base: 4.6, spread: 5.1, directorBonus: 0.85, clamp: [4, 9.9] as const },
  egoLevel: { base: 2, spread: 7.4, leadBonus: 0.45, clamp: [1.8, 9.8] as const },
  reputation: { base: 45, spread: 46, directorBonus: 3, clamp: [40, 96] as const },
  studioRelationship: { base: 0.05, spread: 0.57, clamp: [0.02, 0.75] as const },
  salary: {
    director: { base: 550_000, craftScale: 220_000, starScale: 95_000, spread: 500_000 },
    cast: { base: 650_000, starScale: 260_000, craftScale: 110_000, spread: 650_000 },
  },
  backendPoints: { base: 0.6, starScale: 0.28, craftScale: 0.12, spread: 0.9, clamp: [0.5, 5.5] as const },
  perksCost: { base: 50_000, egoScale: 55_000, starScale: 22_000, spread: 120_000 },
  age: {
    starYouthCraftThreshold: 6,
    starYouthStarThreshold: 7,
    starYouthBias: -5,
    craftBiasScale: 1.5,
  },
  salts: {
    genreFit: [31, 32, 33, 34] as const,
    agentTier: 44,
    starPower: 11,
    craftScore: 12,
    egoLevel: 13,
    reputation: 14,
    studioRelationship: 15,
    salary: 16,
    backendPoints: 17,
    perksCost: 18,
    ageU1: 50,
    ageU2: 51,
  },
} as const;

export function getTalentRoleProfile(role: TalentRole): 'director' | 'cast' {
  return role === 'director' ? 'director' : 'cast';
}
