import { Modal, Pressable, Text, View } from 'react-native';
import type { MovieProject, NegotiationAction } from '@/src/domain/types';
import type { NegotiationModalState } from '@/src/ui/hooks/useNegotiationModal';
import { GlassCard, PremiumButton, SectionLabel } from '@/src/ui/components';
import { colors, spacing } from '@/src/ui/tokens';
import {
  chanceColor,
  chanceLabel,
  money,
  pct,
} from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/talent/talent-styles';

interface TalentNegotiationModalProps {
  negModal: NegotiationModalState;
  activeProject: MovieProject | null;
}

export function TalentNegotiationModal({ negModal, activeProject }: TalentNegotiationModalProps) {
  return (
    <Modal visible={!!negModal.talent} transparent animationType="fade" onRequestClose={negModal.close}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDimLayer} onPress={negModal.close} />
        <GlassCard variant="elevated" style={styles.modalCard}>
          <SectionLabel label="Open Negotiation" />
          <Text style={styles.activeTitle}>{negModal.talent?.name ?? 'Talent'}</Text>
          <Text style={styles.muted}>{activeProject?.title ?? 'No active development target selected'}</Text>
          <Text style={styles.muted}>Pick one lever for round 1. Chance updates live before you submit.</Text>

          <View style={styles.actions}>
            {[
              { label: 'Salary+', action: 'sweetenSalary' },
              { label: 'Backend+', action: 'sweetenBackend' },
              { label: 'Perks+', action: 'sweetenPerks' },
              { label: 'Hold', action: 'holdFirm' },
            ].map((item) => (
              <PremiumButton
                key={item.action}
                label={item.label}
                onPress={() => negModal.setDraftAction(item.action as NegotiationAction)}
                variant={negModal.draftAction === item.action ? 'primary' : 'secondary'}
                size="sm"
                style={styles.negBtn}
              />
            ))}
          </View>

          {negModal.preview?.success && negModal.preview.preview ? (
            <GlassCard variant="default" style={{ gap: spacing.sp1 }}>
              <Text style={styles.muted}>
                Offer: {money((negModal.talent?.salary.base ?? 0) * negModal.preview.preview.salaryMultiplier)} salary  {negModal.preview.preview.backendPoints.toFixed(1)}pt backend  {money(negModal.preview.preview.perksBudget)} perks
              </Text>
              <Text style={[styles.bodyStrong, { color: chanceColor(negModal.preview.preview.chance) }]}>
                Close chance: {pct(negModal.preview.preview.chance)} - {chanceLabel(negModal.preview.preview.chance)}
              </Text>
              <Text style={styles.muted}>
                Their ask: {money((negModal.talent?.salary.base ?? 0) * negModal.preview.preview.demandSalaryMultiplier)} salary  {negModal.preview.preview.demandBackendPoints.toFixed(1)}pt backend  {money(negModal.preview.preview.demandPerksBudget)} perks
              </Text>
              <Text style={[styles.signal, { color: colors.goldMid }]}>{negModal.preview.preview.signal}</Text>
            </GlassCard>
          ) : (
            <Text style={[styles.alert, { color: colors.accentRed }]}>
              {negModal.preview?.message ?? 'Unable to preview this negotiation right now.'}
            </Text>
          )}

          <View style={styles.offerRow}>
            <PremiumButton
              label="Cancel"
              onPress={negModal.close}
              variant="secondary"
              size="sm"
              style={styles.flexBtn}
            />
            <PremiumButton
              label="Submit Round 1"
              onPress={negModal.submit}
              variant="primary"
              size="sm"
              disabled={negModal.submitDisabled}
              style={styles.flexBtn}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}
