import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { STUDIO_STARTING } from '@/src/domain/balance-constants';
import type { StudioManager } from '@/src/domain/studio-manager';
import { FOUNDING_PROFILE_OPTIONS, FOUNDING_SPECIALIZATION_OPTIONS } from '@/src/ui/hq/founding-setup-options';
import { money } from '@/src/ui/hq/hq-helpers';
import { GlassCard, PremiumButton, SectionLabel } from '@/src/ui/components';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';

interface HqTutorialOverlayProps {
  manager: StudioManager;
  visible: boolean;
  tick: number;
  onAdvance: () => void;
  onSkip: () => void;
  onOpenSlate: () => void;
}

interface TutorialStepContent {
  title: string;
  body: string[];
  contextLabel?: string;
  contextItems?: string[];
  primaryLabel: string;
  primaryAction: 'advance' | 'openSlate';
}

const STEP_ORDER = ['hqIntro', 'strategy', 'firstProject', 'marketing', 'talent', 'risk'] as const;

function specializationFrame(manager: StudioManager): string {
  switch (manager.studioSpecialization) {
    case 'blockbuster':
      return 'You are built to chase scale. The upside is larger openings and bigger market presence, but mistakes become expensive quickly.';
    case 'prestige':
      return 'You are building for critic strength, awards attention, and long-tail credibility. The tradeoff is a slower commercial glide path.';
    case 'indie':
      return 'You are set up to run lean, pick your spots carefully, and survive on disciplined bets rather than brute force.';
    default:
      return 'You are running a flexible studio. That buys you optionality, but only if your early choices stay coherent.';
  }
}

function foundingProfileFrame(manager: StudioManager): string {
  switch (manager.foundingProfile) {
    case 'starDriven':
      return 'Your edge is packaging power. The right relationships can move a film faster than a bigger budget.';
    case 'dataDriven':
      return 'Your edge is market discipline. Forecasts, timing, and cold-eyed reads should keep you out of vanity traps.';
    case 'franchiseVision':
      return 'Your edge is long-horizon thinking. Every project can be evaluated for sequel value, world-building, and repeatable demand.';
    case 'culturalBrand':
      return 'Your edge is credibility. If the studio becomes a tastemaker, critics, talent, and festivals start treating your bets differently.';
    default:
      return 'Your founding profile should shape how you allocate risk, not just how you describe the studio.';
  }
}

function buildStepContentForState(manager: StudioManager, tutorialState: string): TutorialStepContent {
  const specializationLabel = FOUNDING_SPECIALIZATION_OPTIONS.find((option) => option.key === manager.studioSpecialization)?.label ?? 'Balanced';
  const foundingProfileLabel =
    FOUNDING_PROFILE_OPTIONS.find((option) => option.key === manager.foundingProfile)?.label ?? 'Independent';
  const leadProject = manager.activeProjects[0] ?? null;
  const firstProjectReady = manager.tutorialService.hasCreatedFirstProject();
  const aggressiveEarlyCash = manager.currentWeek <= 12 && manager.cash < STUDIO_STARTING.CASH * 0.7;

  switch (tutorialState) {
    case 'hqIntro':
      return {
        title: 'HQ is where the studio actually gets run.',
        body: [
          'This is not a dashboard for vanity metrics. It is the control room for a company trying to turn $50M in seed funding into a sustainable slate.',
          'Cash is runway, not a score. Reputation shapes who takes your calls. Capacity decides how many bets the studio can carry without breaking itself.',
        ],
        contextLabel: 'What to watch',
        contextItems: [
          `${money(manager.cash)} in cash: weak timing can kill a studio before a promising slate matures.`,
          `Reputation pillars: critics, talent, distributors, and audiences do not move together, and each opens different doors.`,
          `Capacity ${manager.projectCapacityUsed}/${manager.projectCapacityLimit}: every extra film adds burn, staffing pressure, and scheduling risk.`,
        ],
        primaryLabel: 'Continue',
        primaryAction: 'advance',
      };
    case 'strategy':
      return {
        title: 'Your founding choices are the first strategy memo.',
        body: [
          `You launched as a ${specializationLabel} studio with a ${foundingProfileLabel} founding profile.`,
          specializationFrame(manager),
          foundingProfileFrame(manager),
        ],
        contextLabel: 'Operating principle',
        contextItems: [
          'Match early projects to the studio you said you were building.',
          'A clear lane attracts better talent, cleaner release logic, and fewer expensive identity pivots.',
        ],
        primaryLabel: 'Build the Slate',
        primaryAction: 'advance',
      };
    case 'firstProject':
      return {
        title: 'The first film teaches the industry how to read your studio.',
        body: firstProjectReady
          ? [
              'You already have a project moving, so use this as the governing principle for every early greenlight: survive long enough to earn a second act.',
              'Disciplined budgets, identity fit, and the right talent package usually matter more than trying to look bigger than you are.',
            ]
          : [
              "Your first film is not just a release. It is the market\u2019s first answer to what kind of studio you are and whether you can execute on your own thesis.",
              'Head to the Slate tab when you are ready to acquire a script or develop from IP. Early studios usually benefit from disciplined budgets, a project that matches their identity, and talent choices that do more than inflate spend.',
            ],
        contextLabel: 'What to watch',
        contextItems: [
          'A clean first release creates leverage with talent, buyers, and investors.',
          'Ambition is useful only if the studio survives its first sequence of bets.',
          'The right attachment can change the entire profile of a modest film.',
        ],
        primaryLabel: 'Continue',
        primaryAction: 'advance',
      };
    case 'marketing':
      return {
        title: 'A finished film is not the same as a well-released film.',
        body: [
          leadProject
            ? `${leadProject.title} will live or die partly on timing, competitive pressure, and how hard you spend to make people care.`
            : 'Release outcomes are shaped by timing, competitive pressure, and whether the studio spends intelligently to create visibility.',
          'Marketing buys awareness, but it also increases exposure. Festival positioning, wide play, and the week you choose can all change the same film’s result.',
        ],
        contextLabel: 'Release discipline',
        contextItems: [
          'Crowded corridors compress openings.',
          'Campaign spend helps only if the studio can afford the long tail after it commits.',
        ],
        primaryLabel: 'Continue',
        primaryAction: 'advance',
      };
    case 'talent':
      return {
        title: manager.foundingProfile === 'starDriven' ? 'Relationships are one of your core assets.' : 'Talent relationships are long-term studio infrastructure.',
        body: [
          manager.foundingProfile === 'starDriven'
            ? 'If the studio is star-driven, every negotiation is also a reputation signal. Trusted packaging power compounds; sloppy deals linger.'
            : 'Casting is not a disposable transaction here. Trust, memory, and prior treatment shape who comes back and how hard they push you next time.',
          'A strong attachment can change financing, marketing, and reception. A bad pattern can make the next three films harder before you notice the damage.',
        ],
        contextLabel: 'People remember',
        contextItems: [
          'Who trusts the studio matters almost as much as who is available.',
          'Stars can redirect a film’s trajectory, but damaged relationships can quietly raise the cost of every future move.',
        ],
        primaryLabel: 'Continue',
        primaryAction: 'advance',
      };
    case 'risk':
      return {
        title: 'Studios usually fail from bad sequencing, not one dramatic headline.',
        body: aggressiveEarlyCash
          ? [
              'You have already burned a meaningful share of the seed round. That is recoverable, but only if the next commitments stay deliberate and paced.',
              'Preserve flexibility. Scale only when cash, timing, reputation, and bandwidth can all support the next move.',
            ]
          : [
              'Most studios do not die from one catastrophic swing. They die from overexpansion, thin cash, weak timing, and too many bad bets stacked close together.',
              'Preserve flexibility, pace the slate, and let reputation and timing work with ambition instead of against it.',
            ],
        contextLabel: 'Survival mindset',
        contextItems: [
          'Runway matters as much as upside.',
          'Capacity is a strategic limit, not a suggestion.',
          'Good sequencing compounds into trust, leverage, and better shots later.',
        ],
        primaryLabel: 'Launch the Studio',
        primaryAction: 'advance',
      };
    default:
      return {
        title: 'HQ Tutorial',
        body: ['The tutorial is ready when your founding setup is complete.'],
        primaryLabel: 'Continue',
        primaryAction: 'advance',
      };
  }
}

