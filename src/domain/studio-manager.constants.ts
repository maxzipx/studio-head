import { PROJECT_BALANCE } from './balance-constants';
import type {
  DecisionCategory,
  FoundingProfile,
  IpKind,
  MilestoneRecord,
  MovieGenre,
  MovieProject,
  ReleaseOutcomeLabel,
  StudioSpecialization,
  StudioTier,
  Talent,
} from './types';

export function phaseBurnMultiplier(phase: MovieProject['phase']): number {
  return PROJECT_BALANCE.PHASE_BURN_MULTIPLIER[phase];
}

export function initialBudgetForGenre(genre: MovieGenre): number {
  return PROJECT_BALANCE.INITIAL_BUDGET_BY_GENRE[genre];
}

// Re-export from the canonical genre-config module so existing imports keep working.
export { MOVIE_GENRES, GENRE_SHOCK_LIBRARY, createInitialGenreCycles } from './genre-config';

export const AGENT_DIFFICULTY: Record<Talent['agentTier'], number> = {
  independent: 1,
  tca: 1.2,
  wma: 1.3,
  aea: 1.4,
};

export const ARC_LABELS: Record<string, string> = {
  'financier-control': 'Investor Pressure',
  'leak-piracy': 'Leak Fallout',
  'awards-circuit': 'Awards Run',
  'talent-meltdown': 'Volatile Star Cycle',
  'exhibitor-war': 'Theater Access Battle',
  'exhibitor-power-play': 'Exhibitor Power Play',
  'franchise-pivot': 'Universe Gamble',
  'franchise-identity': 'Franchise Identity',
  'franchise-fatigue': 'Franchise Fatigue',
  'passion-project': "The Director's Vision",
};

export const TIER_RANK: Record<StudioTier, number> = {
  indieStudio: 0,
  establishedIndie: 1,
  midTier: 2,
  majorStudio: 3,
  globalPowerhouse: 4,
};

