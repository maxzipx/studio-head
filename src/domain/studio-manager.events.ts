import { createSeedScriptMarket } from './seeds';
import type {
  CrisisEvent,
  DecisionItem,
  EventTemplate,
  MovieProject,
  ScriptPitch,
  StoryArcState,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function tickDecisionExpiryForManager(manager: any, events: string[]): void {
  for (const item of manager.decisionQueue) {
    item.weeksUntilExpiry -= 1;
  }
  const expired = manager.decisionQueue.filter((item: any) => item.weeksUntilExpiry < 0);
  if (expired.length > 0) {
    for (const item of expired) {
      const flag = item.onExpireClearFlag;
      if (!flag) continue;
      const current = manager.storyFlags[flag] ?? 0;
      if (current <= 1) {
        delete manager.storyFlags[flag];
      } else {
        manager.storyFlags[flag] = current - 1;
      }
    }
    manager.decisionQueue = manager.decisionQueue.filter((item: any) => item.weeksUntilExpiry >= 0);
    events.push(`${expired.length} decision item(s) expired.`);
    manager.adjustReputation(-expired.length, 'all');
  }
}

export function tickScriptMarketExpiryForManager(manager: any, events: string[]): void {
  for (const item of manager.scriptMarket) {
    item.expiresInWeeks -= 1;
  }
  const expired = manager.scriptMarket.filter((item: any) => item.expiresInWeeks < 0);
  if (expired.length > 0) {
    manager.scriptMarket = manager.scriptMarket.filter((item: any) => item.expiresInWeeks >= 0);
    events.push(`${expired.length} script offer(s) expired from market.`);
  }
}

export function refillScriptMarketForManager(manager: any, events: string[]): void {
  const targetOffers = 4;
  if (manager.scriptMarket.length >= targetOffers) return;

  const catalog = createSeedScriptMarket();
  const existingTitles = new Set(manager.scriptMarket.map((item: any) => item.title));
  let added = 0;

  while (manager.scriptMarket.length < targetOffers) {
    const uniquePool = catalog.filter((item) => !existingTitles.has(item.title));
    const pool = uniquePool.length > 0 ? uniquePool : catalog;
    const source = pool[Math.floor(manager.eventRng() * pool.length)];
    if (!source) break;

    const qualityJitter = (manager.eventRng() - 0.5) * 0.6;
    const conceptJitter = (manager.eventRng() - 0.5) * 0.6;
    const priceMultiplier = 0.88 + manager.eventRng() * 0.28;
    const refreshed: ScriptPitch = {
      ...source,
      id: id('script'),
      askingPrice: Math.max(300_000, Math.round(source.askingPrice * priceMultiplier)),
      scriptQuality: clamp(source.scriptQuality + qualityJitter, 1, 10),
      conceptStrength: clamp(source.conceptStrength + conceptJitter, 1, 10),
      expiresInWeeks: 3 + Math.floor(manager.eventRng() * 4),
    };

    manager.scriptMarket.push(refreshed);
    existingTitles.add(refreshed.title);
    added += 1;
    if (added > 12) break;
  }

  if (added > 0) {
    events.push(`${added} new script offer(s) entered the market.`);
  }
}

export function rollForCrisesForManager(manager: any, events: string[]): void {
  const generated: CrisisEvent[] = [];
  for (const project of manager.activeProjects) {
    if (!['preProduction', 'production', 'postProduction'].includes(project.phase)) continue;
    const riskBoost = project.budget.overrunRisk * 0.2;
    const baseThreshold = project.phase === 'production' ? 0.16 : project.phase === 'postProduction' ? 0.1 : 0.08;
    const rollThreshold = baseThreshold + riskBoost;
    if (manager.crisisRng() > rollThreshold) continue;

    const crisis = buildOperationalCrisisForManager(manager, project);
    generated.push(crisis);
    project.productionStatus = 'inCrisis';
  }

  if (generated.length > 0) {
    manager.pendingCrises.push(...generated);
    events.push(`${generated.length} crisis event(s) triggered.`);
  }
}

export function generateEventDecisionsForManager(manager: any, events: string[]): void {
  if (manager.decisionQueue.length >= 4) return;

  const nextEvent = pickWeightedEventForManager(manager);
  if (!nextEvent) return;

  const project = chooseProjectForEventForManager(manager, nextEvent);
  if (nextEvent.scope === 'project' && !project) return;
  const decision = nextEvent.buildDecision({
    idFactory: id,
    projectId: project?.id ?? null,
    projectTitle: project?.title ?? null,
    currentWeek: manager.currentWeek,
  });
  decision.category ??= nextEvent.category;
  decision.sourceEventId ??= nextEvent.id;
  manager.decisionQueue.push(decision);
  manager.lastEventWeek.set(nextEvent.id, manager.currentWeek);
  manager.recentDecisionCategories.unshift(nextEvent.category);
  manager.recentDecisionCategories = manager.recentDecisionCategories.slice(0, 5);
  events.push(`New event: ${nextEvent.title}.`);
}

export function pickWeightedEventForManager(manager: any): EventTemplate | null {
  const queuedTitles = new Set(manager.decisionQueue.map((item: any) => item.title));
  const weighted = manager.eventDeck
    .filter((event: EventTemplate) => {
      if (manager.currentWeek < event.minWeek) return false;
      if (queuedTitles.has(event.decisionTitle)) return false;
      if (event.requiresFlag && !hasStoryFlagForManager(manager, event.requiresFlag)) return false;
      if (event.blocksFlag && hasStoryFlagForManager(manager, event.blocksFlag)) return false;
      if (event.requiresArc && !matchesArcRequirementForManager(manager, event.requiresArc)) return false;
      if (event.blocksArc && matchesArcRequirementForManager(manager, event.blocksArc)) return false;
      const lastWeek = manager.lastEventWeek.get(event.id);
      if (lastWeek !== undefined && manager.currentWeek - lastWeek < event.cooldownWeeks) return false;
      return true;
    })
    .map((event: EventTemplate) => ({ event, weight: eventWeightForManager(manager, event) }))
    .filter((entry: any) => entry.weight > 0);

  if (weighted.length === 0) return null;

  const total = weighted.reduce((sum: number, item: any) => sum + item.weight, 0);
  let roll = manager.eventRng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.event;
  }
  return weighted[weighted.length - 1].event;
}

