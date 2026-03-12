import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { FoundingProfile, StudioSpecialization } from '@/src/domain/types';
import { GlassCard, PremiumButton, SectionLabel } from '@/src/ui/components';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';

import { FOUNDING_PROFILE_OPTIONS, FOUNDING_SPECIALIZATION_OPTIONS } from './founding-setup-options';

interface FoundingSetupOverlayProps {
  visible: boolean;
  onComplete: (studioName: string, specialization: StudioSpecialization, foundingProfile: FoundingProfile) => void;
}

export function FoundingSetupOverlay({ visible, onComplete }: FoundingSetupOverlayProps) {
  const [step, setStep] = useState(1);
  const [studioName, setStudioName] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [specialization, setSpecialization] = useState<StudioSpecialization | null>(null);
  const [foundingProfile, setFoundingProfile] = useState<Exclude<FoundingProfile, 'none'> | null>(null);
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setStudioName('');
    setSpecialization(null);
    setFoundingProfile(null);
  }, [visible]);

  useEffect(() => {
    if (visible && step === 1) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [visible, step]);

  if (!visible) return null;

  const trimmedName = studioName.trim();
  const canContinueFromName = trimmedName.length > 0;
  const canContinueFromSpecialization = specialization !== null;
  const canLaunch = specialization !== null && foundingProfile !== null;

  return (
    <View style={overlayStyles.overlay}>
      <View style={overlayStyles.dimLayer} />
      <GlassCard variant="elevated" style={overlayStyles.card}>
        <LinearGradient
          colors={[colors.goldMid + '28', 'transparent']}
          style={overlayStyles.topGlow}
          pointerEvents="none"
        />
        <Text style={overlayStyles.kicker}>Studio Founding</Text>
        <Text style={overlayStyles.title}>Found the studio&apos;s identity.</Text>
        <Text style={overlayStyles.stepLabel}>Step {step} of 4</Text>

        {step === 1 ? (
          <View style={overlayStyles.section}>
            <SectionLabel label="Name Your Studio" />
            <Text style={overlayStyles.body}>
              Before the seed round closes and the industry starts watching — what do you call the studio?
            </Text>
            <TextInput
              ref={nameInputRef}
              value={studioName}
              onChangeText={setStudioName}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setIsNameFocused(false)}
              placeholder="e.g. Meridian Pictures"
              placeholderTextColor={colors.textMuted}
              maxLength={32}
              style={[overlayStyles.nameInput, isNameFocused ? overlayStyles.nameInputFocused : null]}
              returnKeyType="done"
              onSubmitEditing={() => { if (canContinueFromName) setStep(2); }}
            />
            <PremiumButton
              label="Lock In The Name"
              onPress={() => setStep(2)}
              disabled={!canContinueFromName}
              fullWidth
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={overlayStyles.section}>
            <SectionLabel label="Seed Round Closed" />
            <Text style={overlayStyles.body}>
              <Text style={overlayStyles.studioNameHighlight}>{trimmedName}</Text>
              {' '}has raised $50 million in seed funding to launch a new film studio.
            </Text>
            <Text style={overlayStyles.body}>
              The industry is watching your first move. Set the studio&apos;s charter before the first real decisions begin.
            </Text>
            <PremiumButton label="Choose Your Specialization" onPress={() => setStep(3)} fullWidth />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={overlayStyles.section}>
            <SectionLabel label="Layer 1: Specialization" />
            <Text style={overlayStyles.body}>Pick the studio&apos;s founding creative and commercial posture.</Text>
            <View style={overlayStyles.optionGroup}>
              {FOUNDING_SPECIALIZATION_OPTIONS.map((option) => {
                const selected = specialization === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSpecialization(option.key)}
                    style={({ pressed }) => [
                      overlayStyles.optionCard,
                      selected ? overlayStyles.optionCardSelected : null,
                      pressed ? overlayStyles.optionCardPressed : null,
                    ]}
                  >
                    <Text style={overlayStyles.optionTitle}>{option.label}</Text>
                    <Text style={overlayStyles.optionBody}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={overlayStyles.actions}>
              <PremiumButton label="Back" onPress={() => setStep(2)} variant="secondary" fullWidth />
              <PremiumButton
                label="Continue to Founding Profile"
                onPress={() => setStep(4)}
                disabled={!canContinueFromSpecialization}
                fullWidth
              />
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={overlayStyles.section}>
            <SectionLabel label="Layer 2: Founding Profile" />
            <Text style={overlayStyles.body}>Pick the story investors bought when they backed your studio.</Text>
            <View style={overlayStyles.optionGroup}>
              {FOUNDING_PROFILE_OPTIONS.map((option) => {
                const selected = foundingProfile === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFoundingProfile(option.key)}
                    style={({ pressed }) => [
                      overlayStyles.optionCard,
                      selected ? overlayStyles.optionCardSelected : null,
                      pressed ? overlayStyles.optionCardPressed : null,
                    ]}
                  >
                    <Text style={overlayStyles.optionTitle}>{option.label}</Text>
                    <Text style={overlayStyles.optionBody}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={overlayStyles.actions}>
              <PremiumButton label="Back" onPress={() => setStep(3)} variant="secondary" fullWidth />
              <PremiumButton
                label="Launch the Studio"
                onPress={() => {
                  if (!specialization || !foundingProfile) return;
                  onComplete(trimmedName, specialization, foundingProfile);
                }}
                disabled={!canLaunch}
                fullWidth
              />
            </View>
          </View>
        ) : null}
      </GlassCard>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sp4,
    zIndex: 20,
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 8, 14, 0.8)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    gap: spacing.sp3,
    padding: spacing.sp5,
    borderRadius: radius.r4,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
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
    gap: spacing.sp3,
  },
  body: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  studioNameHighlight: {
    fontFamily: typography.fontBodySemiBold,
    color: colors.textPrimary,
  },
  nameInput: {
    borderRadius: radius.r3,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sp3,
    paddingVertical: spacing.sp3,
    fontFamily: typography.fontBodySemiBold,
    fontSize: typography.sizeLG,
    color: colors.textPrimary,
  },
  nameInputFocused: {
    borderColor: colors.borderGold,
  },
  optionGroup: {
    gap: spacing.sp2,
  },
  optionCard: {
    borderRadius: radius.r3,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    padding: spacing.sp3,
    gap: spacing.sp1,
  },
  optionCardSelected: {
    borderColor: colors.borderGold,
    backgroundColor: colors.bgChampagne,
  },
  optionCardPressed: {
    opacity: 0.92,
  },
  optionTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizeBase,
    color: colors.textPrimary,
  },
  optionBody: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizeSM,
    color: colors.textMuted,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sp2,
  },
});
