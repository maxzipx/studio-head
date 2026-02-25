import { describe, expect, it, vi } from 'vitest';
import { StudioManager } from '../domain/studio-manager';
import { restoreStudioManager, serializeStudioManager } from './persistence';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
  },
}));

describe('persistence restore', () => {
  it('omits heavyweight runtime-only fields from serialized save payload', () => {
    const manager = new StudioManager();
    const serialized = serializeStudioManager(manager);

    expect(Object.hasOwn(serialized, 'eventDeck')).toBe(false);
    expect(Object.hasOwn(serialized, 'crisisRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'eventRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'negotiationRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'rivalRng')).toBe(false);
  });

  it('stores lastEventWeek map as serializable entries', () => {
    const manager = new StudioManager();
    const lastEventWeek = (manager as unknown as { lastEventWeek: Map<string, number> }).lastEventWeek;
    lastEventWeek.set('arc-test', 8);

    const serialized = serializeStudioManager(manager);

    expect(Array.isArray(serialized.lastEventWeek)).toBe(true);
    expect(serialized.lastEventWeek).toContainEqual(['arc-test', 8]);
  });

  it('preserves runtime map behavior after JSON snapshot hydration', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.2 });
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;

    const restored = restoreStudioManager(snapshot);

    expect(() => restored.endWeek()).not.toThrow();
  });

  it('normalizes invalid turn length while preserving valid values', () => {
    const manager = new StudioManager();
    manager.turnLengthWeeks = 2;
    const validSnapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const validRestored = restoreStudioManager(validSnapshot);
    expect(validRestored.turnLengthWeeks).toBe(2);

    const invalidSnapshot = {
      ...validSnapshot,
      turnLengthWeeks: 7,
    } as ReturnType<typeof serializeStudioManager>;
    const invalidRestored = restoreStudioManager(invalidSnapshot);
    expect(invalidRestored.turnLengthWeeks).toBe(1);
  });

  it('backfills and normalizes editorial fields on restored projects', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;

    const firstProject = (snapshot.activeProjects as Record<string, unknown>[])[0];
    delete firstProject.editorialScore;
    firstProject.postPolishPasses = 9;

    const restored = restoreStudioManager(snapshot);
    const project = restored.activeProjects[0];
    expect(project.editorialScore).toBe(5);
    expect(project.postPolishPasses).toBe(2);
  });

  it('migrates legacy talent relationship state into memory model', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const firstTalent = (snapshot.talentPool as Record<string, unknown>[])[0];
    delete firstTalent.relationshipMemory;
    firstTalent.studioRelationship = 0.2;

    const restored = restoreStudioManager(snapshot);
    const talent = restored.talentPool[0];
    expect(talent.relationshipMemory).toBeTruthy();
    expect(talent.relationshipMemory.interactionHistory).toEqual([]);
    expect(talent.relationshipMemory.trust).toBeGreaterThan(0);
    expect(talent.relationshipMemory.loyalty).toBeGreaterThan(0);
  });

  it('migrates legacy rival data and awards state safely', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const firstRival = (snapshot.rivals as Record<string, unknown>[])[0];
    delete firstRival.memory;
    const firstProject = (snapshot.activeProjects as Record<string, unknown>[])[0];
    delete firstProject.awardsNominations;
    delete firstProject.awardsWins;
    delete firstProject.festivalStatus;
    delete firstProject.festivalTarget;
    delete firstProject.festivalSubmissionWeek;
    delete firstProject.festivalResolutionWeek;
    delete firstProject.festivalBuzz;
    delete firstProject.franchiseId;
    delete firstProject.franchiseEpisode;
    delete firstProject.sequelToProjectId;
    delete firstProject.franchiseCarryoverHype;
    delete firstProject.franchiseStrategy;
    snapshot.genreCycles = 'bad-data' as unknown as Record<string, unknown>;
    snapshot.franchises = 'bad-data' as unknown as never[];
    snapshot.awardsHistory = 'bad-data' as unknown as never[];
    snapshot.awardsSeasonsProcessed = 'bad-data' as unknown as number[];

    const restored = restoreStudioManager(snapshot);
    expect(restored.rivals[0].memory).toBeTruthy();
    expect(restored.rivals[0].memory.interactionHistory).toEqual([]);
    expect(restored.activeProjects[0].awardsNominations).toBe(0);
    expect(restored.activeProjects[0].awardsWins).toBe(0);
    expect(restored.activeProjects[0].festivalStatus).toBe('none');
    expect(restored.activeProjects[0].festivalBuzz).toBe(0);
    expect(restored.activeProjects[0].franchiseId).toBeNull();
    expect(restored.activeProjects[0].franchiseEpisode).toBeNull();
    expect(restored.activeProjects[0].sequelToProjectId).toBeNull();
    expect(restored.activeProjects[0].franchiseCarryoverHype).toBe(0);
    expect(restored.activeProjects[0].franchiseStrategy).toBe('none');
    expect(Array.isArray(restored.franchises)).toBe(true);
    expect(typeof restored.genreCycles.action.demand).toBe('number');
    expect(Array.isArray(restored.awardsHistory)).toBe(true);
    expect(Array.isArray(restored.awardsSeasonsProcessed)).toBe(true);
  });

  it('backfills new franchise ops fields on legacy franchise entries', () => {
    const manager = new StudioManager();
    const baseProject = manager.activeProjects[0];
    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 2;
    baseProject.criticalScore = 74;
    baseProject.audienceScore = 76;
    manager.startSequel(baseProject.id);

    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const firstFranchise = (snapshot.franchises as Record<string, unknown>[])[0];
    delete firstFranchise.cadenceBufferWeeks;
    delete firstFranchise.brandResetCount;
    delete firstFranchise.legacyCastingCampaignCount;
    delete firstFranchise.hiatusPlanCount;

    const restored = restoreStudioManager(snapshot);
    expect(restored.franchises[0].cadenceBufferWeeks).toBe(0);
    expect(restored.franchises[0].brandResetCount).toBe(0);
    expect(restored.franchises[0].legacyCastingCampaignCount).toBe(0);
    expect(restored.franchises[0].hiatusPlanCount).toBe(0);
  });

  it('sanitizes malformed genre shock fields on restore', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const cycles = snapshot.genreCycles as Record<string, Record<string, unknown>>;
    cycles.action = {
      demand: 5,
      momentum: -3,
      shockLabel: 999,
      shockDirection: 'bad-direction',
      shockStrength: 99,
      shockUntilWeek: -1,
    };

    const restored = restoreStudioManager(snapshot);
    expect(restored.genreCycles.action.demand).toBeLessThanOrEqual(1.4);
    expect(restored.genreCycles.action.momentum).toBeGreaterThanOrEqual(-0.06);
    expect(restored.genreCycles.action.shockLabel ?? null).toBeNull();
    expect(restored.genreCycles.action.shockDirection ?? null).toBeNull();
    expect(restored.genreCycles.action.shockUntilWeek ?? null).toBeNull();
  });

  it('removes non-theatrical player distribution windows from legacy saves', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const firstProject = (snapshot.activeProjects as Record<string, unknown>[])[0];
    firstProject.phase = 'distribution';
    firstProject.releaseWindow = 'streamingExclusive';

    snapshot.distributionOffers = [
      {
        id: 'legacy-offer',
        projectId: String(firstProject.id),
        partner: 'Legacy Streamer',
        releaseWindow: 'hybridWindow',
        minimumGuarantee: 100_000,
        pAndACommitment: 50_000,
        revenueShareToStudio: 0.6,
        projectedOpeningOverride: 1,
        counterAttempts: 0,
      },
    ] as unknown as ReturnType<typeof serializeStudioManager>['distributionOffers'];

    const restored = restoreStudioManager(snapshot);
    expect(restored.distributionOffers.length).toBe(0);
    expect(restored.activeProjects[0].releaseWindow).toBeNull();
  });
});
