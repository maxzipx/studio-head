import type { IndustryNewsItem, MovieGenre, RivalFilm, RivalStudio, Talent } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function tickRivalHeatForManager(manager: any, events: string[]): void {
  for (const rival of manager.rivals) {
    const baseVolatility = manager.rivalRng() * 10 - 5;
    const personalityBias = rivalHeatBiasForManager(manager, rival.personality);
    const delta = clamp(baseVolatility + personalityBias, -12, 14);
    if (Math.abs(delta) < 3) continue;

    rival.studioHeat = clamp(rival.studioHeat + delta, 0, 100);
    const item: IndustryNewsItem = {
      id: id('news'),
      week: manager.currentWeek + 1,
      studioName: rival.name,
      headline: rivalNewsHeadlineForManager(manager, rival.name, delta),
      heatDelta: delta,
    };
    manager.industryNewsLog.unshift(item);
    events.push(item.headline);
  }
  manager.industryNewsLog = manager.industryNewsLog.slice(0, 60);
}

export function processRivalTalentAcquisitionsForManager(manager: any, events: string[]): void {
  for (const rival of manager.rivals) {
    const profile = getRivalBehaviorProfileForManager(manager, rival);
    if (manager.rivalRng() > profile.talentPoachChance) continue;
    let candidates = manager.talentPool.filter(
      (talent: Talent) => talent.availability === 'available' || talent.availability === 'inNegotiation'
    );
    if (rival.personality === 'prestigeHunter') {
      candidates = candidates.filter((talent: Talent) => talent.role === 'director');
    }
    if (candidates.length === 0) continue;

    const picked = pickTalentForRivalForManager(manager, rival, candidates);
    if (!picked) continue;

    const unavailableUntil = manager.currentWeek + 12 + Math.floor(manager.rivalRng() * 18);
    picked.availability = 'unavailable';
    picked.unavailableUntilWeek = unavailableUntil;
    picked.attachedProjectId = null;
    if (!rival.lockedTalentIds.includes(picked.id)) {
      rival.lockedTalentIds.push(picked.id);
    }

    if (manager.playerNegotiations.some((item: any) => item.talentId === picked.id)) {
      const negotiation = manager.playerNegotiations.find((item: any) => item.talentId === picked.id);
      if (negotiation) {
        const project = manager.activeProjects.find((item: any) => item.id === negotiation.projectId);
        const projectTitle = project?.title ?? 'your project';
        manager.pendingCrises.push({
          id: id('crisis'),
          projectId: negotiation.projectId,
          kind: 'talentPoached',
          title: `${picked.name} just closed with ${rival.name} (${projectTitle})`,
          severity: 'red',
          body: `${projectTitle} lost a key attachment. Counter-offer now at a premium or walk away.`,
          options: [
            {
              id: id('c-opt'),
              label: 'Counter Offer (25% premium)',
              preview: 'Higher cost, chance to reclaim attachment.',
              cashDelta: 0,
              scheduleDelta: 0,
              hypeDelta: 1,
              kind: 'talentCounter',
              talentId: picked.id,
              rivalStudioId: rival.id,
              premiumMultiplier: 1.25,
            },
            {
              id: id('c-opt'),
              label: 'Walk Away',
              preview: 'Save cash, lose momentum and relationship.',
              cashDelta: 0,
              scheduleDelta: 0,
              hypeDelta: -2,
              kind: 'talentWalk',
              talentId: picked.id,
              rivalStudioId: rival.id,
            },
          ],
        });
        events.push(`${rival.name} poached ${picked.name} from ${projectTitle}. Counter-offer decision required.`);
      }
    } else {
      events.push(`${rival.name} attached ${picked.name}. Available again around week ${unavailableUntil}.`);
    }
  }
}

