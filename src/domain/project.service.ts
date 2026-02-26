import { ACTION_BALANCE, FESTIVAL_RULES } from './balance-constants';
import { clamp } from './studio-manager.constants';
import { removeProjectFromFranchiseForManager } from './studio-manager.franchise.actions';
import type { MovieProject, DistributionOffer, CrisisEvent, DecisionItem, DepartmentTrack } from './types';

export interface ProjectManagerAdapter {
    activeProjects: MovieProject[];
    cash: number;
    currentWeek: number;
    marketingTeamLevel: number;
    departmentLevels: Record<DepartmentTrack, number>;
    distributionOffers: DistributionOffer[];
    pendingCrises: CrisisEvent[];
    decisionQueue: DecisionItem[];

    eventRng: () => number;
    getProjectedForProject: (projectId: string) => any;
    adjustCash: (delta: number) => void;
    evaluateBankruptcy: () => void;
    adjustReputation: (delta: number, pillar: any) => void;
    releaseTalent: (projectId: string, context: 'released' | 'abandoned') => void;
}

export function runGreenlightReviewForManager(manager: ProjectManagerAdapter, projectId: string, approve: boolean): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'development') {
        return { success: false, message: 'Greenlight review is only available during development.' };
    }
    if (!project.directorId || project.castIds.length < 1 || project.scriptQuality < 6) {
        return { success: false, message: 'Project is not ready for a greenlight review yet.' };
    }

    if (!approve) {
        project.greenlightApproved = false;
        project.sentBackForRewriteCount = (project.sentBackForRewriteCount ?? 0) + 1;
        project.scriptQuality = clamp(project.scriptQuality + 0.2, 0, 9.5);
        project.hypeScore = clamp(project.hypeScore - 1, 0, 100);
        return {
            success: true,
            message: `${project.title} sent back for rewrite. Script +0.2, hype -1.`,
        };
    }

    const feeReduction = manager.departmentLevels.development * 15_000;
    const approvalFee = Math.max(120_000, ACTION_BALANCE.GREENLIGHT_APPROVAL_FEE - feeReduction);
    if (manager.cash < approvalFee) {
        return {
            success: false,
            message: `Insufficient cash for greenlight approval ($${Math.round(approvalFee / 1000)}K needed).`,
        };
    }
    manager.adjustCash(-approvalFee);
    project.greenlightApproved = true;
    project.greenlightWeek = manager.currentWeek;
    project.greenlightFeePaid = (project.greenlightFeePaid ?? 0) + approvalFee;
    project.greenlightLockedCeiling = project.budget.ceiling;
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `${project.title} greenlit. Approval fee paid and budget ceiling locked.`,
    };
}

export function runTestScreeningForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction' && project.phase !== 'distribution') {
        return { success: false, message: 'Test screenings are only available in post-production or distribution.' };
    }
    if (manager.cash < ACTION_BALANCE.TEST_SCREENING_COST) {
        return { success: false, message: 'Insufficient cash for test screening.' };
    }

    const projection = manager.getProjectedForProject(projectId);
    if (!projection) return { success: false, message: 'Projection unavailable.' };
    const confidence = clamp(0.58 + manager.marketingTeamLevel * 0.08, 0.6, 0.9);
    const variance = (1 - confidence) * 18;
    const offset = (manager.eventRng() - 0.5) * variance;
    const center = clamp(projection.critical + offset, 20, 95);
    const low = clamp(center - (7 + (1 - confidence) * 6), 10, 98);
    const high = clamp(center + (7 + (1 - confidence) * 6), 12, 99);
    const sentiment: MovieProject['testScreeningAudienceSentiment'] =
        center >= 74 ? 'strong' : center >= 58 ? 'mixed' : 'weak';

    manager.adjustCash(-ACTION_BALANCE.TEST_SCREENING_COST);
    project.testScreeningCompleted = true;
    project.testScreeningWeek = manager.currentWeek;
    project.testScreeningCriticalLow = low;
    project.testScreeningCriticalHigh = high;
    project.testScreeningAudienceSentiment = sentiment;
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `${project.title} test screening complete. Critics look ${low.toFixed(0)}-${high.toFixed(0)} with ${sentiment} audience sentiment.`,
    };
}

