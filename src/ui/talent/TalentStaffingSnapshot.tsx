import { Text, View } from 'react-native';
import { GlassCard, SectionLabel } from '@/src/ui/components';
import { colors } from '@/src/ui/tokens';
import { styles } from '@/src/ui/talent/talent-styles';

interface TalentStaffingSnapshotProps {
  marketDirectorCount: number;
  marketActorCount: number;
  marketActressCount: number;
  openNegotiationCount: number;
  attachedCount: number;
  neededSlots: number;
}

export function TalentStaffingSnapshot({
  marketDirectorCount,
  marketActorCount,
  marketActressCount,
  openNegotiationCount,
  attachedCount,
  neededSlots,
}: TalentStaffingSnapshotProps) {
  return (
    <GlassCard>
      <SectionLabel label="Project Staffing Snapshot" />
      <View style={styles.snapshotRow}>
        {[
          { label: 'Directors', value: marketDirectorCount, accent: colors.ctaAmber },
          { label: 'Actors', value: marketActorCount, accent: colors.accentGreen },
          { label: 'Actresses', value: marketActressCount, accent: colors.goldMid },
          { label: 'Deals', value: openNegotiationCount, accent: colors.goldMid },
          { label: 'Attached', value: attachedCount, accent: colors.accentRed },
          { label: 'Needed', value: neededSlots, accent: colors.textMuted },
        ].map(({ label, value, accent }) => (
          <GlassCard key={label} variant="elevated" style={styles.snapshotTile}>
            <Text style={[styles.snapshotValue, { color: accent }]}>{value}</Text>
            <Text style={styles.snapshotLabel}>{label}</Text>
          </GlassCard>
        ))}
      </View>
    </GlassCard>
  );
}