export function processRivalCalendarMovesForManager(manager: any, events: string[]): void {
  const playerDistribution = manager.activeProjects.filter(
    (project: any) => project.phase === 'distribution' && project.releaseWeek !== null
  );
  for (const rival of manager.rivals) {
    const profile = getRivalBehaviorProfileForManager(manager, rival);
    if (manager.rivalRng() > profile.calendarMoveChance) continue;

    const target =
      rival.personality === 'blockbusterFactory'
        ? [...playerDistribution].sort((a, b) => (a.releaseWeek ?? 10_000) - (b.releaseWeek ?? 10_000))[0]
        : playerDistribution[Math.floor(manager.rivalRng() * Math.max(1, playerDistribution.length))];
    const forceConflict =
      !!target && (rival.personality === 'blockbusterFactory' || manager.rivalRng() < profile.conflictPush);
    const week =
      forceConflict && target.releaseWeek ? target.releaseWeek : manager.currentWeek + 2 + Math.floor(manager.rivalRng() * 14);
    const genre: MovieGenre = (
      ['action', 'drama', 'comedy', 'horror', 'thriller', 'sciFi', 'animation', 'documentary'] as MovieGenre[]
    )[Math.floor(manager.rivalRng() * 8)];

    const film: RivalFilm = {
      id: id('r-film'),
      title: `${rival.name.split(' ')[0]} Untitled ${manager.currentWeek}`,
      genre,
      releaseWeek: week,
      releaseWindow: 'wideTheatrical',
      estimatedBudget: (20_000_000 + manager.rivalRng() * 120_000_000) * profile.budgetScale,
      hypeScore: clamp((35 + manager.rivalRng() * 45) * profile.hypeScale, 20, 98),
      finalGross: null,
      criticalScore: null,
    };

    rival.upcomingReleases.unshift(film);
    rival.upcomingReleases = rival.upcomingReleases
      .filter((item: RivalFilm) => item.releaseWeek >= manager.currentWeek - 1)
      .slice(0, 10);
    events.push(`${rival.name} scheduled ${film.title} for week ${film.releaseWeek}.`);

    if (target && target.releaseWeek && Math.abs(target.releaseWeek - film.releaseWeek) <= 0) {
      manager.pendingCrises.push({
        id: id('crisis'),
        projectId: target.id,
        kind: 'releaseConflict',
        title: `${target.title}: ${rival.name} moved into your release window`,
        severity: 'orange',
        body: `${target.title} is under opening pressure in week ${target.releaseWeek}.`,
        options: [
          {
            id: id('c-opt'),
            label: 'Hold Position',
            preview: 'Keep date and absorb competitive pressure.',
            cashDelta: 0,
            scheduleDelta: 0,
            hypeDelta: 0,
            releaseWeekShift: 0,
            kind: 'releaseHold',
          },
          {
            id: id('c-opt'),
            label: 'Shift 1 Week Earlier',
            preview: 'Move early to avoid overlap.',
            cashDelta: -120_000,
            scheduleDelta: 0,
            hypeDelta: -1,
            releaseWeekShift: -1,
            kind: 'releaseShift',
          },
          {
            id: id('c-opt'),
            label: 'Delay 4 Weeks',
            preview: 'Wait for cleaner window; costs additional carry.',
            cashDelta: -250_000,
            scheduleDelta: 0,
            hypeDelta: 1,
            releaseWeekShift: 4,
            kind: 'releaseShift',
          },
        ],
      });
    }
  }
}

