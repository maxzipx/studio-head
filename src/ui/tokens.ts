import { ViewStyle } from 'react-native';

// ─────────────────────────────────────────────────
//  STUDIO HEAD — MODERN HOLLYWOOD EXECUTIVE TOKENS
// ─────────────────────────────────────────────────

// ── Colors ───────────────────────────────────────
export const colors = {
  // Backgrounds — light mode, three tiers
  bgDeep:         '#1E2A38',   // MetricsStrip, modal overlays, dark anchor
  bgPrimary:      '#F3F6FA',   // main screen background (cool studio daylight)
  bgSurface:      '#FFFFFF',   // card surface — crisp white
  bgElevated:     '#F8FAFC',   // nested / elevated elements
  bgChampagne:    '#FBF6E9',   // franchise / award / blockbuster surfaces

  // Navy — primary brand authority
  navyPrimary:    '#1E2A38',   // headings, values, strong text
  navyDeep:       '#131E2B',   // deeper navy for pressed states

  // Gold — prestige accent (awards, franchise, selected states)
  goldLight:      '#E5C76B',   // gradient highlight end
  goldMid:        '#C6A84A',   // primary gold (awards, active states, accents)
  goldDeep:       '#B8962E',   // gradient start / deep gold

  // CTA Blue — primary interactive action color
  ctaBlue:        '#2F6FED',   // primary buttons, links, interactive
  ctaBlueDark:    '#255AD6',   // pressed / disabled blue

  // Secondary accents
  accentTeal:     '#0E9E8A',   // progress, positive scores, info
  accentRed:      '#D9534F',   // warning, crisis, danger
  accentRedDeep:  '#C0392B',   // critical / risk danger
  accentGreen:    '#1FA971',   // success, blockbuster, strong positive

  // Text — navy-based hierarchy on light backgrounds
  textPrimary:    '#1E2A38',   // navy — headlines, values, primary content
  textSecondary:  '#3D5068',   // body, descriptions
  textMuted:      '#6B7F96',   // labels, tertiary info, placeholders
  textInverse:    '#FFFFFF',   // text on dark surfaces (navy, modals)

  // Borders — solid for crisp light-mode cards
  borderSubtle:   '#E8EDF3',   // card edges, dividers
  borderDefault:  '#DCE3EC',   // standard borders
  borderStrong:   '#BBC6D4',   // emphasized / focused borders
  borderGold:     'rgba(198,168,74,0.40)',   // gold active / selected state
  borderNavy:     'rgba(30,42,56,0.20)',     // navy ghost border (secondary buttons)
  borderRed:      'rgba(217,83,79,0.35)',    // crisis / danger border
  borderBlue:     'rgba(47,111,237,0.25)',   // info / blue border
};

// Backwards-compatible alias — screens importing `tokens.accentGold` etc. still work
export const tokens = {
  ...colors,
  // Legacy aliases (preserved so unreached screens don't break)
  accentGold:    colors.goldMid,
  border:        colors.borderDefault,
  borderTeal:    'rgba(14,158,138,0.40)',
};

// ── Typography ────────────────────────────────────
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

// ── Spacing scale ─────────────────────────────────
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

// ── Border radius scale ───────────────────────────
export const radius = {
  r1:    6,
  r2:    10,
  r3:    14,
  r4:    18,
  r5:    24,
  rFull: 9999,
};

// ── Elevation / Shadow ────────────────────────────
// Navy-tinted, soft drop shadows for light mode cards
export const shadows = {
  card: {
    shadowColor:   '#1E2A38',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius:  12,
    elevation:     4,
  } as ViewStyle,

  elevated: {
    shadowColor:   '#1E2A38',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius:  20,
    elevation:     8,
  } as ViewStyle,

  glowGold: {
    shadowColor:   '#C6A84A',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius:  12,
    elevation:     6,
  } as ViewStyle,

  glowBlue: {
    shadowColor:   '#2F6FED',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  14,
    elevation:     6,
  } as ViewStyle,

  glowRed: {
    shadowColor:   '#D9534F',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius:  12,
    elevation:     6,
  } as ViewStyle,

  glowGreen: {
    shadowColor:   '#1FA971',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius:  14,
    elevation:     6,
  } as ViewStyle,
};

// ── Blur intensities (kept for any remaining BlurView usage) ──
export const blur = {
  card:     0,
  elevated: 0,
  modal:    0,
  tabBar:   0,
};
