import { describe, expect, it } from 'vitest';

import { StudioManager } from '../domain/studio-manager';
import {
  buildInboxDecisionsSignature,
  buildSlateProjectsSignature,
  buildTalentPoolSignature,
} from './view-signatures';

describe('view signatures', () => {
  it('changes inbox decision signature when expiry countdown changes', () => {
    const manager = new StudioManager();
    if (manager.decisionQueue.length === 0) {
      throw new Error('Expected seed decisions to exist for signature test.');
    }

    const before = buildInboxDecisionsSignature(manager.decisionQueue);
    manager.decisionQueue[0]!.weeksUntilExpiry -= 1;
    const after = buildInboxDecisionsSignature(manager.decisionQueue);

    expect(after).not.toBe(before);
  });

  it('changes slate project signature when project display fields change', () => {
    const manager = new StudioManager();
    const project = manager.activeProjects[0];
    if (!project) throw new Error('Expected at least one active project for signature test.');

    const before = buildSlateProjectsSignature(manager.activeProjects);
    project.title = `${project.title} Redux`;
    project.budget.actualSpend += 250_000;
    const after = buildSlateProjectsSignature(manager.activeProjects);

    expect(after).not.toBe(before);
  });

  it('changes talent signature when talent display fields change', () => {
    const manager = new StudioManager();
    const talent = manager.talentPool[0];
    if (!talent) throw new Error('Expected at least one talent entry for signature test.');

    const before = buildTalentPoolSignature(manager.talentPool);
    talent.availability = talent.availability === 'available' ? 'inNegotiation' : 'available';
    talent.relationshipMemory.trust += 1;
    const after = buildTalentPoolSignature(manager.talentPool);

    expect(after).not.toBe(before);
  });
});