export function processRivalSignatureMovesForManager(manager: any, events: string[]): void {
  for (const rival of manager.rivals) {
    const profile = getRivalBehaviorProfileForManager(manager, rival);
    if (manager.rivalRng() > profile.signatureMoveChance) continue;

    if (rival.personality === 'blockbusterFactory') {
      const target = manager.activeProjects.find((project: any) => project.phase === 'distribution' && project.releaseWeek !== null);
      if (target?.releaseWeek) {
        rival.upcomingReleases.unshift({
          id: id('r-film'),
          title: `${rival.name.split(' ')[0]} Event Tentpole`,
          genre: 'action',
          releaseWeek: target.releaseWeek,
          releaseWindow: 'wideTheatrical',
          estimatedBudget: 170_000_000 + manager.rivalRng() * 80_000_000,
          hypeScore: 80 + manager.rivalRng() * 15,
          finalGross: null,
          criticalScore: null,
        });
        const hadFlag = manager.hasStoryFlag('rival_tentpole_threat');
        manager.storyFlags.rival_tentpole_threat = (manager.storyFlags.rival_tentpole_threat ?? 0) + 1;
        if (!hadFlag) {
          queueRivalCounterplayDecisionForManager(manager, 'rival_tentpole_threat', rival.name, target.id);
        }
        events.push(`${rival.name} dropped a four-quadrant tentpole into your weekend corridor.`);
      }
      continue;
    }

    if (rival.personality === 'prestigeHunter') {
      manager.studioHeat = clamp(manager.studioHeat - 1.5, 0, 100);
      const hadFlag = manager.hasStoryFlag('awards_headwind');
      manager.storyFlags.awards_headwind = (manager.storyFlags.awards_headwind ?? 0) + 1;
      if (!hadFlag) {
        queueRivalCounterplayDecisionForManager(manager, 'awards_headwind', rival.name);
      }
      events.push(`${rival.name} dominated guild chatter this week. Awards headwind intensified.`);
      continue;
    }

    if (rival.personality === 'genreSpecialist') {
      const targetTalent = manager.talentPool
        .filter((talent: Talent) => talent.availability === 'available' && talent.role !== 'director')
        .sort((a: Talent, b: Talent) => b.craftScore - a.craftScore)[0];
      if (targetTalent) {
        targetTalent.availability = 'unavailable';
        targetTalent.unavailableUntilWeek = manager.currentWeek + 6;
        if (!rival.lockedTalentIds.includes(targetTalent.id)) {
          rival.lockedTalentIds.push(targetTalent.id);
        }
        const hadFlag = manager.hasStoryFlag('rival_talent_lock');
        manager.storyFlags.rival_talent_lock = (manager.storyFlags.rival_talent_lock ?? 0) + 1;
        if (!hadFlag) {
          queueRivalCounterplayDecisionForManager(manager, 'rival_talent_lock', rival.name);
        }
        events.push(`${rival.name} locked ${targetTalent.name} into a niche franchise hold.`);
      }
      continue;
    }

    if (rival.personality === 'streamingFirst') {
      const project = manager.activeProjects
        .filter((item: any) => item.phase === 'distribution')
        .sort((a: any, b: any) => (a.releaseWeek ?? 10_000) - (b.releaseWeek ?? 10_000))[0];
      if (project) {
        manager.distributionOffers = manager.distributionOffers.filter(
          (item: any) => !(item.projectId === project.id && item.partner === `${rival.name} Stream+`)
        );
        manager.distributionOffers.push({
          id: id('deal'),
          projectId: project.id,
          partner: `${rival.name} Stream+`,
          releaseWindow: 'streamingExclusive',
          minimumGuarantee: project.budget.ceiling * 0.46,
          pAndACommitment: project.budget.ceiling * 0.055,
          revenueShareToStudio: 0.68,
          projectedOpeningOverride: 0.72,
          counterAttempts: 0,
        });
        const hadFlag = manager.hasStoryFlag('streaming_pressure');
        manager.storyFlags.streaming_pressure = (manager.storyFlags.streaming_pressure ?? 0) + 1;
        if (!hadFlag) {
          queueRivalCounterplayDecisionForManager(manager, 'streaming_pressure', rival.name, project.id);
        }
        events.push(`${rival.name} floated an aggressive competing streaming offer into your distribution stack.`);
      }
      continue;
    }

    if (rival.personality === 'scrappyUpstart') {
      const targetProject = manager.activeProjects.find(
        (project: any) => project.phase === 'distribution' || project.phase === 'released'
      );
      if (targetProject) {
        targetProject.hypeScore = clamp(targetProject.hypeScore - 2, 0, 100);
        const hadFlag = manager.hasStoryFlag('guerrilla_pressure');
        manager.storyFlags.guerrilla_pressure = (manager.storyFlags.guerrilla_pressure ?? 0) + 1;
        if (!hadFlag) {
          queueRivalCounterplayDecisionForManager(manager, 'guerrilla_pressure', rival.name, targetProject.id);
        }
        events.push(`${rival.name} ran a guerrilla social blitz that clipped hype on ${targetProject.title}.`);
      }
    }
  }
}

