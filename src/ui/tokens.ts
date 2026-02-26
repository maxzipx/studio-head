import { Platform, ViewStyle } from 'react-native';

// ─────────────────────────────────────────
//  STUDIO HEAD — DARK LUXURY DESIGN TOKENS
// ─────────────────────────────────────────

// ── Colors ───────────────────────────────
export const colors = {
  // Backgrounds — three tiers of depth
  bgDeep:         '#080A0F',   // absolute base; modal overlays
  bgPrimary:      '#0D1119',   // main screen background
  bgSurface:      '#141A27',   // card base layer
  bgElevated:     '#1C2436',   // nested / elevated cards

  // Gold — primary accent, three-stop gradient
  goldLight:      '#F0C96A',   // gradient highlight end
  goldMid:        '#D4A843',   // primary gold (CTAs, values, active states)
  goldDeep:       '#C9963A',   // gradient start / deep gold

  // Secondary accents
  accentTeal:     '#38BDB5',   // success, positive, info
  accentRed:      '#E8504A',   // danger, crisis, alert
  accentGreen:    '#3EC98A',   // strong positive (blockbuster, win)

  // Text — three levels of hierarchy
  textPrimary:    '#F0F4FA',   // headlines, values
  textSecondary:  '#8FA3BF',   // body, descriptions
  textMuted:      '#3D5068',   // labels, tertiary info
  textInverse:    '#080A0F',   // text on gold/light backgrounds

  // Borders — alpha-based for glass layering
  borderSubtle:   'rgba(255,255,255,0.06)',  // glass card edges
  borderDefault:  'rgba(255,255,255,0.10)',  // standard borders
  borderStrong:   'rgba(255,255,255,0.18)',  // emphasized/focused borders
  borderGold:     'rgba(212,168,67,0.38)',   // active / selected state
  borderRed:      'rgba(232,80,74,0.45)',    // crisis / danger border
  borderTeal:     'rgba(56,189,181,0.40)',   // success / info border
};

// Backwards-compatible alias — screens importing `tokens.accentGold` etc. still work
export const tokens = {
  // Extended keys (new — used by components)
  ...colors,

  // Legacy aliases (keep so existing screens don't break before they're migrated)
  accentGold:     colors.goldMid,
  border:         colors.borderDefault,
};

// ── Typography ───────────────────────────
export const typography = {
  // Font families — loaded via useFonts in _layout.tsx
  fontDisplay:        'PlayfairDisplay_700Bold',
  fontDisplayItalic:  'PlayfairDisplay_400Italic',
  fontBody:           'Inter_400Regular',
  fontBodyMedium:     'Inter_500Medium',
  fontBodySemiBold:   'Inter_600SemiBold',
  fontBodyBold:       'Inter_700Bold',

  // Size scale
  sizeXS:    11,   // labels, caps
  sizeSM:    13,   // muted body, captions
  sizeBase:  15,   // standard body
  sizeMD:    17,   // card titles
  sizeLG:    20,   // subheadings
  sizeXL:    24,   // film titles, modal headings
  size2XL:   30,   // screen titles
  size3XL:   40,   // hero metrics

  // Line heights (multipliers)
  lineHeightTight:  1.15,
  lineHeightBase:   1.50,
  lineHeightLoose:  1.70,

  // Letter spacing (px)
  trackingTight:   -0.4,   // Playfair Display headlines
  trackingNormal:   0,
  trackingWide:     0.6,
  trackingWidest:   1.2,   // uppercase labels
};

// ── Spacing scale ────────────────────────
export const spacing = {
  sp1:  4,
  sp2:  8,
  sp3:  12,
  sp4:  16,
  sp5:  20,
  sp6:  24,
  sp8:  32,
  sp10: 40,
  sp12: 48,
};

// ── Border radius scale ──────────────────
export const radius = {
  r1:   6,
  r2:   10,
  r3:   14,
  r4:   18,
  r5:   24,
  rFull: 9999,
};

// ── Elevation / Shadow ───────────────────
export const shadows = {
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius:  20,
    elevation:     12,
  } as ViewStyle,

  glowGold: {
    shadowColor:   colors.goldMid,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius:  16,
    elevation:     8,
  } as ViewStyle,

  glowRed: {
    shadowColor:   colors.accentRed,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius:  14,
    elevation:     8,
  } as ViewStyle,

  glowTeal: {
    shadowColor:   colors.accentTeal,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius:  14,
    elevation:     6,
  } as ViewStyle,

  glowGreen: {
    shadowColor:   colors.accentGreen,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius:  16,
    elevation:     8,
  } as ViewStyle,
};

// ── Blur intensities ─────────────────────
export const blur = {
  card:    Platform.OS === 'ios' ? 28  : 0,
  elevated: Platform.OS === 'ios' ? 40 : 0,
  modal:   Platform.OS === 'ios' ? 65  : 0,
  tabBar:  Platform.OS === 'ios' ? 55  : 0,
};
