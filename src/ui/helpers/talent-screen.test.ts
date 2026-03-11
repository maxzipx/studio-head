import { describe, expect, it } from 'vitest';

import { StudioManager } from '../../domain/studio-manager';
import { buildTalentScreenProjectView } from './talent-screen';

describe('buildTalentScreenProjectView', () => {
  it('filters negotiations and roster to the selected project', () => {
    const manager = new StudioManager();
    const [projectA, projectB] = manager.activeProjects;
    const [directorA, directorB] = manager.talentPool.filter((talent) => talent.role === 'director');

    if (!projectA || !projectB || !directorA || !directorB) {
      throw new Error('Expected seeded projects and directors for talent screen helper test.');
    }

    directorA.attachedProjectId = projectA.id;
    directorA.availability = 'attached';
    directorB.attachedProjectId = projectB.id;
    directorB.availability = 'attached';
    manager.playerNegotiations = [
      { projectId: projectA.id, talentId: 'talent-a', openedWeek: manager.currentWeek },
      { projectId: projectB.id, talentId: 'talent-b', openedWeek: manager.currentWeek },
    ];

    const view = buildTalentScreenProjectView({
      activeProject: projectA,
      playerNegotiations: manager.playerNegotiations,
      talentPool: manager.talentPool,
      getProjectCastStatus: manager.getProjectCastStatus.bind(manager),
    });

    expect(view.openNegotiations).toHaveLength(1);
    expect(view.openNegotiations[0]?.projectId).toBe(projectA.id);
    expect(view.rosterTalent).toHaveLength(1);
    expect(view.rosterTalent[0]?.attachedProjectId).toBe(projectA.id);
  });

  it('shows only candidates for roles the selected project still needs', () => {
    const manager = new StudioManager();
    const project = manager.activeProjects[0];
    const director = manager.talentPool.find((talent) => talent.role === 'director');
    const actor = manager.talentPool.find((talent) => talent.role === 'leadActor');
    const spareDirector = manager.talentPool.find((talent) => talent.role === 'director' && talent.id !== director?.id);
    const spareActor = manager.talentPool.find((talent) => talent.role === 'leadActor' && talent.id !== actor?.id);
    const spareActress = manager.talentPool.find((talent) => talent.role === 'leadActress');

    if (!project || !director || !actor || !spareDirector || !spareActor || !spareActress) {
      throw new Error('Expected seeded project and lead talent for talent screen helper test.');
    }

    project.castRequirements.actorCount = 1;
    project.castRequirements.actressCount = 1;
    project.directorId = director.id;
    director.attachedProjectId = project.id;
    director.availability = 'attached';
    project.castIds = [actor.id];
    actor.attachedProjectId = project.id;
    actor.availability = 'attached';

    spareDirector.marketWindowExpiresWeek = manager.currentWeek + 4;
    spareDirector.availability = 'available';
    spareActor.marketWindowExpiresWeek = manager.currentWeek + 4;
    spareActor.availability = 'available';
    spareActress.marketWindowExpiresWeek = manager.currentWeek + 4;
    spareActress.availability = 'available';

    const view = buildTalentScreenProjectView({
      activeProject: project,
      playerNegotiations: manager.playerNegotiations,
      talentPool: manager.talentPool,
      getProjectCastStatus: manager.getProjectCastStatus.bind(manager),
    });

    expect(view.marketDirectors).toHaveLength(0);
    expect(view.marketActors).toHaveLength(0);
    expect(view.marketActresses.length).toBeGreaterThan(0);
    expect(view.neededSlots).toBe(1);
  });

  it('returns empty project-scoped lists when no project is selected', () => {
    const manager = new StudioManager();

    const view = buildTalentScreenProjectView({
      activeProject: null,
      playerNegotiations: manager.playerNegotiations,
      talentPool: manager.talentPool,
      getProjectCastStatus: manager.getProjectCastStatus.bind(manager),
    });

    expect(view.openNegotiations).toEqual([]);
    expect(view.rosterTalent).toEqual([]);
    expect(view.marketTalent).toEqual([]);
    expect(view.neededSlots).toBe(0);
  });
});
