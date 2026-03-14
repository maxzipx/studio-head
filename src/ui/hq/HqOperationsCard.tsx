import { Text, TextInput, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import type { DepartmentTrack, StudioSpecialization } from '@/src/domain/types';
import { ACTION_BALANCE } from '@/src/domain/balance-constants';
import { CollapsibleCard, MetricTile, PremiumButton, ProgressBar, SectionLabel } from '@/src/ui/components';
import { PARTNER_OPTIONS, SPECIALIZATION_OPTIONS, money } from '@/src/ui/hq/hq-helpers';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing } from '@/src/ui/tokens';

const SPECIALIZATION_EFFECTS: Record<StudioSpecialization, string> = {
  balanced: 'No bias: stable openings, stable burn, neutral awards profile.',
  blockbuster: '+Opening pull, -critic ceiling, +burn pressure, stronger distribution leverage.',
  prestige: '+Critics and awards upside, lower opening pop, slight burn increase.',
  indie: 'Lower burn profile, modest critical upside, lighter commercial leverage.',
};

interface HqOperationsCardProps {
  manager: StudioManager;
  projectCapacityUsed: number;
  projectCapacityLimit: number;
  isGameOver: boolean;
  studioNameDraft: string;
  onStudioNameDraftChange: (value: string) => void;
  onRenameStudio: (name: string) => void;
  onUpgradeMarketingTeam: () => void;
  onUpgradeStudioCapacity: () => void;
  onFoundAnimationDivision: () => void;
  onRunOptionalAction: () => void;
  onSetStudioSpecialization: (focus: StudioSpecialization) => void;
  onInvestDepartment: (track: DepartmentTrack) => void;
  onSignExclusivePartner: (partner: string) => void;
  onPoachExecutiveTeam: () => void;
  optionalActionHype: number;
  optionalActionMarketing: number;
  trackingConfidenceLo: number;
  trackingConfidenceHi: number;
  marketingUpgradeCost: number | null;
  capacityUpgradeCost: number | null;
  marketingTierCap: number;
  capacityTierCap: number;
  hasPendingSpecializationChange: boolean;
  specializationPivotCost: number;
  executivePoachCost: number | null;
  activePartner: string | null;
  partnerWeeksRemaining: number;
  developmentUpgradeCost: number | null;
  productionUpgradeCost: number | null;
  distributionUpgradeCost: number | null;
  animationDivisionCost: number;
}