export function isTierMet(current: StudioTier, required: StudioTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export function isTierExceeded(current: StudioTier, ceiling: StudioTier): boolean {
  return TIER_RANK[current] > TIER_RANK[ceiling];
}

export const MILESTONE_LABELS: Record<MilestoneRecord['id'], { title: string; description: string }> = {
  firstHit: {
    title: 'First Hit',
    description: 'Release your first film with at least 1.5x ROI.',
  },
  firstBlockbuster: {
    title: 'First Blockbuster',
    description: 'Release your first film with at least 3.0x ROI.',
  },
  boxOffice100m: {
    title: '$100M Club',
    description: 'Push a single title past $100M final gross.',
  },
  lifetimeRevenue1b: {
    title: '$1B Lifetime Revenue',
    description: 'Reach $1B cumulative box office across all releases.',
  },
  highestGrossingFilm: {
    title: 'New House Record',
    description: 'Set a new highest-grossing film record.',
  },
  lowestGrossingFilm: {
    title: 'Rough Landing',
    description: 'Set a new lowest-grossing film record.',
  },
};

export function releaseOutcomeFromRoi(roi: number): ReleaseOutcomeLabel {
  if (roi >= 3) return 'blockbuster';
  if (roi >= 1) return 'hit';
  return 'flop';
}

export interface SpecializationProfile {
  openingMultiplier: number;
  criticalDelta: number;
  burnMultiplier: number;
  awardsBoost: number;
  distributionLeverage: number;
}

export interface FoundingProfileModifiers {
  negotiationChanceBonus: number;
  trackingConfidenceBonus: number;
  franchiseMomentumBonus: number;
  awardsCampaignBonus: number;
  festivalBuzzBonus: number;
}

export function specializationProfile(focus: StudioSpecialization): SpecializationProfile {
  if (focus === 'blockbuster') {
    return { openingMultiplier: 1.09, criticalDelta: -3, burnMultiplier: 1.03, awardsBoost: -4, distributionLeverage: 0.025 };
  }
  if (focus === 'prestige') {
    return { openingMultiplier: 0.93, criticalDelta: 4, burnMultiplier: 1.01, awardsBoost: 6, distributionLeverage: 0.005 };
  }
  if (focus === 'indie') {
    return { openingMultiplier: 0.95, criticalDelta: 1, burnMultiplier: 0.92, awardsBoost: 2, distributionLeverage: -0.005 };
  }
  return { openingMultiplier: 1, criticalDelta: 0, burnMultiplier: 1, awardsBoost: 0, distributionLeverage: 0 };
}

export function foundingProfileModifiers(profile: FoundingProfile): FoundingProfileModifiers {
  if (profile === 'starDriven') {
    return {
      negotiationChanceBonus: 0.035,
      trackingConfidenceBonus: 0,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 0,
      festivalBuzzBonus: 0,
    };
  }
  if (profile === 'dataDriven') {
    return {
      negotiationChanceBonus: 0,
      trackingConfidenceBonus: 0.045,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 0,
      festivalBuzzBonus: 0,
    };
  }
  if (profile === 'franchiseVision') {
    return {
      negotiationChanceBonus: 0,
      trackingConfidenceBonus: 0,
      franchiseMomentumBonus: 3,
      awardsCampaignBonus: 0,
      festivalBuzzBonus: 0,
    };
  }
  if (profile === 'culturalBrand') {
    return {
      negotiationChanceBonus: 0,
      trackingConfidenceBonus: 0,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 4,
      festivalBuzzBonus: 3,
    };
  }
  return {
    negotiationChanceBonus: 0,
    trackingConfidenceBonus: 0,
    franchiseMomentumBonus: 0,
    awardsCampaignBonus: 0,
    festivalBuzzBonus: 0,
  };
}

export function buildIpTemplate(kind: IpKind): {
  qualityBonus: number;
  hypeBonus: number;
  prestigeBonus: number;
  commercialBonus: number;
  genre: MovieGenre;
  namePool: string[];
  major: boolean;
  costRange: [number, number];
} {
  if (kind === 'book') {
    return {
      qualityBonus: 0.6,
      hypeBonus: 6,
      prestigeBonus: 9,
      commercialBonus: 4,
      genre: 'drama',
      namePool: ['The Ash Archive', 'Vanta County', 'Glass Orchard'],
      major: false,
      costRange: [280_000, 620_000],
    };
  }
  if (kind === 'game') {
    return {
      qualityBonus: 0.3,
      hypeBonus: 10,
      prestigeBonus: 2,
      commercialBonus: 10,
      genre: 'action',
      namePool: ['Apex Frontier', 'Iron District', 'Null Protocol'],
      major: false,
      costRange: [450_000, 980_000],
    };
  }
  if (kind === 'comic') {
    return {
      qualityBonus: 0.4,
      hypeBonus: 8,
      prestigeBonus: 4,
      commercialBonus: 8,
      genre: 'sciFi',
      namePool: ['Solar Ashes', 'The Last Orbit', 'Zero Testament'],
      major: false,
      costRange: [380_000, 840_000],
    };
  }
  return {
    qualityBonus: 0.7,
    hypeBonus: 14,
    prestigeBonus: 5,
    commercialBonus: 16,
    genre: 'action',
    namePool: ['Sentinel Prime Universe', 'Titan Guard Legacy', 'Nightshield Protocol'],
    major: true,
    costRange: [4_000_000, 8_000_000],
  };
}

export const MAJOR_IP_CONTRACT_RULES = {
  REQUIRED_RELEASES: 3,
  DEADLINE_WEEKS: 208,
  BREACH_CASH_PENALTY: 1_400_000,
  BREACH_DISTRIBUTOR_DELTA: -8,
  BREACH_TALENT_DELTA: -5,
  BREACH_AUDIENCE_DELTA: -3,
} as const;

export function majorIpRemainingKey(ipId: string): string {
  return `major_ip_remaining_${ipId}`;
}

export function majorIpTotalKey(ipId: string): string {
  return `major_ip_total_${ipId}`;
}

export function majorIpDeadlineKey(ipId: string): string {
  return `major_ip_deadline_${ipId}`;
}

export function majorIpBreachedKey(ipId: string): string {
  return `major_ip_breached_${ipId}`;
}

export interface ArcOutcomeModifiers {
  talentLeverage: number;
  distributionLeverage: number;
  burnMultiplier: number;
  hypeDecayStep: number;
  releaseHeatMomentum: number;
  categoryBias: Partial<Record<DecisionCategory, number>>;
}
