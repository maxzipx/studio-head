import { describe, expect, it } from 'vitest';
import { createProjectFromScript, createProjectFromIp } from './project-factory';
import type { ScriptPitch, OwnedIp, ProjectBudgetPlan, CastRequirements } from './types';

const stubBudgetPlan: ProjectBudgetPlan = {
  directorPlanned: 2_000_000,
  castPlannedTotal: 4_000_000,
  castPlannedActor: 2_000_000,
  castPlannedActress: 2_000_000,
};

const stubCast: CastRequirements = { actorCount: 1, actressCount: 1 };

function makePitch(overrides: Partial<ScriptPitch> = {}): ScriptPitch {
  return {
    id: 'pitch-1',
    title: 'Test Movie',
    genre: 'action',
    askingPrice: 500_000,
    scriptQuality: 7,
    conceptStrength: 6,
    logline: 'A test logline',
    expiresInWeeks: 4,
    ...overrides,
  };
}

function makeIp(overrides: Partial<OwnedIp> = {}): OwnedIp {
  return {
    id: 'ip-1',
    name: 'Test IP',
    kind: 'book',
    genre: 'action',
    acquisitionCost: 1_000_000,
    qualityBonus: 1,
    hypeBonus: 5,
    prestigeBonus: 10,
    commercialBonus: 12,
    expiresWeek: 52,
    usedProjectId: null,
    major: false,
    ...overrides,
  };
}

describe('createProjectFromScript', () => {
  it('returns a project with correct defaults', () => {
    const p = createProjectFromScript(makePitch(), stubBudgetPlan, stubCast);
    expect(p.phase).toBe('development');
    expect(p.editorialScore).toBe(5);
    expect(p.postPolishPasses).toBe(0);
    expect(p.directorId).toBeNull();
    expect(p.castIds).toEqual([]);
    expect(p.adaptedFromIpId).toBeNull();
  });

  it('copies title, genre, scriptQuality, conceptStrength from pitch', () => {
    const pitch = makePitch({ title: 'My Film', genre: 'drama', scriptQuality: 8, conceptStrength: 5 });
    const p = createProjectFromScript(pitch, stubBudgetPlan, stubCast);
    expect(p.title).toBe('My Film');
    expect(p.genre).toBe('drama');
    expect(p.scriptQuality).toBe(8);
    expect(p.conceptStrength).toBe(5);
  });

  it('sets hypeScore to 8', () => {
    const p = createProjectFromScript(makePitch(), stubBudgetPlan, stubCast);
    expect(p.hypeScore).toBe(8);
  });

  it('maps genre-based commercial appeal (action=68 base)', () => {
    const p = createProjectFromScript(makePitch({ genre: 'action', conceptStrength: 0 }), stubBudgetPlan, stubCast);
    expect(p.commercialAppeal).toBe(68); // clamp(round(68 + 0*3), 0, 100)
  });

  it('maps genre-based commercial appeal (drama=32 base)', () => {
    const p = createProjectFromScript(makePitch({ genre: 'drama', conceptStrength: 4 }), stubBudgetPlan, stubCast);
    // round(32 + 4*3) = round(44) = 44
    expect(p.commercialAppeal).toBe(44);
  });

  it('uses fallback 48 for genres not in the appeal map', () => {
    const p = createProjectFromScript(makePitch({ genre: 'comedy', conceptStrength: 0 }), stubBudgetPlan, stubCast);
    expect(p.commercialAppeal).toBe(48);
  });

  it('maps genre-based controversy (horror=35, thriller=28, action=22)', () => {
    expect(createProjectFromScript(makePitch({ genre: 'horror' }), stubBudgetPlan, stubCast).controversy).toBe(35);
    expect(createProjectFromScript(makePitch({ genre: 'thriller' }), stubBudgetPlan, stubCast).controversy).toBe(28);
    expect(createProjectFromScript(makePitch({ genre: 'action' }), stubBudgetPlan, stubCast).controversy).toBe(22);
  });

  it('uses fallback 15 for controversy when genre not in map', () => {
    expect(createProjectFromScript(makePitch({ genre: 'comedy' }), stubBudgetPlan, stubCast).controversy).toBe(15);
  });

  it('calculates prestige from scriptQuality with drama bonus', () => {
    const drama = createProjectFromScript(makePitch({ genre: 'drama', scriptQuality: 7 }), stubBudgetPlan, stubCast);
    // round(7*7 + 18) = round(67) = 67
    expect(drama.prestige).toBe(67);

    const action = createProjectFromScript(makePitch({ genre: 'action', scriptQuality: 7 }), stubBudgetPlan, stubCast);
    // round(7*7 + 0) = 49
    expect(action.prestige).toBe(49);
  });

  it('uses initialBudgetForGenre for budget ceiling', () => {
    const p = createProjectFromScript(makePitch({ genre: 'action' }), stubBudgetPlan, stubCast);
    expect(p.budget.ceiling).toBe(28_000_000);

    const doc = createProjectFromScript(makePitch({ genre: 'documentary' }), stubBudgetPlan, stubCast);
    expect(doc.budget.ceiling).toBe(6_000_000);
  });

  it('generates unique IDs per call', () => {
    const a = createProjectFromScript(makePitch(), stubBudgetPlan, stubCast);
    const b = createProjectFromScript(makePitch(), stubBudgetPlan, stubCast);
    expect(a.id).not.toBe(b.id);
  });
});