export function HqOperationsCard({
  manager,
  projectCapacityUsed,
  projectCapacityLimit,
  isGameOver,
  studioNameDraft,
  onStudioNameDraftChange,
  onRenameStudio,
  onUpgradeMarketingTeam,
  onUpgradeStudioCapacity,
  onFoundAnimationDivision,
  onRunOptionalAction,
  onSetStudioSpecialization,
  onInvestDepartment,
  onSignExclusivePartner,
  onPoachExecutiveTeam,
  optionalActionHype,
  optionalActionMarketing,
  trackingConfidenceLo,
  trackingConfidenceHi,
  marketingUpgradeCost,
  capacityUpgradeCost,
  marketingTierCap,
  capacityTierCap,
  hasPendingSpecializationChange,
  specializationPivotCost,
  executivePoachCost,
  activePartner,
  partnerWeeksRemaining,
  developmentUpgradeCost,
  productionUpgradeCost,
  distributionUpgradeCost,
  animationDivisionCost,
}: HqOperationsCardProps) {
  return (
    <CollapsibleCard
      title="Operations"
      badge={`Cap ${projectCapacityUsed}/${projectCapacityLimit}`}
      badgeColor={projectCapacityUsed >= projectCapacityLimit ? colors.accentRed : colors.accentGreen}
      defaultOpen={false}
    >
      <View>
        <SectionLabel label="Capacity" />
        <Text style={styles.muted}>
          Marketing improves optional-action output (+{optionalActionHype} hype and +{money(optionalActionMarketing)} project marketing)
          and boosts tracking confidence ({trackingConfidenceLo}% - {trackingConfidenceHi}%).
        </Text>
        <View style={[styles.capRow, { marginTop: spacing.sp1 }]}>
          <MetricTile value={`L${manager.marketingTeamLevel}`} label="Marketing" size="sm" />
          <MetricTile value={`${projectCapacityUsed}/${projectCapacityLimit}`} label="Slots" size="sm" />
          <MetricTile value={`L${manager.executiveNetworkLevel}`} label="Exec Network" size="sm" />
        </View>
        <ProgressBar
          value={(projectCapacityUsed / projectCapacityLimit) * 100}
          color={projectCapacityUsed >= projectCapacityLimit ? colors.accentRed : colors.accentGreen}
          height={4}
          animated
          style={{ marginTop: spacing.sp2 }}
        />
        <View style={[styles.actionsRow, { marginTop: spacing.sp2 }]}>
          <PremiumButton
            label={
              marketingUpgradeCost !== null
                ? `Upgrade Marketing (${money(marketingUpgradeCost)})`
                : `Marketing Cap Reached (L${marketingTierCap})`
            }
            onPress={onUpgradeMarketingTeam}
            disabled={isGameOver || marketingUpgradeCost === null || manager.cash < marketingUpgradeCost}
            variant="secondary"
            size="sm"
            style={styles.flexBtn}
          />
          <PremiumButton
            label={
              capacityUpgradeCost !== null
                ? `Expand Capacity (${money(capacityUpgradeCost)})`
                : `Capacity Cap Reached (+${capacityTierCap})`
            }
            onPress={onUpgradeStudioCapacity}
            disabled={isGameOver || capacityUpgradeCost === null || manager.cash < capacityUpgradeCost}
            variant="secondary"
            size="sm"
            style={styles.flexBtn}
          />
        </View>

        <SectionLabel label="Animation Division" style={{ marginTop: spacing.sp2 }} />
        <Text style={styles.muted}>
          {manager.animationDivisionUnlocked
            ? 'Animation pipeline active. Animation scripts can now enter the market.'
            : 'Unlock a dedicated animation pipeline. Animation scripts stay out of the market until this division is active.'}
        </Text>
        <PremiumButton
          label={
            manager.animationDivisionUnlocked
              ? 'Animation Division Active'
              : `Found Animation Division (${money(animationDivisionCost)})`
          }
          onPress={onFoundAnimationDivision}
          disabled={isGameOver || manager.animationDivisionUnlocked || manager.cash < animationDivisionCost}
          variant={manager.animationDivisionUnlocked ? 'ghost' : 'secondary'}
          size="sm"
          style={{ marginTop: spacing.sp1 }}
        />
        <Text style={styles.muted}>
          Tier gates: marketing cap L{marketingTierCap}; expansion cap +{capacityTierCap} slot{capacityTierCap === 1 ? '' : 's'} at your current tier.
        </Text>

        <SectionLabel label="Optional Marketing Push" style={{ marginTop: spacing.sp2 }} />
        <Text style={styles.muted}>
          Costs {money(ACTION_BALANCE.OPTIONAL_ACTION_COST)} cash per use.
          Boosts the active project with the lightest campaign by +{optionalActionHype} Hype and +{money(optionalActionMarketing)} in extra marketing.
        </Text>
        <PremiumButton
          label={`Run Campaign Boost (+${optionalActionHype} Hype)`}
          onPress={onRunOptionalAction}
          disabled={isGameOver}
          variant="secondary"
          size="sm"
          style={{ marginTop: spacing.sp1 }}
        />
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sp3, gap: spacing.sp2 }}>
        <SectionLabel label="Studio Identity" />
        <TextInput
          value={studioNameDraft}
          onChangeText={onStudioNameDraftChange}
          placeholder="Enter studio name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={32}
        />
        <PremiumButton label="Rename Studio" onPress={() => onRenameStudio(studioNameDraft)} variant="secondary" size="sm" />

        <SectionLabel label="Specialization" style={{ marginTop: spacing.sp1 }} />
        <Text style={styles.muted}>
          Choose one focus. Changes are staged now and committed on End Turn. First commitment is free, then {money(1_000_000)} per committed change.
        </Text>
        <View style={styles.actionsRow}>
          {SPECIALIZATION_OPTIONS.map((option) => (
            <PremiumButton
              key={option.key}
              label={option.label}
              onPress={() => onSetStudioSpecialization(option.key)}
              disabled={isGameOver}
              variant={manager.pendingSpecialization === option.key ? 'primary' : 'secondary'}
              size="sm"
              style={styles.choiceBtn}
            />
          ))}
        </View>
        <Text style={styles.muted}>
          Active effect: {SPECIALIZATION_EFFECTS[manager.studioSpecialization]}
        </Text>
        {hasPendingSpecializationChange ? (
          <Text style={[styles.muted, { color: specializationPivotCost > manager.cash ? colors.accentRed : colors.goldMid }]}>
            Pending: {manager.pendingSpecialization} ({specializationPivotCost > 0 ? `${money(specializationPivotCost)} on End Turn` : 'free on first commitment'})
            {specializationPivotCost > manager.cash ? ' - insufficient cash to commit this turn.' : ''}
          </Text>
        ) : null}

        <SectionLabel label="Departments" style={{ marginTop: spacing.sp1 }} />
        <Text style={styles.muted}>
          Development L{manager.departmentLevels.development} | Production L{manager.departmentLevels.production} | Distribution L{manager.departmentLevels.distribution}
        </Text>
        <Text style={styles.muted}>Development: -$15K greenlight fee and +0.08 script sprint quality per level.</Text>
        <Text style={styles.muted}>Production: about 3% lower weekly burn per level.</Text>
        <Text style={styles.muted}>Distribution: +1.5% leverage per level for stronger deal/counter terms.</Text>
        <View style={styles.actionsRow}>
          <PremiumButton
            label={developmentUpgradeCost === null ? 'Dev Maxed' : `Invest Dev (${money(developmentUpgradeCost)})`}
            onPress={() => onInvestDepartment('development')}
            disabled={isGameOver || developmentUpgradeCost === null || manager.cash < developmentUpgradeCost}
            variant="secondary"
            size="sm"
            style={styles.choiceBtn}
          />
          <PremiumButton
            label={productionUpgradeCost === null ? 'Prod Maxed' : `Invest Prod (${money(productionUpgradeCost)})`}
            onPress={() => onInvestDepartment('production')}
            disabled={isGameOver || productionUpgradeCost === null || manager.cash < productionUpgradeCost}
            variant="secondary"
            size="sm"
            style={styles.choiceBtn}
          />
          <PremiumButton
            label={distributionUpgradeCost === null ? 'Dist Maxed' : `Invest Dist (${money(distributionUpgradeCost)})`}
            onPress={() => onInvestDepartment('distribution')}
            disabled={isGameOver || distributionUpgradeCost === null || manager.cash < distributionUpgradeCost}
            variant="secondary"
            size="sm"
            style={styles.choiceBtn}
          />
        </View>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sp3, gap: spacing.sp2 }}>
        <SectionLabel label="Strategic Levers" />
        <Text style={styles.muted}>These are long-tail strategy actions with immediate costs and ongoing effects.</Text>
        <Text style={styles.muted}>Exclusive partner effect: +16% MG, +2% share, +8% P&A on matching offers (off-partner offers weaken).</Text>
        <Text style={styles.muted}>Executive network effect: improves distribution counter leverage and talent negotiation leverage.</Text>
        <Text style={styles.body}>
          Partner: <Text style={{ color: colors.goldMid }}>{activePartner ?? 'None'}</Text>
          {activePartner && manager.exclusivePartnerUntilWeek ? ` (${partnerWeeksRemaining}w remaining)` : ''}
        </Text>
        <View style={styles.actionsRow}>
          {PARTNER_OPTIONS.map((partner) => (
            <PremiumButton
              key={partner}
              label={`${partner.split(' ')[0]} (${money(480_000)})`}
              onPress={() => onSignExclusivePartner(partner)}
              disabled={isGameOver || manager.cash < 480_000 || activePartner === partner}
              variant={activePartner === partner ? 'primary' : 'secondary'}
              size="sm"
              style={styles.choiceBtn}
            />
          ))}
        </View>
        <Text style={styles.muted}>Executive network level: L{manager.executiveNetworkLevel} / 3</Text>
        <PremiumButton
          label={executivePoachCost === null ? 'Executive Network Maxed' : `Poach Executive Team (${money(executivePoachCost)})`}
          onPress={onPoachExecutiveTeam}
          disabled={isGameOver || executivePoachCost === null || manager.cash < executivePoachCost}
          variant="gold-outline"
          size="sm"
        />
      </View>
    </CollapsibleCard>
  );
}
