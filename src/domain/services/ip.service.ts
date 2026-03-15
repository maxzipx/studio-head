import type { StudioManager } from '../studio-manager';
import type { CastRequirements, IpKind, OwnedIp } from '../types';
import { createProjectFromIp } from '../project-factory';
import { buildIpTemplate, initialBudgetForGenre } from '../studio-manager.constants';
import { createId } from '../id';
import {
  initializeMajorIpCommitmentForManager,
  getBlockingMajorIpCommitmentForManager,
} from '../studio-manager.major-ip';

export class IpService {
  constructor(private readonly manager: StudioManager) {}

  refreshIpMarketplace(forceMajor = false): void {
    const pool: IpKind[] = forceMajor ? ['superhero'] : ['book', 'game', 'comic', 'book', 'game', 'comic', 'superhero'];
    const kind = pool[Math.floor(this.manager.eventRng() * pool.length)] ?? 'book';
    const profile = buildIpTemplate(kind);
    const [low, high] = profile.costRange;
    const acquisitionCost = Math.round(low + this.manager.eventRng() * (high - low));
    const name = profile.namePool[Math.floor(this.manager.eventRng() * profile.namePool.length)] ?? `Untitled ${kind} property`;
    const expiresWeek = this.manager.currentWeek + (profile.major ? 8 : 10);
    const id = createId('ip');
    this.manager.ownedIps = this.manager.ownedIps.filter((ip) => ip.expiresWeek >= this.manager.currentWeek || ip.usedProjectId !== null);
    if (this.manager.ownedIps.some((ip) => ip.name === name && ip.usedProjectId === null)) return;
    this.manager.ownedIps.unshift({
      id,
      name,
      kind,
      genre: profile.genre,
      acquisitionCost,
      qualityBonus: profile.qualityBonus,
      hypeBonus: profile.hypeBonus,
      prestigeBonus: profile.prestigeBonus,
      commercialBonus: profile.commercialBonus,
      expiresWeek,
      usedProjectId: null,
      major: profile.major,
    });
    this.manager.ownedIps = this.manager.ownedIps.slice(0, 12);
  }

  acquireIpRights(ipId: string): { success: boolean; message: string } {
    const ip = this.manager.ownedIps.find((entry) => entry.id === ipId);
    if (!ip) return { success: false, message: 'IP opportunity not found.' };
    if (ip.usedProjectId) return { success: false, message: 'IP already adapted.' };
    if (ip.expiresWeek < this.manager.currentWeek) return { success: false, message: 'IP option has expired.' };
    if (this.manager.storyFlags[`owned_ip_${ip.id}`]) return { success: false, message: 'Rights are already under your control.' };
    if (ip.major && this.manager.reputation.distributor < 55) {
      return { success: false, message: 'Major IP requires stronger distributor reputation (55+).' };
    }
    if (this.manager.cash < ip.acquisitionCost) return { success: false, message: 'Insufficient cash to acquire IP rights.' };
    this.manager.adjustCash(-ip.acquisitionCost);
    this.manager.storyFlags[`owned_ip_${ip.id}`] = 1;
    const majorContract = initializeMajorIpCommitmentForManager(this.manager, ip);
    this.manager.evaluateBankruptcy();
    if (majorContract) {
      return {
        success: true,
        message: `${ip.name} rights secured. Contract requires ${majorContract.required} releases by week ${majorContract.deadlineWeek}.`,
      };
    }
    return { success: true, message: `${ip.name} rights secured.` };
  }

  /** Generates a film title from an acquired IP — smarter than the old ": Adaptation" suffix. */
  generateIpTitle(ip: OwnedIp): string {
    // For books and games the IP name is already a strong film title
    if (ip.kind === 'book' || ip.kind === 'game') return ip.name;

    // Comics and superhero IPs get a subtitle — deterministic hash on ip.id so it's stable
    const SUPERHERO_SUBTITLES = [
      'The Origin', 'First Strike', 'Dark Horizon', 'Rise of the Guard', 'The Legacy',
      'Dawn of Heroes', 'The Reckoning', 'Revelation', 'Beyond the Veil', 'The First Chapter',
    ];
    const COMIC_SUBTITLES = [
      'Origins', 'The Hidden Truth', 'Dark Rising', 'Awakening', 'The First Arc',
      'New Blood', 'The Comeback', 'Into the Breach', 'Unmasked', 'The Long Shot',
    ];
    const pool = ip.kind === 'superhero' ? SUPERHERO_SUBTITLES : COMIC_SUBTITLES;
    let h = 0;
    for (let i = 0; i < ip.id.length; i++) h = (h * 31 + ip.id.charCodeAt(i)) | 0;
    const subtitle = pool[Math.abs(h) % pool.length];
    return `${ip.name}: ${subtitle}`;
  }

  rollCastRequirements(): CastRequirements {
    const totalRoll = this.manager.eventRng();
    const total = totalRoll < 0.45 ? 1 : totalRoll < 0.9 ? 2 : 3;
    const actorCount = Math.floor(this.manager.eventRng() * (total + 1));
    const actressCount = total - actorCount;
    return { actorCount, actressCount };
  }

  developProjectFromIp(ipId: string): { success: boolean; message: string; projectId?: string } {
    const ip = this.manager.ownedIps.find((entry) => entry.id === ipId);
    if (!ip) return { success: false, message: 'IP not found.' };
    if (ip.expiresWeek < this.manager.currentWeek) return { success: false, message: 'IP rights window has expired.' };
    if (ip.usedProjectId) return { success: false, message: 'This IP is already in development.' };
    if (!this.manager.storyFlags[`owned_ip_${ip.id}`]) return { success: false, message: 'Acquire rights first.' };
    initializeMajorIpCommitmentForManager(this.manager, ip);
    const majorLock = getBlockingMajorIpCommitmentForManager(this.manager, ip.id);
    if (majorLock) {
      return {
        success: false,
        message: `Contract lock: launch the next ${majorLock.ip.name} installment before opening unrelated adaptations.`,
      };
    }
    if (this.manager.projectCapacityUsed >= this.manager.projectCapacityLimit) {
      return { success: false, message: `Studio capacity reached (${this.manager.projectCapacityUsed}/${this.manager.projectCapacityLimit}). Expand facilities first.` };
    }
    const castRequirements = this.rollCastRequirements();
    const budget = initialBudgetForGenre(ip.genre) * (ip.major ? 1.3 : 1.05);
    const project = createProjectFromIp(
      ip,
      this.generateIpTitle(ip),
      this.manager.talentService.buildProjectBudgetPlan(ip.genre, budget, castRequirements),
      castRequirements,
    );
    this.manager.activeProjects.push(project);
    ip.usedProjectId = project.id;
    if (this.manager.tutorialState === 'firstProject') {
      this.manager.tutorialService.advanceTutorial();
    }
    return { success: true, message: `${project.title} entered development from ${ip.name}.`, projectId: project.id };
  }
}
