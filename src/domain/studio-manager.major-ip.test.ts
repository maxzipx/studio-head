import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';
import {
  initializeMajorIpCommitmentForManager,
  getBlockingMajorIpCommitmentForManager,
  getMajorIpCommitmentsForManager,
  applyMajorIpReleaseProgressForManager,
  evaluateMajorIpContractBreachesForManager,
} from './studio-manager.major-ip';
import { MAJOR_IP_CONTRACT_RULES, majorIpRemainingKey, majorIpBreachedKey } from './studio-manager.constants';
import type { OwnedIp, MovieProject } from './types';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

function makeMajorIp(manager: StudioManager, overrides?: Partial<OwnedIp>): OwnedIp {
  const ip: OwnedIp = {
    id: 'test-ip',
    name: 'Test Hero',
    kind: 'superhero',
    genre: 'action',
    acquisitionCost: 2_000_000,
    qualityBonus: 1,
    hypeBonus: 5,
    prestigeBonus: 3,
    commercialBonus: 8,
    expiresWeek: manager.currentWeek + 20,
    usedProjectId: null,
    major: true,
    ...overrides,
  };
  manager.ownedIps.push(ip);
  return ip;
}

describe('studio-manager.major-ip', () => {
  // ── initializeMajorIpCommitmentForManager ─────────────────────────

  it('creates a commitment when IP is major', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);

    const result = initializeMajorIpCommitmentForManager(manager, ip);

    expect(result).not.toBeNull();
    expect(result!.required).toBe(MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES);
    expect(result!.deadlineWeek).toBe(manager.currentWeek + MAJOR_IP_CONTRACT_RULES.DEADLINE_WEEKS);
    // Story flags should be set
    expect(manager.storyFlags[majorIpRemainingKey('test-ip')]).toBe(MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES);
  });

  it('returns null for non-major IP', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager, { major: false });

    const result = initializeMajorIpCommitmentForManager(manager, ip);

    expect(result).toBeNull();
  });

  // ── getBlockingMajorIpCommitmentForManager ────────────────────────

  it('returns null when no commitment exists', () => {
    const manager = createManager();

    const result = getBlockingMajorIpCommitmentForManager(manager);

    expect(result).toBeNull();
  });

  it('returns the blocking commitment when one is pending', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);
    initializeMajorIpCommitmentForManager(manager, ip);
    // Mark IP as owned via the story flag the function checks
    manager.storyFlags[`owned_ip_${ip.id}`] = 1;

    const result = getBlockingMajorIpCommitmentForManager(manager);

    expect(result).not.toBeNull();
    expect(result!.ip.id).toBe('test-ip');
    expect(result!.remaining).toBe(MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES);
  });

  // ── applyMajorIpReleaseProgressForManager ─────────────────────────

  it('decrements remaining releases on project release', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);
    initializeMajorIpCommitmentForManager(manager, ip);

    const project = { adaptedFromIpId: 'test-ip' } as MovieProject;
    const events: string[] = [];

    applyMajorIpReleaseProgressForManager(manager, project, events);

    const remaining = manager.storyFlags[majorIpRemainingKey('test-ip')];
    expect(remaining).toBe(MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES - 1);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toContain('progress');
  });

  it('reports fulfillment when last release is delivered', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);
    initializeMajorIpCommitmentForManager(manager, ip);
    // Set remaining to 1 so the next release fulfills the contract
    manager.storyFlags[majorIpRemainingKey('test-ip')] = 1;

    const project = { adaptedFromIpId: 'test-ip' } as MovieProject;
    const events: string[] = [];

    applyMajorIpReleaseProgressForManager(manager, project, events);

    expect(manager.storyFlags[majorIpRemainingKey('test-ip')]).toBe(0);
    expect(events.some((e) => e.includes('fulfilled'))).toBe(true);
  });

  // ── evaluateMajorIpContractBreachesForManager ─────────────────────

  it('triggers breach penalty when deadline passes with remaining releases', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);
    initializeMajorIpCommitmentForManager(manager, ip);
    manager.storyFlags[`owned_ip_${ip.id}`] = 1;

    // Force deadline into the past
    const deadlineKey = `major_ip_deadline_${ip.id}`;
    manager.storyFlags[deadlineKey] = manager.currentWeek - 1;

    const cashBefore = manager.cash;
    const events: string[] = [];

    evaluateMajorIpContractBreachesForManager(manager, events);

    expect(manager.storyFlags[majorIpBreachedKey('test-ip')]).toBe(1);
    expect(manager.cash).toBe(cashBefore - MAJOR_IP_CONTRACT_RULES.BREACH_CASH_PENALTY);
    expect(events.some((e) => e.includes('breached'))).toBe(true);
  });

  it('does not breach a contract before the deadline', () => {
    const manager = createManager();
    const ip = makeMajorIp(manager);
    initializeMajorIpCommitmentForManager(manager, ip);
    manager.storyFlags[`owned_ip_${ip.id}`] = 1;

    const events: string[] = [];
    evaluateMajorIpContractBreachesForManager(manager, events);

    expect(manager.storyFlags[majorIpBreachedKey('test-ip')]).toBe(0);
    expect(events).toHaveLength(0);
  });
});