export function HqTutorialOverlay({ manager, visible, tick, onAdvance, onSkip, onOpenSlate }: HqTutorialOverlayProps) {
  // useMemo keyed on tick to force recomputation when the mutable manager changes
  const { stepContent, stepNumber, currentState } = useMemo(() => {
    const state = manager.tutorialState;
    return {
      stepContent: buildStepContentForState(manager, state),
      stepNumber: Math.max(1, STEP_ORDER.indexOf(state as (typeof STEP_ORDER)[number]) + 1),
      currentState: state,
    };
  }, [tick, manager]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.dimLayer} />
      <GlassCard variant="elevated" style={styles.card}>
        <LinearGradient colors={[colors.navyPrimary + '22', 'transparent']} style={styles.topGlow} pointerEvents="none" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>Studio Briefing</Text>
          <Text style={styles.title}>{stepContent.title}</Text>
          <Text style={styles.stepLabel}>Step {stepNumber} of {STEP_ORDER.length}</Text>

          <View style={styles.section}>
            {stepContent.body.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>

          {stepContent.contextItems?.length ? (
            <GlassCard variant="elevated" style={styles.contextCard}>
              <SectionLabel label={stepContent.contextLabel ?? 'Context'} />
              {stepContent.contextItems.map((item) => (
                <Text key={item} style={styles.contextItem}>
                  - {item}
                </Text>
              ))}
            </GlassCard>
          ) : null}

          <View style={styles.actions}>
            <PremiumButton
              label={stepContent.primaryLabel}
              onPress={stepContent.primaryAction === 'openSlate' ? onOpenSlate : onAdvance}
              fullWidth
            />
            <PremiumButton label="Skip Tutorial" onPress={onSkip} variant="ghost" fullWidth />
          </View>
        </ScrollView>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sp4,
    zIndex: 30,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 8, 14, 0.84)',
  },
  card: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '86%',
    borderRadius: radius.r4,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  content: {
    padding: spacing.sp5,
    gap: spacing.sp3,
  },
  kicker: {
    fontFamily: typography.fontBodySemiBold,
    fontSize: typography.sizeXS,
    color: colors.goldMid,
    letterSpacing: typography.trackingWidest,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: typography.size2XL,
    color: colors.textPrimary,
    letterSpacing: typography.trackingTight,
  },
  stepLabel: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.sp2,
  },
  body: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  contextCard: {
    gap: spacing.sp2,
  },
  contextItem: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeXS,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  actions: {
    gap: spacing.sp2,
    marginTop: spacing.sp1,
  },
});
