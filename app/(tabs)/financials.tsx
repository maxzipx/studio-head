import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { GlassCard, MetricTile, OutcomeBadge, OutcomeType, ProgressBar, SectionLabel } from '@/src/ui/components';
import { colors, spacing, typography } from '@/src/ui/tokens';

function money(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function roiToOutcome(roi: number): OutcomeType {
  if (roi >= 3) return 'blockbuster';
  if (roi >= 2) return 'hit';
  if (roi >= 1.2) return 'solid';
  if (roi >= 0.8) return 'flop';
  return 'bomb';
}

export default function FinancialsScreen() {
  // Subscribe specifically to the financials slice. 
  // This component will only re-render when these derived values change.
  const financials = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    const projects = mgr.activeProjects;
    const totalBudget = projects.reduce((s, p) => s + p.budget.ceiling, 0);
    const totalSpend = projects.reduce((s, p) => s + p.budget.actualSpend, 0);

    return {
      cash: mgr.cash,
      lifetimeProfit: mgr.lifetimeProfit,
      lifetimeRevenue: mgr.lifetimeRevenue,
      projects,
      // Keep selector output shallow-comparable even with mutable project objects.
      projectsSignature: projects.map((p) =>
        `${p.id}:${p.phase}:${p.projectedROI}:${p.finalBoxOffice ?? 0}:${p.studioRevenueShare}:${p.budget.actualSpend}:${p.budget.ceiling}`
      ).join('|'),
      totalBudget,
      totalSpend,
      burnThisWeek: mgr.estimateWeeklyBurn(),
      lastDelta: mgr.lastWeekSummary?.cashDelta ?? 0,
    };
  }));

  const { cash, lifetimeProfit, lifetimeRevenue, projects, totalBudget, totalSpend, burnThisWeek, lastDelta } = financials;
  const released = projects.filter((p) => p.phase === 'released');

  const completionPct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const runwayWeeks = burnThisWeek > 0 ? cash / burnThisWeek : 0;
  const isPositiveDelta = lastDelta >= 0;

  // Runway danger threshold
  const runwayColor =
    runwayWeeks <= 4 ? colors.accentRed :
      runwayWeeks <= 10 ? colors.goldMid :
        colors.accentGreen;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.navyPrimary + '14', 'transparent']}
          style={styles.headerGlow}
          pointerEvents="none"
        />
        <Text style={styles.title}>Financials</Text>
        <Text style={styles.subtitle}>Cashflow, runway & release performance</Text>
      </View>

      {/* ── Hero Metrics ── */}
      <View style={styles.heroRow}>
        <GlassCard variant="gold" style={styles.heroCard}>
          <MetricTile
            value={money(cash)}
            label="Cash on Hand"
            size="lg"
            accent={colors.goldMid}
            centered
          />
        </GlassCard>
        <GlassCard variant="elevated" style={styles.heroCard}>
          <MetricTile
            value={money(lifetimeProfit)}
            label="Lifetime Profit"
            size="lg"
            accent={lifetimeProfit >= 0 ? colors.accentGreen : colors.accentRed}
            centered
          />
        </GlassCard>
      </View>

      {/* ── Weekly Flow ── */}
      <GlassCard>
        <SectionLabel label="Weekly Flow" />
        <View style={styles.metricRow}>
          <View style={styles.metricCol}>
            <MetricTile
              value={money(burnThisWeek)}
              label="Weekly Burn"
              size="sm"
              accent={colors.accentRed}
            />
          </View>
          <View style={styles.metricCol}>
            <MetricTile
              value={isPositiveDelta ? `+${money(lastDelta)}` : `-${money(Math.abs(lastDelta))}`}
              label="Last Week Δ"
              size="sm"
              accent={isPositiveDelta ? colors.accentGreen : colors.accentRed}
            />
          </View>
          <View style={styles.metricCol}>
            <MetricTile
              value={`${runwayWeeks.toFixed(1)}w`}
              label="Runway"
              size="sm"
              accent={runwayColor}
            />
          </View>
        </View>
      </GlassCard>

      {/* ── Lifetime Revenue ── */}
      <GlassCard>
        <SectionLabel label="Lifetime Revenue" />
        <MetricTile
          value={money(lifetimeRevenue)}
          label="Total Gross Revenue"
          size="md"
          accent={colors.accentGreen}
        />
      </GlassCard>

      {/* ── Budget Utilization ── */}
      <GlassCard>
        <SectionLabel label="Budget Utilization" />
        <View style={styles.budgetRow}>
          <MetricTile value={money(totalSpend)} label="Spent" size="sm" />
          <MetricTile value={money(totalBudget)} label="Budgeted" size="sm" />
          <MetricTile value={`${completionPct.toFixed(1)}%`} label="Consumed" size="sm" accent={completionPct > 85 ? colors.accentRed : colors.goldMid} />
        </View>
        <ProgressBar
          value={completionPct}
          color={completionPct > 85 ? colors.accentRed : colors.goldMid}
          height={5}
          animated
          style={{ marginTop: spacing.sp2 }}
        />
      </GlassCard>

      {/* ── Project ROI Matrix ── */}
      {projects.length > 0 && (
        <GlassCard>
          <SectionLabel label="Project ROI Matrix" />
          {projects.map((project) => (
            <View key={project.id} style={styles.roiRow}>
              <View style={styles.roiLeft}>
                <Text style={styles.roiTitle}>{project.title}</Text>
                <Text style={styles.roiPhase}>{project.phase}</Text>
              </View>
              <View style={styles.roiRight}>
                <OutcomeBadge outcome={roiToOutcome(project.projectedROI)} size="sm" />
                <Text style={[
                  styles.roiValue,
                  { color: project.projectedROI >= 2 ? colors.accentGreen : project.projectedROI < 1 ? colors.accentRed : colors.textPrimary }
                ]}>
                  {project.projectedROI.toFixed(2)}×
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      )}

      {/* ── Release Revenue ── */}
      <GlassCard>
        <SectionLabel label="Release Revenue" />
        {released.length === 0
          ? <Text style={styles.empty}>No released projects yet.</Text>
          : released.map((project) => (
            <GlassCard key={project.id} variant="elevated" style={styles.releaseRow}>
              <View style={styles.releaseHeader}>
                <Text style={styles.releaseTitle}>{project.title}</Text>
                <OutcomeBadge outcome={roiToOutcome(project.projectedROI)} size="sm" />
              </View>
              <View style={styles.releaseStats}>
                <MetricTile value={money(project.finalBoxOffice ?? 0)} label="Total Gross" size="sm" />
                <MetricTile
                  value={money((project.finalBoxOffice ?? 0) * project.studioRevenueShare)}
                  label="Studio Net"
                  size="sm"
                  accent={colors.accentGreen}
                />
                <MetricTile value={`${(project.studioRevenueShare * 100).toFixed(0)}%`} label="Rev Share" size="sm" />
              </View>
            </GlassCard>
          ))
        }
      </GlassCard>

      {/* ── Update Cadence Note ── */}
      <GlassCard variant="elevated">
        <Text style={styles.noteText}>
          Cash and spend move instantly when you act. Weekly delta and projections settle on End Turn.
        </Text>
      </GlassCard>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.sp4, paddingBottom: 120, gap: spacing.sp3 },

  // Header
  header: { gap: 4, marginBottom: spacing.sp1 },
  headerGlow: { position: 'absolute', top: -20, left: -spacing.sp4, right: -spacing.sp4, height: 100 },
  title: { fontFamily: typography.fontDisplay, fontSize: typography.size2XL, color: colors.textPrimary, letterSpacing: typography.trackingTight },
  subtitle: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted, marginTop: -2 },

  // Hero metrics
  heroRow: { flexDirection: 'row', gap: spacing.sp3 },
  heroCard: { flex: 1 },

  // Metric grid helpers
  metricRow: { flexDirection: 'row', gap: spacing.sp3, marginTop: spacing.sp2 },
  metricCol: { flex: 1 },
  budgetRow: { flexDirection: 'row', gap: spacing.sp3, marginTop: spacing.sp2 },

  // ROI Matrix
  roiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sp2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  roiLeft: { flex: 1, gap: 2 },
  roiRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp2 },
  roiTitle: { fontFamily: typography.fontBodySemiBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  roiPhase: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, textTransform: 'capitalize' },
  roiValue: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM },

  // Release Revenue
  releaseRow: { gap: spacing.sp2, marginTop: spacing.sp1 },
  releaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  releaseTitle: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeSM, color: colors.textPrimary },
  releaseStats: { flexDirection: 'row', gap: spacing.sp3, marginTop: spacing.sp1 },

  empty: { fontFamily: typography.fontBody, fontSize: typography.sizeSM, color: colors.textMuted },
  noteText: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, lineHeight: 18 },
});