export function eventWeightForManager(manager: any, event: EventTemplate): number {
  let weight = event.baseWeight;
  const modifiers = manager.getArcOutcomeModifiers();
  const candidates = getEventProjectCandidatesForManager(manager, event);
  if (event.scope === 'project' && candidates.length === 0) return 0;

  if (event.scope === 'project') {
    weight += Math.min(1.3, candidates.length * 0.32);
  }

  if (event.category === 'finance' && manager.cash < 25_000_000) {
    weight += 0.45;
  }
  if (event.category === 'marketing' && manager.studioHeat < 25) {
    weight += 0.35;
  }
  if (event.category === 'operations' && manager.pendingCrises.length > 0) {
    weight *= 0.75;
  }
  weight += modifiers.categoryBias[event.category] ?? 0;

  const arcId = getEventArcIdForManager(manager, event);
  if (arcId) {
    weight += getArcPressureFromRivalsForManager(manager, arcId);
  }

  if (manager.recentDecisionCategories[0] === event.category) {
    weight *= 0.7;
  }
  if (manager.recentDecisionCategories[0] === event.category && manager.recentDecisionCategories[1] === event.category) {
    weight *= 0.55;
  }

  return weight;
}

export function getEventArcIdForManager(_manager: any, event: EventTemplate): string | null {
  return event.requiresArc?.id ?? event.blocksArc?.id ?? null;
}

export function getArcPressureFromRivalsForManager(manager: any, arcId: string): number {
  let pressure = 0;
  for (const rival of manager.rivals) {
    const profile = manager.getRivalBehaviorProfile(rival);
    pressure += profile.arcPressure[arcId] ?? 0;
  }
  return clamp(pressure / Math.max(1, manager.rivals.length), 0, 0.7);
}

export function getEventProjectCandidatesForManager(manager: any, event: EventTemplate): MovieProject[] {
  if (event.scope !== 'project') return [];
  if (!event.targetPhases || event.targetPhases.length === 0) {
    return manager.activeProjects.filter((project: MovieProject) => project.phase !== 'released');
  }
  return manager.activeProjects.filter((project: MovieProject) => event.targetPhases?.includes(project.phase));
}