export function runReshootsForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction') {
        return { success: false, message: 'Reshoots are only available during post-production.' };
    }
    if (!project.testScreeningCompleted) {
        return { success: false, message: 'Run a test screening first to justify reshoots.' };
    }
    if (manager.cash < ACTION_BALANCE.RESHOOT_COST) {
        return { success: false, message: 'Insufficient cash for reshoots.' };
    }

    manager.adjustCash(-ACTION_BALANCE.RESHOOT_COST);
    project.scriptQuality = clamp(project.scriptQuality + 0.25, 0, 10);
    project.editorialScore = clamp(project.editorialScore + 0.4, 0, 10);
    project.scheduledWeeksRemaining += ACTION_BALANCE.RESHOOT_SCHEDULE_WEEKS;
    project.reshootCount = (project.reshootCount ?? 0) + 1;
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `${project.title} reshoots approved. +1 week schedule, quality and editorial improved.`,
    };
}

export function runTrackingLeverageForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'distribution') {
        return { success: false, message: 'Tracking leverage is only available in distribution.' };
    }
    if ((project.trackingLeverageAmount ?? 0) > 0) {
        return { success: false, message: 'Tracking leverage already used on this project.' };
    }
    const projection = manager.getProjectedForProject(project.id);
    if (!projection) return { success: false, message: 'Tracking unavailable right now.' };

    const confidence = clamp(0.57 + manager.marketingTeamLevel * 0.075, 0.6, 0.9);
    const projectedOpening = projection.openingHigh * (0.86 + confidence * 0.24);
    const leverageCap = projectedOpening * project.studioRevenueShare * ACTION_BALANCE.TRACKING_LEVERAGE_SHARE_CAP;
    const advance = Math.round(leverageCap);
    if (advance <= 0) return { success: false, message: 'Tracking confidence is too low for leverage this week.' };

    project.trackingProjectionOpening = projectedOpening;
    project.trackingConfidence = confidence;
    project.trackingLeverageAmount = advance;
    project.trackingSettled = false;
    manager.adjustCash(advance);
    return {
        success: true,
        message: `Leveraged ${project.title} tracking for $${Math.round(advance / 1000)}K in early cash.`,
    };
}

export function runScriptDevelopmentSprintForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'development') {
        return { success: false, message: 'Script sprint is only available during development.' };
    }
    if (project.scriptQuality >= ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY) {
        return { success: false, message: `${project.title} is already at max sprint quality (8.5).` };
    }
    if (manager.cash < ACTION_BALANCE.SCRIPT_SPRINT_COST) return { success: false, message: 'Insufficient cash for script sprint ($100K needed).' };
    const sprintBoost = ACTION_BALANCE.SCRIPT_SPRINT_QUALITY_BOOST + manager.departmentLevels.development * 0.08;
    manager.adjustCash(-ACTION_BALANCE.SCRIPT_SPRINT_COST);
    project.scriptQuality = clamp(
        project.scriptQuality + sprintBoost,
        0,
        ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY
    );
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `Script sprint on ${project.title}. Script quality now ${project.scriptQuality.toFixed(1)}.`,
    };
}

export function runPostProductionPolishPassForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction') {
        return { success: false, message: 'Polish pass is only available during post-production.' };
    }
    if (
        (project.postPolishPasses ?? 0) >= ACTION_BALANCE.POLISH_PASS_MAX_USES ||
        project.editorialScore >= ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL
    ) {
        return { success: false, message: `${project.title} has no polish passes remaining.` };
    }
    if (manager.cash < ACTION_BALANCE.POLISH_PASS_COST) return { success: false, message: 'Insufficient cash for polish pass ($120K needed).' };
    manager.adjustCash(-ACTION_BALANCE.POLISH_PASS_COST);
    project.postPolishPasses = Math.min(ACTION_BALANCE.POLISH_PASS_MAX_USES, (project.postPolishPasses ?? 0) + 1);
    project.editorialScore = clamp(
        project.editorialScore + ACTION_BALANCE.POLISH_PASS_EDITORIAL_BOOST,
        0,
        ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL
    );
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `Polish pass on ${project.title}. Editorial score now ${project.editorialScore.toFixed(1)}.`,
    };
}

function pickFestivalTarget(project: MovieProject): string {
    const prestigeBias = project.prestige + project.scriptQuality * 4 + project.originality * 0.18;
    if (prestigeBias >= 78) return 'Cannes';
    if (project.genre === 'documentary' || project.genre === 'drama') return 'Sundance';
    return 'Toronto';
}

