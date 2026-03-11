import type { FoundingProfile, StudioSpecialization } from '@/src/domain/types';

export interface FoundingSetupOption<T extends string> {
  key: T;
  label: string;
  description: string;
}

export const FOUNDING_SPECIALIZATION_OPTIONS: FoundingSetupOption<StudioSpecialization>[] = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'A stable studio mandate. Reliable openings, steady burn, and no bias toward awards or spectacle.',
  },
  {
    key: 'blockbuster',
    label: 'Blockbuster',
    description: 'Built for larger openings and stronger distribution leverage, with a little more burn pressure and a lower critic ceiling.',
  },
  {
    key: 'prestige',
    label: 'Prestige',
    description: 'Leans into critic strength and awards upside, trading away some opening pop for a more elevated profile.',
  },
  {
    key: 'indie',
    label: 'Indie',
    description: 'Runs leaner with modest critical upside, but gives up some commercial reach and leverage.',
  },
];

export const FOUNDING_PROFILE_OPTIONS: FoundingSetupOption<Exclude<FoundingProfile, 'none'>>[] = [
  {
    key: 'starDriven',
    label: 'Star-Driven',
    description: 'Investor confidence came from relationships, packaging power, and the ability to bring talent to the table.',
  },
  {
    key: 'dataDriven',
    label: 'Data-Driven',
    description: 'Investor confidence came from market analytics, forecasting discipline, and sharper reads on commercial upside.',
  },
  {
    key: 'franchiseVision',
    label: 'Franchise Vision',
    description: 'Investor confidence came from scalable IP thinking, sequel planning, and a long-horizon commercial roadmap.',
  },
  {
    key: 'culturalBrand',
    label: 'Cultural Brand',
    description: 'Investor confidence came from tastemaker instincts, awards credibility, and the promise of cultural relevance.',
  },
];