export function chooseProjectForEventForManager(manager: any, event: EventTemplate): MovieProject | null {
  const candidates = getEventProjectCandidatesForManager(manager, event);
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => b.hypeScore - a.hypeScore);
  const selectionPool = ranked.slice(0, Math.min(3, ranked.length));
  const index = Math.floor(manager.eventRng() * selectionPool.length);
  return selectionPool[index] ?? selectionPool[0] ?? null;
}

export function hasStoryFlagForManager(manager: any, flag: string): boolean {
  return (manager.storyFlags[flag] ?? 0) > 0;
}

export function matchesArcRequirementForManager(
  manager: any,
  input: { id: string; minStage?: number; maxStage?: number; status?: 'active' | 'resolved' | 'failed' }
): boolean {
  const arc = manager.storyArcs[input.id];
  if (!arc) return false;
  if (input.status && arc.status !== input.status) return false;
  if (typeof input.minStage === 'number' && arc.stage < input.minStage) return false;
  if (typeof input.maxStage === 'number' && arc.stage > input.maxStage) return false;
  return true;
}

export function ensureArcStateForManager(manager: any, arcId: string): StoryArcState {
  if (!manager.storyArcs[arcId]) {
    manager.storyArcs[arcId] = {
      stage: 0,
      status: 'active',
      lastUpdatedWeek: manager.currentWeek,
    };
  }
  return manager.storyArcs[arcId];
}

export function applyArcMutationForManager(manager: any, arcId: string, option: DecisionItem['options'][number]): void {
  const arc = ensureArcStateForManager(manager, arcId);
  if (typeof option.setArcStage === 'number') {
    arc.stage = Math.max(0, option.setArcStage);
  }
  if (typeof option.advanceArcBy === 'number') {
    arc.stage = Math.max(0, arc.stage + option.advanceArcBy);
  }
  if (option.resolveArc) {
    arc.status = 'resolved';
  } else if (option.failArc) {
    arc.status = 'failed';
  } else {
    arc.status = 'active';
  }
  arc.lastUpdatedWeek = manager.currentWeek;
}

export function applyStoryFlagMutationsForManager(manager: any, setFlag?: string, clearFlag?: string): void {
  if (setFlag) {
    manager.storyFlags[setFlag] = (manager.storyFlags[setFlag] ?? 0) + 1;
  }
  if (clearFlag) {
    delete manager.storyFlags[clearFlag];
  }
}

export function getDecisionTargetProjectForManager(manager: any, decision: DecisionItem): MovieProject | null {
  if (decision.projectId) {
    return manager.activeProjects.find((item: MovieProject) => item.id === decision.projectId) ?? null;
  }
  const ranked = manager.activeProjects
    .filter((project: MovieProject) => project.phase !== 'released')
    .sort((a: MovieProject, b: MovieProject) => b.hypeScore - a.hypeScore);
  return ranked[0] ?? manager.activeProjects[0] ?? null;
}