export function runFestivalSubmissionForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction' && project.phase !== 'distribution') {
        return { success: false, message: 'Festival submissions are only available in post-production or distribution.' };
    }
    if (project.festivalStatus === 'submitted' && project.festivalResolutionWeek && manager.currentWeek < project.festivalResolutionWeek) {
        return { success: false, message: `${project.title} already has a pending festival submission.` };
    }
    if (project.festivalStatus === 'selected' || project.festivalStatus === 'buzzed') {
        return { success: false, message: `${project.title} already has a completed festival run.` };
    }
    if (manager.cash < FESTIVAL_RULES.SUBMISSION_COST) {
        return { success: false, message: `Insufficient cash for festival submission ($${Math.round(FESTIVAL_RULES.SUBMISSION_COST / 1000)}K needed).` };
    }

    const targetFestival = pickFestivalTarget(project);
    manager.adjustCash(-FESTIVAL_RULES.SUBMISSION_COST);
    project.festivalStatus = 'submitted';
    project.festivalTarget = targetFestival;
    project.festivalSubmissionWeek = manager.currentWeek;
    project.festivalResolutionWeek = manager.currentWeek + FESTIVAL_RULES.RESOLUTION_WEEKS;
    project.hypeScore = clamp(project.hypeScore + 1, 0, 100);
    manager.evaluateBankruptcy();

    return {
        success: true,
        message: `${project.title} submitted to ${targetFestival}. Results expected around week ${project.festivalResolutionWeek}.`,
    };
}

export function abandonProjectForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'released') return { success: false, message: 'Released projects cannot be abandoned.' };
    const writeDown = Math.round(project.budget.actualSpend * 0.2);
    manager.adjustCash(-writeDown);
    manager.adjustReputation(-4, 'talent');
    manager.evaluateBankruptcy();
    manager.releaseTalent(projectId, 'abandoned');

    // Note: franchise.actions imports need any manager, this may need adjustment later but safe for now
    removeProjectFromFranchiseForManager(manager as any, projectId);

    manager.activeProjects = manager.activeProjects.filter((item) => item.id !== projectId);
    manager.distributionOffers = manager.distributionOffers.filter((item) => item.projectId !== projectId);
    manager.pendingCrises = manager.pendingCrises.filter((item) => item.projectId !== projectId);
    manager.decisionQueue = manager.decisionQueue.filter((item) => item.projectId !== projectId);
    return {
        success: true,
        message: `${project.title} abandoned. $${Math.round(writeDown / 1000)}K write-down charged. Talent rep -4.`,
    };
}

export function runOptionalActionForManager(manager: ProjectManagerAdapter): { success: boolean; message: string } {
    const project = manager.activeProjects
        .filter((item) => item.phase !== 'released')
        .sort((a, b) => {
            if (a.marketingBudget === b.marketingBudget) return b.hypeScore - a.hypeScore;
            return a.marketingBudget - b.marketingBudget;
        })[0];
    if (!project) return { success: false, message: 'No active project available for optional action.' };
    if (manager.cash < ACTION_BALANCE.OPTIONAL_ACTION_COST) {
        return { success: false, message: 'Insufficient cash for optional campaign action.' };
    }

    const bonusLevels = Math.max(0, manager.marketingTeamLevel - 1);
    const hypeGain =
        ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST + bonusLevels * ACTION_BALANCE.MARKETING_TEAM_HYPE_BONUS_PER_LEVEL;
    const marketingGain =
        ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST + bonusLevels * ACTION_BALANCE.MARKETING_TEAM_BUDGET_BONUS_PER_LEVEL;
    project.hypeScore = clamp(project.hypeScore + hypeGain, 0, 100);
    project.marketingBudget += marketingGain;
    manager.adjustCash(-ACTION_BALANCE.OPTIONAL_ACTION_COST);
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `Optional campaign executed on ${project.title}. Hype +${Math.round(hypeGain)} and marketing +$${Math.round(marketingGain / 1000)}K.`,
    };
}

export function runMarketingPushOnProjectForManager(manager: ProjectManagerAdapter, projectId: string): { success: boolean; message: string } {
    const project = manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'distribution' || project.phase === 'released') {
        return { success: false, message: 'Marketing push not available after distribution begins.' };
    }
    if (manager.cash < ACTION_BALANCE.OPTIONAL_ACTION_COST) return { success: false, message: 'Insufficient cash for marketing push ($180K needed).' };
    const bonusLevels = Math.max(0, manager.marketingTeamLevel - 1);
    const hypeGain =
        ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST + bonusLevels * ACTION_BALANCE.MARKETING_TEAM_HYPE_BONUS_PER_LEVEL;
    const marketingGain =
        ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST + bonusLevels * ACTION_BALANCE.MARKETING_TEAM_BUDGET_BONUS_PER_LEVEL;
    project.hypeScore = clamp(project.hypeScore + hypeGain, 0, 100);
    project.marketingBudget += marketingGain;
    manager.adjustCash(-ACTION_BALANCE.OPTIONAL_ACTION_COST);
    manager.evaluateBankruptcy();
    return {
        success: true,
        message: `Marketing push on ${project.title}. Hype +${Math.round(hypeGain)}, marketing +$${Math.round(marketingGain / 1000)}K.`,
    };
}
