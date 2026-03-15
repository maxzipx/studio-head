import { describe, expect, it } from 'vitest';
import { StudioManager } from '../studio-manager';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

describe('IpService', () => {
  it('refreshIpMarketplace() adds IPs to manager.ownedIps', () => {
    const manager = createManager();
    const countBefore = manager.ownedIps.length;

    manager.ipService.refreshIpMarketplace();

    expect(manager.ownedIps.length).toBeGreaterThan(countBefore);
    const ip = manager.ownedIps[0];
    expect(ip.name).toBeTruthy();
    expect(ip.kind).toBeTruthy();
    expect(ip.acquisitionCost).toBeGreaterThan(0);
    expect(ip.usedProjectId).toBeNull();
  });

  it('refreshIpMarketplace(true) forces a major superhero IP', () => {
    const manager = createManager();
    manager.ownedIps = [];
    const countBefore = manager.ownedIps.length;

    manager.ipService.refreshIpMarketplace(true);

    expect(manager.ownedIps.length).toBeGreaterThan(countBefore);
    // The newly added IP is unshifted to the front
    expect(manager.ownedIps[0].kind).toBe('superhero');
    expect(manager.ownedIps[0].major).toBe(true);
  });

  it('acquireIpRights() deducts cash and sets story flag', () => {
    const manager = createManager();
    manager.ipService.refreshIpMarketplace();
    const ip = manager.ownedIps[0];
    manager.cash = ip.acquisitionCost + 1_000_000;
    // Ensure distributor rep is high enough for major IPs
    manager.reputation.distributor = 80;
    const cashBefore = manager.cash;

    const result = manager.ipService.acquireIpRights(ip.id);

    expect(result.success).toBe(true);
    expect(manager.cash).toBe(cashBefore - ip.acquisitionCost);
    expect(manager.storyFlags[`owned_ip_${ip.id}`]).toBe(1);
  });

  it('acquireIpRights() fails with insufficient cash', () => {
    const manager = createManager();
    manager.ipService.refreshIpMarketplace();
    const ip = manager.ownedIps[0];
    manager.cash = 0;

    const result = manager.ipService.acquireIpRights(ip.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient cash');
  });

  it('acquireIpRights() fails for expired IP', () => {
    const manager = createManager();
    manager.ipService.refreshIpMarketplace();
    const ip = manager.ownedIps[0];
    // Push current week past the expiry
    manager.currentWeek = ip.expiresWeek + 1;

    const result = manager.ipService.acquireIpRights(ip.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('expired');
  });

  it('generateIpTitle() returns IP name directly for book kind', () => {
    const manager = createManager();
    const bookIp = {
      id: 'ip-book-1', name: 'The Great Novel', kind: 'book' as const,
      genre: 'drama' as const, acquisitionCost: 1_000_000, qualityBonus: 5,
      hypeBonus: 3, prestigeBonus: 4, commercialBonus: 2,
      expiresWeek: 20, usedProjectId: null, major: false,
    };

    expect(manager.ipService.generateIpTitle(bookIp)).toBe('The Great Novel');
  });

  it('generateIpTitle() returns IP name directly for game kind', () => {
    const manager = createManager();
    const gameIp = {
      id: 'ip-game-1', name: 'Cyber Quest', kind: 'game' as const,
      genre: 'action' as const, acquisitionCost: 2_000_000, qualityBonus: 5,
      hypeBonus: 4, prestigeBonus: 2, commercialBonus: 6,
      expiresWeek: 20, usedProjectId: null, major: false,
    };

    expect(manager.ipService.generateIpTitle(gameIp)).toBe('Cyber Quest');
  });

  it('generateIpTitle() adds subtitle for superhero kind', () => {
    const manager = createManager();
    const heroIp = {
      id: 'ip-hero-1', name: 'Captain Valor', kind: 'superhero' as const,
      genre: 'action' as const, acquisitionCost: 5_000_000, qualityBonus: 6,
      hypeBonus: 8, prestigeBonus: 2, commercialBonus: 9,
      expiresWeek: 20, usedProjectId: null, major: true,
    };

    const title = manager.ipService.generateIpTitle(heroIp);
    expect(title).toContain('Captain Valor: ');
    expect(title.length).toBeGreaterThan('Captain Valor: '.length);
  });

  it('developProjectFromIp() creates a project and links it to the IP', () => {
    const manager = createManager();
    manager.ipService.refreshIpMarketplace();
    const ip = manager.ownedIps[0];
    manager.cash = ip.acquisitionCost + 10_000_000;
    manager.reputation.distributor = 80;
    manager.ipService.acquireIpRights(ip.id);

    const result = manager.ipService.developProjectFromIp(ip.id);

    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();
    expect(manager.activeProjects.some((p) => p.id === result.projectId)).toBe(true);
    expect(ip.usedProjectId).toBe(result.projectId);
  });

  it('developProjectFromIp() fails without acquired rights', () => {
    const manager = createManager();
    manager.ipService.refreshIpMarketplace();
    const ip = manager.ownedIps[0];

    const result = manager.ipService.developProjectFromIp(ip.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Acquire rights first');
  });

  it('rollCastRequirements() returns valid actor/actress counts', () => {
    const manager = createManager();

    const req = manager.ipService.rollCastRequirements();

    expect(req.actorCount).toBeGreaterThanOrEqual(0);
    expect(req.actressCount).toBeGreaterThanOrEqual(0);
    const total = req.actorCount + req.actressCount;
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(3);
  });
});
