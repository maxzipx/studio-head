import { ViewStyle } from 'react-native';

// ─────────────────────────────────────────────────
//  STUDIO HEAD — MODERN PRESTIGE (A24 / HBO MAX)
//  Warm near-black palette. Restraint everywhere,
//  then one thing breaks it.
// ─────────────────────────────────────────────────

// ── Colors ───────────────────────────────────────
export const colors = {
  // Backgrounds — warm charcoal family, no blue
  bgDeep: '#080604',     // deepest warm black — MetricsStrip, modal overlays
  bgPrimary: '#0C0A08',  // main screen background — warm near-black
  bgSurface: '#1A1714',  // card surface — warm dark charcoal
  bgElevated: '#252017', // nested / elevated elements — warm lifted charcoal
  bgChampagne: '#231E15', // franchise / award / blockbuster surface — rich warm dark

  // Primary brand / text anchor (formerly "Navy")
  navyPrimary: '#EDE8DE', // warm off-white — headings, values, strong text
  navyDeep: '#0C0A08',    // match bgPrimary — text on bright surfaces / pressed states

  // Brass — prestige accent (awards, franchise, selected states)
  // Muted from prior saturated gold — feels aged, earned, not game-ified
  goldLight: '#D4A853',  // gradient highlight end — warm amber
  goldMid: '#B8903A',    // primary brass — awards, active states, accents
  goldDeep: '#9A7028',   // gradient start / deep brass

  // CTA Amber — primary interactive
  // Warm amber reads as decisive / analog rather than digital-blue
  ctaAmber: '#C4813B',     // primary buttons, links, interactive — warm amber
  ctaAmberDark: '#A86A2C', // pressed / deeper amber

  // Secondary accents — desaturated for warm palette compatibility
  accentTeal: '#7A9E72',    // muted olive/sage — dev phase, info, mid-range scores
  accentRed: '#E07070',     // warm red — crisis, danger (reserved, used sparingly)
  accentRedDeep: '#C42020', // deep warm red — critical / risk
  accentGreen: '#6BA882',   // muted sage green — success, positive outcomes

  // Text — warm hierarchy on warm-dark backgrounds
  textPrimary: '#EDE8DE',   // warm off-white — headlines, values, primary content
  textSecondary: '#C4BAA8', // warm medium — body, descriptions
  textMuted: '#7A6F5E',     // warm muted — labels, tertiary info, placeholders
  textInverse: '#0C0A08',   // match bgPrimary — text on bright surfaces (buttons, tags)

  // Borders — warm-tinted, nearly invisible by default
  borderSubtle: '#2E2820',  // warm dark — card edges, dividers (barely there)
  borderDefault: '#3D352A', // warm standard — standard borders
  borderStrong: '#594D3E',  // warm strong — emphasized / focused borders
  borderGold: 'rgba(184,144,58,0.40)',   // brass active / selected state
  borderNavy: 'rgba(237,232,222,0.12)', // warm ghost border (secondary buttons)
  borderRed: 'rgba(224,112,112,0.35)',  // crisis / danger border
  borderAmber: 'rgba(196,129,59,0.25)',  // amber info / interactive border
};

// Backwards-compatible alias — screens importing `tokens.accentGold` etc. still work
export const tokens = {
  ...colors,
  // Legacy aliases (preserved so unreached screens don't break)
  accentGold: colors.goldMid,
  border: colors.borderDefault,
  borderTeal: 'rgba(122,158,114,0.40)', // updated to match new accentTeal
};

// ── Typography ────────────────────────────────────
export const typography = {
  // Font families — loaded via useFonts in _layout.tsx
  fontDisplay: 'PlayfairDisplay_700Bold',
  fontDisplayItalic: 'PlayfairDisplay_400Italic',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',
  fontBodySemiBold: 'Inter_600SemiBold',
  fontBodyBold: 'Inter_700Bold',

  // Size scale
  sizeXS: 11,   // labels, caps
  sizeSM: 13,   // muted body, captions
  sizeBase: 15, // standard body
  sizeMD: 17,   // card titles
  sizeLG: 20,   // subheadings
  sizeXL: 24,   // film titles, modal headings
  size2XL: 30,  // screen titles
  size3XL: 40,  // hero metrics

  // Line heights (multipliers)
  lineHeightTight: 1.15,
  lineHeightBase: 1.50,
  lineHeightLoose: 1.70,

  // Letter spacing (px)
  trackingTight: -0.4,   // Playfair Display headlines
  trackingNormal: 0,
  trackingWide: 0.6,
  trackingWidest: 1.2,   // uppercase labels
};

// ── Spacing scale ─────────────────────────────────
export const spacing = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 20,
  sp6: 24,
  sp8: 32,
  sp10: 40,
  sp12: 48,
};

// ── Border radius scale ───────────────────────────
export const radius = {
  r1: 6,
  r2: 10,
  r3: 14,
  r4: 18,
  r5: 24,
  rFull: 9999,
};

// ── Elevation / Shadow ────────────────────────────
// Warm-tinted shadows for depth against warm-dark backgrounds
export const shadows = {
  card: {
    shadowColor: '#1A0E06',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,

  elevated: {
    shadowColor: '#1A0E06',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,

  glowGold: {
    shadowColor: '#B8903A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowAmber: {
    shadowColor: '#C4813B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowRed: {
    shadowColor: '#E07070',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowGreen: {
    shadowColor: '#6BA882',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,
};

// ── Blur intensities ──────────────────────────────
export const blur = {
  card: 0,
  elevated: 0,
  modal: 0,
  tabBar: 0,
};