export function checkRivalReleaseResponsesForManager(manager: any, releasedProject: any, events: string[]): void {
  const nextDistributionProject = manager.activeProjects
    .filter((project: any) => project.id !== releasedProject.id && project.phase === 'distribution' && project.releaseWeek !== null)
    .sort((a: any, b: any) => (a.releaseWeek ?? 10_000) - (b.releaseWeek ?? 10_000))[0];
  const nextPipelineProject = manager.activeProjects
    .filter((project: any) => project.id !== releasedProject.id && project.phase !== 'released')
    .sort((a: any, b: any) => {
      const rank = (phase: string): number => {
        if (phase === 'development') return 0;
        if (phase === 'preProduction') return 1;
        if (phase === 'production') return 2;
        if (phase === 'postProduction') return 3;
        if (phase === 'distribution') return 4;
        return 5;
      };
      return rank(a.phase) - rank(b.phase);
    })[0];

  for (const rival of manager.rivals) {
    if (rival.personality === 'blockbusterFactory') {
      if (!nextDistributionProject?.releaseWeek) continue;
      const movedFilm = rival.upcomingReleases.find((film: RivalFilm) => film.releaseWeek >= manager.currentWeek + 1);
      if (movedFilm) {
        movedFilm.releaseWeek = nextDistributionProject.releaseWeek;
      } else {
        rival.upcomingReleases.unshift({
          id: id('r-film'),
          title: `${rival.name.split(' ')[0]} Counterprogrammer`,
          genre: 'action',
          releaseWeek: nextDistributionProject.releaseWeek,
          releaseWindow: 'wideTheatrical',
          estimatedBudget: 120_000_000 + manager.rivalRng() * 60_000_000,
          hypeScore: 70 + manager.rivalRng() * 20,
          finalGross: null,
          criticalScore: null,
        });
      }
      events.push(`${rival.name} moved its next tentpole into week ${nextDistributionProject.releaseWeek} to pressure your upcoming release.`);
      continue;
    }

    if (rival.personality === 'prestigeHunter') {
      const director = manager.talentPool
        .filter((talent: Talent) => talent.role === 'director' && (talent.availability === 'available' || talent.availability === 'inNegotiation'))
        .sort((a: Talent, b: Talent) => b.craftScore - a.craftScore)[0];
      if (!director) continue;
      director.availability = 'unavailable';
      director.unavailableUntilWeek = manager.currentWeek + 10 + Math.floor(manager.rivalRng() * 10);
      director.attachedProjectId = null;
      if (!rival.lockedTalentIds.includes(director.id)) {
        rival.lockedTalentIds.push(director.id);
      }
      events.push(`${rival.name} responded by poaching director ${director.name} into a prestige package.`);
      continue;
    }

    if (rival.personality === 'streamingFirst') {
      if (!nextPipelineProject) continue;
      const title = `Counterplay: ${rival.name} Output Deal (${nextPipelineProject.title})`;
      if (manager.decisionQueue.length < 5 && !manager.decisionQueue.some((item: any) => item.title === title)) {
        manager.decisionQueue.push({
          id: id('decision'),
          projectId: nextPipelineProject.id,
          category: 'finance',
          title,
          body: `${rival.name} offered a streaming-first output deal for ${nextPipelineProject.title}.`,
          weeksUntilExpiry: 1,
          options: [
            {
              id: id('opt'),
              label: 'Accept Output Deal',
              preview: 'Immediate cash and marketing support, with lower theatrical upside.',
              cashDelta: 320_000,
              scriptQualityDelta: 0,
              hypeDelta: 1,
              marketingDelta: 180_000,
              studioHeatDelta: -1,
            },
            {
              id: id('opt'),
              label: 'Decline Deal',
              preview: 'Keep flexibility and hold for stronger distribution leverage.',
              cashDelta: 0,
              scriptQualityDelta: 0,
              hypeDelta: 0,
              studioHeatDelta: 1,
            },
          ],
        });
        events.push(`${rival.name} put a streaming output deal on your next project.`);
      }
      continue;
    }

    if (rival.personality === 'scrappyUpstart') {
      const targetProject =
        nextPipelineProject ??
        manager.activeProjects
          .filter((project: any) => project.id !== releasedProject.id)
          .sort((a: any, b: any) => b.hypeScore - a.hypeScore)[0];
      if (!targetProject) continue;
      targetProject.hypeScore = clamp(targetProject.hypeScore - 3, 0, 100);
      manager.studioHeat = clamp(manager.studioHeat - 1, 0, 100);
      events.push(`${rival.name} launched a counter-campaign against ${targetProject.title}. Hype -3.`);
    }
  }
}

