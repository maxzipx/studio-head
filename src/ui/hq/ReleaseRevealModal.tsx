import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Text, View } from 'react-native';

import type { MovieProject, ReleaseReport } from '@/src/domain/types';
import {
  GlassCard,
  MetricTile,
  OutcomeBadge,
  PremiumButton,
  ProgressBar,
  SectionLabel,
} from '@/src/ui/components';
import { colors, spacing } from '@/src/ui/tokens';
import { getReleaseSplashTone, money, splashGradientColor, splashToneToOutcome } from '@/src/ui/hq/hq-helpers';
import { styles } from '@/src/ui/hq/hq-styles';

interface ReleaseRevealModalProps {
  reveal: MovieProject | null;
  isFinalReveal: boolean;
  revealReport: ReleaseReport | null;
  dismissReleaseReveal: (projectId: string) => void;
}

export function ReleaseRevealModal({
  reveal,
  isFinalReveal,
  revealReport,
  dismissReleaseReveal,
}: ReleaseRevealModalProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const splashTone = getReleaseSplashTone(revealReport);
  const isBlockbuster = splashTone === 'blockbuster' || splashTone === 'record';

  useEffect(() => {
    if (!reveal) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, reveal]);

  return (
    <Modal
      visible={!!reveal}
      transparent
      animationType="none"
      onRequestClose={() => reveal && dismissReleaseReveal(reveal.id)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalDimLayer} />

        {/* Champagne wash for blockbuster/record outcomes */}
        {isBlockbuster && (
          <View style={[styles.modalDimLayer, { backgroundColor: 'rgba(251,246,233,0.55)' }]} />
        )}

        {reveal && (
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: anim,
                transform: [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                ],
              },
            ]}
          >
            {isFinalReveal && revealReport && (
              <LinearGradient
                colors={[splashGradientColor(splashTone), 'transparent']}
                style={styles.modalTopBand}
                pointerEvents="none"
              />
            )}

            <Text style={styles.modalLabel}>
              {isFinalReveal ? 'Final Box Office Report' : 'Opening Weekend Reveal'}
            </Text>
            <Text style={styles.modalFilmTitle}>{reveal.title}</Text>

            {isFinalReveal && revealReport ? (
              <>
                <OutcomeBadge outcome={splashToneToOutcome(splashTone)} size="md" style={styles.outcomeBadge} />

                <View style={styles.modalStatsGrid}>
                  <MetricTile value={money(revealReport.totalGross)} label="Total Gross" size="md" centered accent={colors.goldMid} />
                  <MetricTile value={money(revealReport.studioNet)} label="Studio Net" size="md" centered accent={colors.accentGreen} />
                </View>
                <View style={styles.modalStatsGrid}>
                  <MetricTile
                    value={money(revealReport.profit)}
                    label="Profit / Loss"
                    size="sm"
                    centered
                    accent={revealReport.profit >= 0 ? colors.accentGreen : colors.accentRed}
                  />
                  <MetricTile
                    value={`${revealReport.roi.toFixed(2)}×`}
                    label="ROI"
                    size="sm"
                    centered
                    accent={revealReport.roi >= 2 ? colors.accentGreen : revealReport.roi < 1 ? colors.accentRed : colors.goldMid}
                  />
                </View>

                {revealReport.wasRecordOpening && (
                  <Text style={styles.recordLine}>🏆 New studio opening-weekend record</Text>
                )}

                <GlassCard variant="elevated" style={{ gap: spacing.sp2 }}>
                  <SectionLabel label="Performance Drivers" />
                  {[
                    { key: 'Script', val: revealReport.breakdown.script },
                    { key: 'Direction', val: revealReport.breakdown.direction },
                    { key: 'Star Power', val: revealReport.breakdown.starPower },
                    { key: 'Marketing', val: revealReport.breakdown.marketing },
                    { key: 'Timing', val: revealReport.breakdown.timing },
                    { key: 'Genre Cycle', val: revealReport.breakdown.genreCycle },
                  ].map(({ key, val }) => (
                    <View key={key} style={styles.driverRow}>
                      <Text style={styles.driverLabel}>{key}</Text>
                      <ProgressBar
                        value={50 + val}
                        color={val >= 0 ? colors.accentGreen : colors.accentRed}
                        height={5}
                        style={styles.driverBar}
                      />
                      <Text style={[styles.driverVal, { color: val >= 0 ? colors.accentGreen : colors.accentRed }]}>
                        {val >= 0 ? '+' : ''}
                        {val}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            ) : (
              <>
                <View style={styles.modalStatsGrid}>
                  <MetricTile value={money(reveal.openingWeekendGross ?? 0)} label="Opening Weekend" size="md" centered />
                </View>
                <View style={styles.modalStatsGrid}>
                  <MetricTile value={reveal.criticalScore?.toFixed(0) ?? '--'} label="Critics" size="sm" centered accent={colors.accentGreen} />
                  <MetricTile value={reveal.audienceScore?.toFixed(0) ?? '--'} label="Audience" size="sm" centered accent={colors.goldMid} />
                  <MetricTile value={`${reveal.releaseWeeksRemaining}w`} label="Forecast" size="sm" centered />
                </View>
                <Text style={styles.muted}>Partner: {reveal.distributionPartner ?? 'Pending'}</Text>
              </>
            )}

            <PremiumButton
              label="Continue"
              onPress={() => dismissReleaseReveal(reveal.id)}
              variant="primary"
              size="lg"
              fullWidth
              style={{ marginTop: spacing.sp2 }}
            />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
