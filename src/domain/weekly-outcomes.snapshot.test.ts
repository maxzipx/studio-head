import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';

function captureCoreState(manager: StudioManager) {
  return {
    week: manager.currentWeek,
    cash: Math.round(manager.cash),
    heat: Number(manager.studioHeat.toFixed(2)),
    pendingCrises: manager.pendingCrises.length,
    decisionQueue: manager.decisionQueue.length,
    projects: manager.activeProjects.map((project) => ({
      title: project.title,
      phase: project.phase,
      status: project.productionStatus,
      spend: Math.round(project.budget.actualSpend),
      weeksRemaining: project.scheduledWeeksRemaining,
      hype: Number(project.hypeScore.toFixed(1)),
      projectedROI: Number(project.projectedROI.toFixed(3)),
    })),
  };
}

describe('weekly outcome snapshots', () => {
  it('keeps a stable 4-week baseline when no crises trigger', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      eventRng: () => 0.4,
      rivalRng: () => 0.6,
      negotiationRng: () => 0.4,
    });
    const timeline = [];

    for (let i = 0; i < 4; i += 1) {
      manager.endWeek();
      timeline.push(captureCoreState(manager));
    }

    expect(timeline).toMatchInlineSnapshot(`
      [
        {
          "cash": 49580000,
          "decisionQueue": 2,
          "heat": 12,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 31,
              "phase": "production",
              "projectedROI": 1.965,
              "spend": 9860000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 11,
            },
            {
              "hype": 16,
              "phase": "development",
              "projectedROI": 2.008,
              "spend": 560000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 17,
            },
          ],
          "week": 2,
        },
        {
          "cash": 49160000,
          "decisionQueue": 3,
          "heat": 12,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 29,
              "phase": "production",
              "projectedROI": 1.928,
              "spend": 10220000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 10,
            },
            {
              "hype": 14,
              "phase": "development",
              "projectedROI": 1.963,
              "spend": 620000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 16,
            },
          ],
          "week": 3,
        },
        {
          "cash": 48740000,
          "decisionQueue": 3,
          "heat": 11,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 27,
              "phase": "production",
              "projectedROI": 1.889,
              "spend": 10580000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 9,
            },
            {
              "hype": 12,
              "phase": "development",
              "projectedROI": 1.917,
              "spend": 680000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 15,
            },
          ],
          "week": 4,
        },
        {
          "cash": 48320000,
          "decisionQueue": 2,
          "heat": 9,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 25,
              "phase": "production",
              "projectedROI": 1.849,
              "spend": 10940000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 8,
            },
            {
              "hype": 10,
              "phase": "development",
              "projectedROI": 1.869,
              "spend": 740000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 14,
            },
          ],
          "week": 5,
        },
      ]
    `);
  });

  it('captures stable crisis-lock flow when crises always trigger', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.0,
      eventRng: () => 0.4,
      rivalRng: () => 0.6,
      negotiationRng: () => 0.4,
    });
    const timeline = [];

    for (let i = 0; i < 3; i += 1) {
      manager.endWeek();
      const crisis = manager.pendingCrises[0];
      manager.resolveCrisis(crisis.id, crisis.options[0].id);
      timeline.push(captureCoreState(manager));
    }

    expect(timeline).toMatchInlineSnapshot(`
      [
        {
          "cash": 49130000,
          "decisionQueue": 2,
          "heat": 12,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 31,
              "phase": "production",
              "projectedROI": 1.881,
              "spend": 10310000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 11,
            },
            {
              "hype": 16,
              "phase": "development",
              "projectedROI": 2.008,
              "spend": 560000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 17,
            },
          ],
          "week": 2,
        },
        {
          "cash": 48260000,
          "decisionQueue": 3,
          "heat": 12,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 29,
              "phase": "production",
              "projectedROI": 1.847,
              "spend": 11120000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 10,
            },
            {
              "hype": 14,
              "phase": "development",
              "projectedROI": 1.963,
              "spend": 620000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 16,
            },
          ],
          "week": 3,
        },
        {
          "cash": 47390000,
          "decisionQueue": 3,
          "heat": 11,
          "pendingCrises": 0,
          "projects": [
            {
              "hype": 27,
              "phase": "production",
              "projectedROI": 1.811,
              "spend": 11930000,
              "status": "onTrack",
              "title": "Night Ledger",
              "weeksRemaining": 9,
            },
            {
              "hype": 12,
              "phase": "development",
              "projectedROI": 1.917,
              "spend": 680000,
              "status": "onTrack",
              "title": "Blue Ember",
              "weeksRemaining": 15,
            },
          ],
          "week": 4,
        },
      ]
    `);
  });
});
