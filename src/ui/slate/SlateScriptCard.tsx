import { Text, View } from 'react-native';

import type { ScriptPitch } from '@/src/domain/types';
import { GlassCard, MetricTile, PremiumButton } from '@/src/ui/components';
import {
  money,
  recommendationColor,
  recommendationLabel,
} from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/slate/slate-styles';
import { colors, spacing } from '@/src/ui/tokens';

interface ScriptEvalResult {
  score: number;
  recommendation: 'strongBuy' | 'conditional' | 'pass';
  qualityScore: number;
  valueScore: number;
  affordabilityScore: number;
  riskLabel: 'low' | 'medium' | 'high';
}

interface SlateScriptCardProps {
  script: ScriptPitch;
  evalResult: ScriptEvalResult | null;
  onAcquire: (scriptId: string, title: string) => void;
  onPass: (scriptId: string) => void;
}

export function SlateScriptCard({ script, evalResult, onAcquire, onPass }: SlateScriptCardProps) {
  return (
    <GlassCard key={script.id} style={{ gap: spacing.sp2 }}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{script.title}</Text>
        <View style={[styles.pill, { borderColor: colors.goldMid + '50' }]}>
          <Text style={styles.pillText}>{script.genre}</Text>
        </View>
      </View>
      <Text style={styles.logline}>{script.logline}</Text>

      <View style={styles.metricRow}>
        <MetricTile value={money(script.askingPrice)} label="Ask" size="sm" />
        <MetricTile
          value={`${script.expiresInWeeks}w`}
          label="Expires"
          size="sm"
          accent={script.expiresInWeeks <= 1 ? colors.accentRed : colors.textMuted}
        />
        {evalResult && (
          <MetricTile
            value={evalResult.valueScore.toFixed(0)}
            label="Script Grade"
            size="sm"
            accent={evalResult.valueScore >= 70 ? colors.accentGreen : evalResult.valueScore < 55 ? colors.accentRed : colors.goldMid}
          />
        )}
      </View>

      {evalResult && (
        <View style={styles.recRow}>
          <View style={[styles.recBadge, {
            borderColor: recommendationColor(evalResult.recommendation) + '60',
            backgroundColor: recommendationColor(evalResult.recommendation) + '14',
          }]}>
            <Text style={[styles.recText, { color: recommendationColor(evalResult.recommendation) }]}>
              {recommendationLabel(evalResult.recommendation)}
            </Text>
          </View>
          <Text style={styles.metaText}>
            Script Quality {evalResult.qualityScore.toFixed(0)} · Risk {evalResult.riskLabel}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <PremiumButton label="Acquire" onPress={() => onAcquire(script.id, script.title)} variant="primary" size="sm" style={styles.flexBtn} />
        <PremiumButton label="Pass" onPress={() => onPass(script.id)} variant="ghost" size="sm" style={styles.flexBtn} />
      </View>
    </GlassCard>
  );
}