export function queueRivalCounterplayDecisionForManager(
  manager: any,
  flag: string,
  rivalName: string,
  projectId?: string
): void {
  if (manager.decisionQueue.length >= 5) return;
  const targetProject = projectId ? manager.activeProjects.find((item: any) => item.id === projectId) : null;

  if (flag === 'rival_tentpole_threat') {
    const title = `Counterplay: ${rivalName} Tentpole Threat`;
    if (manager.decisionQueue.some((item: any) => item.title === title)) return;
    manager.decisionQueue.push({
      id: id('decision'),
      projectId: targetProject?.id ?? null,
      category: 'marketing',
      title,
      body: 'A major rival crowded your release corridor. Choose how to defend opening week share.',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'rival_tentpole_threat',
      options: [
        {
          id: id('opt'),
          label: 'Authorize Competitive Blitz',
          preview: 'Spend to defend awareness and trailer share.',
          cashDelta: -260_000,
          scriptQualityDelta: 0,
          hypeDelta: 3,
          studioHeatDelta: 1,
          clearFlag: 'rival_tentpole_threat',
        },
        {
          id: id('opt'),
          label: 'Shift Date One Week',
          preview: 'Reduce collision risk with moderate transition cost.',
          cashDelta: -120_000,
          scriptQualityDelta: 0,
          hypeDelta: -1,
          releaseWeekShift: -1,
          clearFlag: 'rival_tentpole_threat',
        },
      ],
    });
    return;
  }

  if (flag === 'awards_headwind') {
    const title = `Counterplay: ${rivalName} Awards Surge`;
    if (manager.decisionQueue.some((item: any) => item.title === title)) return;
    manager.decisionQueue.push({
      id: id('decision'),
      projectId: null,
      category: 'marketing',
      title,
      body: 'Awards conversation shifted away from your slate. Decide whether to contest the narrative.',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'awards_headwind',
      options: [
        {
          id: id('opt'),
          label: 'Launch Guild Counter-Campaign',
          preview: 'Spend to recover influence with voters and press.',
          cashDelta: -180_000,
          scriptQualityDelta: 0,
          hypeDelta: 1,
          studioHeatDelta: 2,
          clearFlag: 'awards_headwind',
        },
        {
          id: id('opt'),
          label: 'Conserve Budget',
          preview: 'Protect cash but accept a temporary prestige dip.',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: -1,
          studioHeatDelta: -1,
          clearFlag: 'awards_headwind',
        },
      ],
    });
    return;
  }

  if (flag === 'rival_talent_lock') {
    const title = `Counterplay: ${rivalName} Talent Lock`;
    if (manager.decisionQueue.some((item: any) => item.title === title)) return;
    manager.decisionQueue.push({
      id: id('decision'),
      projectId: null,
      category: 'talent',
      title,
      body: 'Rival package deals are squeezing your talent access. Choose your labor strategy.',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'rival_talent_lock',
      options: [
        {
          id: id('opt'),
          label: 'Fund Retention Incentives',
          preview: 'Spend to improve relationship strength across reps.',
          cashDelta: -220_000,
          scriptQualityDelta: 0,
          hypeDelta: 1,
          studioHeatDelta: 1,
          clearFlag: 'rival_talent_lock',
        },
        {
          id: id('opt'),
          label: 'Scout Emerging Talent',
          preview: 'Smaller spend, slightly slower impact, broader optionality.',
          cashDelta: -80_000,
          scriptQualityDelta: 0,
          hypeDelta: 1,
          clearFlag: 'rival_talent_lock',
        },
      ],
    });
    return;
  }

  if (flag === 'streaming_pressure') {
    const title = `Counterplay: ${rivalName} Streaming Pressure`;
    if (manager.decisionQueue.some((item: any) => item.title === title)) return;
    manager.decisionQueue.push({
      id: id('decision'),
      projectId: targetProject?.id ?? null,
      category: 'finance',
      title,
      body: 'Aggressive streaming terms are distorting your release leverage.',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'streaming_pressure',
      options: [
        {
          id: id('opt'),
          label: 'Secure Theater Incentive Bundle',
          preview: 'Spend now to protect theatrical leverage.',
          cashDelta: -200_000,
          scriptQualityDelta: 0,
          hypeDelta: 2,
          studioHeatDelta: 1,
          clearFlag: 'streaming_pressure',
        },
        {
          id: id('opt'),
          label: 'Take Hybrid Safety Deal',
          preview: 'Accept immediate cash and de-risk near-term window.',
          cashDelta: 150_000,
          scriptQualityDelta: 0,
          hypeDelta: -1,
          clearFlag: 'streaming_pressure',
        },
      ],
    });
    return;
  }

  if (flag === 'guerrilla_pressure') {
    const title = `Counterplay: ${rivalName} Guerrilla Blitz`;
    if (manager.decisionQueue.some((item: any) => item.title === title)) return;
    manager.decisionQueue.push({
      id: id('decision'),
      projectId: targetProject?.id ?? null,
      category: 'marketing',
      title,
      body: 'A rival social blitz is pulling mindshare away from your campaign.',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'guerrilla_pressure',
      options: [
        {
          id: id('opt'),
          label: 'Run Community Counter-Blitz',
          preview: 'Low cost and quick response to regain attention.',
          cashDelta: -90_000,
          scriptQualityDelta: 0,
          hypeDelta: 2,
          clearFlag: 'guerrilla_pressure',
        },
        {
          id: id('opt'),
          label: 'Ignore The Noise',
          preview: 'No spend, but campaign momentum softens.',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: -1,
          clearFlag: 'guerrilla_pressure',
        },
      ],
    });
  }
}

