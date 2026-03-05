/**
 * useProjectActions — derives all boolean "canX" predicates for a project's
 * available actions, keeping the project detail screen clean of 60+ lines of
 * inline conditional logic.
 */

import { useMemo } from 'react';
import { ACTION_BALANCE, FESTIVAL_RULES } from '@/src/domain/balance-constants';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject } from '@/src/domain/types';

export interface ProjectActions {
  canPush: boolean;
  canFestivalSubmit: boolean;
  canScriptSprint: boolean;
  canApproveGreenlight: boolean;
  canSendBack: boolean;
  canPolishPass: boolean;
  canTestScreening: boolean;
  canReshoot: boolean;
  canTrackingLeverage: boolean;
  canSetStrategy: boolean;
  canBrandReset: boolean;
  canLegacyCampaign: boolean;
  canHiatusPlan: boolean;
}

export function useProjectActions(project: MovieProject, manager: StudioManager): ProjectActions {
  return useMemo(() => {
    const franchiseStatus = manager.getFranchiseStatus(project.id);
    const isSequelProject = !!project.franchiseId && (project.franchiseEpisode ?? 0) > 1;
    const projectCrisesCount = manager.pendingCrises.filter((c) => c.projectId === project.id).length;

    void projectCrisesCount; // used indirectly via blockers in parent; kept for reference

    return {
      canPush:
        project.phase !== 'released' && manager.cash >= ACTION_BALANCE.OPTIONAL_ACTION_COST,

      canFestivalSubmit:
        (project.phase === 'postProduction' || project.phase === 'distribution') &&
        project.festivalStatus !== 'submitted' &&
        project.festivalStatus !== 'selected' &&
        project.festivalStatus !== 'buzzed' &&
        manager.cash >= FESTIVAL_RULES.SUBMISSION_COST,

      canScriptSprint:
        project.phase === 'development' &&
        manager.cash >= ACTION_BALANCE.SCRIPT_SPRINT_COST &&
        project.scriptQuality < ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY,

      canApproveGreenlight:
        project.phase === 'development' &&
        !!project.directorId &&
        manager.meetsCastRequirements(project) &&
        project.scriptQuality >= 6 &&
        !project.greenlightApproved &&
        manager.cash >= ACTION_BALANCE.GREENLIGHT_APPROVAL_FEE,

      canSendBack:
        project.phase === 'development' &&
        !!project.directorId &&
        manager.meetsCastRequirements(project) &&
        project.scriptQuality >= 6,

      canPolishPass:
        project.phase === 'postProduction' &&
        manager.cash >= ACTION_BALANCE.POLISH_PASS_COST &&
        project.editorialScore < ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL &&
        (project.postPolishPasses ?? 0) < ACTION_BALANCE.POLISH_PASS_MAX_USES,

      canTestScreening:
        (project.phase === 'postProduction' || project.phase === 'distribution') &&
        manager.cash >= ACTION_BALANCE.TEST_SCREENING_COST,

      canReshoot:
        project.phase === 'postProduction' &&
        !!project.testScreeningCompleted &&
        manager.cash >= ACTION_BALANCE.RESHOOT_COST,

      canTrackingLeverage:
        project.phase === 'distribution' && (project.trackingLeverageAmount ?? 0) <= 0,

      canSetStrategy:
        isSequelProject &&
        (project.phase === 'development' || project.phase === 'preProduction') &&
        project.franchiseStrategy === 'balanced',

      canBrandReset:
        !!franchiseStatus &&
        isSequelProject &&
        manager.cash >= franchiseStatus.nextBrandResetCost &&
        (project.phase === 'development' || project.phase === 'preProduction'),

      canLegacyCampaign:
        !!franchiseStatus &&
        isSequelProject &&
        project.phase !== 'released' &&
        manager.cash >= franchiseStatus.nextLegacyCastingCampaignCost,

      canHiatusPlan:
        !!franchiseStatus &&
        isSequelProject &&
        project.phase !== 'production' &&
        project.phase !== 'released' &&
        manager.cash >= franchiseStatus.nextHiatusPlanCost,
    };
  }, [project, manager]);
}