describe('createProjectFromIp', () => {
  it('scales budget ceiling by 1.3x for major IP', () => {
    const p = createProjectFromIp(makeIp({ genre: 'action', major: true }), 'Title', stubBudgetPlan, stubCast);
    expect(p.budget.ceiling).toBe(28_000_000 * 1.3);
  });

  it('scales budget ceiling by 1.05x for minor IP', () => {
    const p = createProjectFromIp(makeIp({ genre: 'action', major: false }), 'Title', stubBudgetPlan, stubCast);
    expect(p.budget.ceiling).toBe(28_000_000 * 1.05);
  });

  it('applies qualityBonus to scriptQuality clamped to 9.2', () => {
    const p = createProjectFromIp(makeIp({ qualityBonus: 1 }), 'T', stubBudgetPlan, stubCast);
    expect(p.scriptQuality).toBeCloseTo(7.1); // 6.1 + 1

    const capped = createProjectFromIp(makeIp({ qualityBonus: 10 }), 'T', stubBudgetPlan, stubCast);
    expect(capped.scriptQuality).toBe(9.2);
  });

  it('sets hype to 8 + hypeBonus', () => {
    const p = createProjectFromIp(makeIp({ hypeBonus: 5 }), 'T', stubBudgetPlan, stubCast);
    expect(p.hypeScore).toBe(13);
  });

  it('sets prestige to 40 + prestigeBonus', () => {
    const p = createProjectFromIp(makeIp({ prestigeBonus: 10 }), 'T', stubBudgetPlan, stubCast);
    expect(p.prestige).toBe(50);
  });

  it('sets commercialAppeal to 45 + commercialBonus', () => {
    const p = createProjectFromIp(makeIp({ commercialBonus: 12 }), 'T', stubBudgetPlan, stubCast);
    expect(p.commercialAppeal).toBe(57);
  });

  it('sets controversy to fixed 10', () => {
    const p = createProjectFromIp(makeIp(), 'T', stubBudgetPlan, stubCast);
    expect(p.controversy).toBe(10);
  });

  it('sets adaptedFromIpId to ip.id', () => {
    const p = createProjectFromIp(makeIp({ id: 'ip-42' }), 'T', stubBudgetPlan, stubCast);
    expect(p.adaptedFromIpId).toBe('ip-42');
  });
});