export function rivalHeatBiasForManager(_manager: any, personality: RivalStudio['personality']): number {
  switch (personality) {
    case 'blockbusterFactory':
      return 0.8;
    case 'prestigeHunter':
      return 0.5;
    case 'genreSpecialist':
      return 0.2;
    case 'streamingFirst':
      return -0.2;
    case 'scrappyUpstart':
      return 0;
    default:
      return 0;
  }
}

export function getRivalBehaviorProfileForManager(manager: any, rival: RivalStudio): {
  arcPressure: Record<string, number>;
  talentPoachChance: number;
  calendarMoveChance: number;
  conflictPush: number;
  signatureMoveChance: number;
  budgetScale: number;
  hypeScale: number;
} {
  switch (rival.personality) {
    case 'blockbusterFactory':
      return {
        arcPressure: {
          'exhibitor-war': 0.6,
          'franchise-pivot': 0.5,
          'leak-piracy': 0.2,
        },
        talentPoachChance: 0.32,
        calendarMoveChance: 0.4,
        conflictPush: 0.5,
        signatureMoveChance: 0.22,
        budgetScale: 1.4,
        hypeScale: 1.25,
      };
    case 'prestigeHunter':
      return {
        arcPressure: {
          'awards-circuit': 0.6,
          'financier-control': 0.2,
          'talent-meltdown': 0.2,
        },
        talentPoachChance: 0.28,
        calendarMoveChance: 0.24,
        conflictPush: 0.2,
        signatureMoveChance: 0.2,
        budgetScale: 0.9,
        hypeScale: 1.05,
      };
    case 'genreSpecialist':
      return {
        arcPressure: {
          'talent-meltdown': 0.45,
          'leak-piracy': 0.25,
        },
        talentPoachChance: 0.38,
        calendarMoveChance: 0.3,
        conflictPush: 0.28,
        signatureMoveChance: 0.18,
        budgetScale: 1.05,
        hypeScale: 1.1,
      };
    case 'streamingFirst':
      return {
        arcPressure: {
          'exhibitor-war': 0.3,
          'financier-control': 0.35,
          'franchise-pivot': 0.2,
        },
        talentPoachChance: 0.24,
        calendarMoveChance: 0.18,
        conflictPush: 0.18,
        signatureMoveChance: 0.24,
        budgetScale: 0.85,
        hypeScale: 0.95,
      };
    case 'scrappyUpstart':
      return {
        arcPressure: {
          'talent-meltdown': 0.3,
          'leak-piracy': 0.3,
          'financier-control': 0.25,
        },
        talentPoachChance: 0.3,
        calendarMoveChance: 0.26,
        conflictPush: 0.3,
        signatureMoveChance: 0.2,
        budgetScale: 0.8,
        hypeScale: 1.15,
      };
    default:
      return {
        arcPressure: {},
        talentPoachChance: 0.3,
        calendarMoveChance: 0.28,
        conflictPush: 0.3,
        signatureMoveChance: 0.15,
        budgetScale: 1,
        hypeScale: 1,
      };
  }
}

export function rivalNewsHeadlineForManager(_manager: any, name: string, delta: number): string {
  if (delta >= 8) return `${name} lands a breakout hit. Heat +${delta.toFixed(0)}.`;
  if (delta >= 3) return `${name} posts a solid industry week. Heat +${delta.toFixed(0)}.`;
  if (delta <= -8) return `${name} stumbles on a costly miss. Heat ${delta.toFixed(0)}.`;
  return `${name} slips in the market conversation. Heat ${delta.toFixed(0)}.`;
}

export function pickTalentForRivalForManager(
  manager: any,
  rival: RivalStudio,
  candidates: Talent[]
): Talent | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates];
  if (rival.personality === 'blockbusterFactory') {
    sorted.sort((a, b) => b.starPower - a.starPower);
  } else if (rival.personality === 'prestigeHunter') {
    sorted.sort((a, b) => b.craftScore - a.craftScore);
  } else if (rival.personality === 'genreSpecialist') {
    sorted.sort((a, b) => b.egoLevel - a.egoLevel);
  } else {
    sorted.sort(() => manager.rivalRng() - 0.5);
  }
  return sorted[0] ?? null;
}