export function buildOperationalCrisisForManager(manager: any, project: MovieProject): CrisisEvent {
  const phaseTemplates: {
    title: string;
    body: string;
    severity: CrisisEvent['severity'];
    options: CrisisEvent['options'];
  }[] =
    project.phase === 'preProduction'
      ? [
          {
            title: 'Location Permit Reversal',
            body: 'Primary location permits were rescinded. Prep schedule is at risk.',
            severity: 'orange',
            options: [
              {
                id: id('c-opt'),
                label: 'Pay Fast-Track Permit Counsel',
                preview: '-$260K now, keep prep moving.',
                cashDelta: -260_000,
                scheduleDelta: 0,
                hypeDelta: 0,
              },
              {
                id: id('c-opt'),
                label: 'Re-scout Alternate Locations',
                preview: 'Lower spend, but schedule slips one week.',
                cashDelta: -80_000,
                scheduleDelta: 1,
                hypeDelta: -1,
              },
            ],
          },
          {
            title: 'Department Head Walkout Threat',
            body: 'A key department requests contract revisions before lock.',
            severity: 'orange',
            options: [
              {
                id: id('c-opt'),
                label: 'Approve Contract Bump',
                preview: '-$220K now, no delay.',
                cashDelta: -220_000,
                scheduleDelta: 0,
                hypeDelta: 0,
              },
              {
                id: id('c-opt'),
                label: 'Re-negotiate Through Delay',
                preview: 'Save cash but lose one prep week and confidence.',
                cashDelta: -40_000,
                scheduleDelta: 1,
                hypeDelta: -2,
              },
            ],
          },
        ]
      : project.phase === 'postProduction'
        ? [
            {
              title: 'VFX Vendor Capacity Crunch',
              body: 'Your primary vendor lost capacity to a tentpole competitor.',
              severity: 'orange',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Pay For Priority Lane',
                  preview: '-$300K now, lock delivery date.',
                  cashDelta: -300_000,
                  scheduleDelta: 0,
                  hypeDelta: 0,
                },
                {
                  id: id('c-opt'),
                  label: 'Delay Final Deliverables',
                  preview: 'Smaller immediate cost, but post slips by one week.',
                  cashDelta: -70_000,
                  scheduleDelta: 1,
                  hypeDelta: -2,
                },
              ],
            },
            {
              title: 'Score Recording Overrun',
              body: 'Orchestral sessions are exceeding booked stage time.',
              severity: 'yellow',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Extend Sessions',
                  preview: '-$180K now, preserve score quality.',
                  cashDelta: -180_000,
                  scheduleDelta: 0,
                  hypeDelta: 1,
                },
                {
                  id: id('c-opt'),
                  label: 'Scale Back Arrangement',
                  preview: 'Save cash, but lose some polish and buzz.',
                  cashDelta: -40_000,
                  scheduleDelta: 0,
                  hypeDelta: -2,
                },
              ],
            },
          ]
        : [
            {
              title: 'Lead Actor Scheduling Conflict',
              body: 'A hard conflict puts next week shooting at risk.',
              severity: project.productionStatus === 'atRisk' ? 'red' : 'orange',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Pay Overtime to Keep Schedule',
                  preview: '-$450K now, no schedule slip.',
                  cashDelta: -450_000,
                  scheduleDelta: 0,
                  hypeDelta: 0,
                },
                {
                  id: id('c-opt'),
                  label: 'Delay One Week',
                  preview: 'Save cash, but schedule slips and press chatter starts.',
                  cashDelta: -50_000,
                  scheduleDelta: 1,
                  hypeDelta: -3,
                },
              ],
            },
            {
              title: 'Set Build Failure',
              body: 'A key practical set failed safety checks before principal photography.',
              severity: 'orange',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Rebuild Immediately',
                  preview: '-$380K now, schedule protected.',
                  cashDelta: -380_000,
                  scheduleDelta: 0,
                  hypeDelta: 0,
                },
                {
                  id: id('c-opt'),
                  label: 'Rewrite Around Set',
                  preview: 'Save cash, but lose one week and some excitement.',
                  cashDelta: -90_000,
                  scheduleDelta: 1,
                  hypeDelta: -2,
                },
              ],
            },
            {
              title: 'Second Unit Incident',
              body: 'A second unit incident pauses action coverage for safety review.',
              severity: 'red',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Bring In Replacement Unit',
                  preview: '-$520K now to hold momentum.',
                  cashDelta: -520_000,
                  scheduleDelta: 0,
                  hypeDelta: -1,
                },
                {
                  id: id('c-opt'),
                  label: 'Hold For Safety Reset',
                  preview: 'Lower immediate spend, but lose two shooting weeks.',
                  cashDelta: -120_000,
                  scheduleDelta: 2,
                  hypeDelta: -3,
                },
              ],
            },
          ];

  const selected = phaseTemplates[Math.floor(manager.crisisRng() * phaseTemplates.length)] ?? phaseTemplates[0];
  return {
    id: id('crisis'),
    projectId: project.id,
    kind: 'production',
    title: `${project.title}: ${selected.title}`,
    severity: selected.severity,
    body: `${project.title} is affected. ${selected.body}`,
    options: selected.options,
  };
}
