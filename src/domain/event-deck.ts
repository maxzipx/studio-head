import type { EventTemplate, MovieProject } from './types';

function choosePrimaryProject(projects: MovieProject[]): string | null {
  return projects[0]?.id ?? null;
}

export function getEventDeck(): EventTemplate[] {
  return [
    {
      id: 'festival-buzz',
      title: 'Festival Programming Slot',
      decisionTitle: 'Festival Slot Offer',
      body: 'A mid-tier festival programmer offers an early slot for one of your projects.',
      cooldownWeeks: 4,
      baseWeight: 1.2,
      minWeek: 2,
      buildDecision: ({ idFactory, projectId }) => ({
        id: idFactory('decision'),
        projectId,
        title: 'Festival Slot Offer',
        body: 'Commit now for prestige upside, or save resources for launch marketing.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: idFactory('opt'),
            label: 'Submit Cut',
            preview: 'Potential critic momentum; spend on finishing pass.',
            cashDelta: -200_000,
            scriptQualityDelta: 0,
            hypeDelta: 4,
          },
          {
            id: idFactory('opt'),
            label: 'Decline',
            preview: 'No immediate cost; less early media attention.',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: -1,
          },
        ],
      }),
    },
    {
      id: 'rewrite-window',
      title: 'Rewrite Window',
      decisionTitle: 'Rewrite Pass Opportunity',
      body: 'A top script doctor opens a one-week slot.',
      cooldownWeeks: 3,
      baseWeight: 1.5,
      minWeek: 1,
      buildDecision: ({ idFactory, projectId }) => ({
        id: idFactory('decision'),
        projectId,
        title: 'Rewrite Pass Opportunity',
        body: 'Trusted script doctor is available this week only.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: idFactory('opt'),
            label: 'Approve Rewrite',
            preview: 'Script quality up, immediate spend.',
            cashDelta: -140_000,
            scriptQualityDelta: 0.6,
            hypeDelta: 1,
          },
          {
            id: idFactory('opt'),
            label: 'Decline',
            preview: 'No spend; momentum slows.',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: -1,
          },
        ],
      }),
    },
    {
      id: 'trailer-drop',
      title: 'Trailer Slot',
      decisionTitle: 'Premium Trailer Placement',
      body: 'A distributor offers premium trailer placement for a short window.',
      cooldownWeeks: 4,
      baseWeight: 1.1,
      minWeek: 3,
      buildDecision: ({ idFactory, projectId }) => ({
        id: idFactory('decision'),
        projectId,
        title: 'Premium Trailer Placement',
        body: 'Buy premium placement now or hold spend for later.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: idFactory('opt'),
            label: 'Buy Placement',
            preview: 'Higher hype ramp at meaningful cost.',
            cashDelta: -330_000,
            scriptQualityDelta: 0,
            hypeDelta: 6,
          },
          {
            id: idFactory('opt'),
            label: 'Pass',
            preview: 'Keep cash; no momentum bump this week.',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: 0,
          },
        ],
      }),
    },
  ];
}

export function chooseEventProjectId(projects: MovieProject[]): string | null {
  return choosePrimaryProject(projects);
}
