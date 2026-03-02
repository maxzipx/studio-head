import { ViewStyle } from 'react-native';

// ─────────────────────────────────────────────────
//  STUDIO HEAD — MODERN HOLLYWOOD EXECUTIVE TOKENS
// ─────────────────────────────────────────────────

// ── Colors ───────────────────────────────────────
export const colors = {
  // Backgrounds — dark mode slate, three tiers
  bgDeep: '#0B1120',   // MetricsStrip, modal overlays, very dark anchor
  bgPrimary: '#0F172A',   // main screen background (slate 900)
  bgSurface: '#1E293B',   // card surface (slate 800)
  bgElevated: '#334155',   // nested / elevated elements (slate 700)
  bgChampagne: '#2D2A26',   // franchise / award / blockbuster surfaces (dark luxury)

  // Navy (Legacy name) — primary brand authority, mapped to bright slate for dark mode legibility
  navyPrimary: '#F8FAFC',   // headings, values, strong text (slate 50)
  navyDeep: '#0F172A',   // deeper navy for pressed states / contrast text

  // Gold — prestige accent (awards, franchise, selected states)
  goldLight: '#FDE047',   // gradient highlight end
  goldMid: '#EAB308',   // primary gold (awards, active states, accents)
  goldDeep: '#CA8A04',   // gradient start / deep gold

  // CTA Blue — primary interactive action color
  ctaBlue: '#3B82F6',   // primary buttons, links, interactive (blue 500)
  ctaBlueDark: '#2563EB',   // pressed / disabled blue (blue 600)

  // Secondary accents (vibrant variants for dark backgrounds)
  accentTeal: '#2DD4BF',   // progress, positive scores, info (teal 400)
  accentRed: '#F87171',   // warning, crisis, danger (red 400)
  accentRedDeep: '#DC2626',   // critical / risk danger (red 600)
  accentGreen: '#34D399',   // success, blockbuster, strong positive (emerald 400)

  // Text — hierarchy on dark slate backgrounds
  textPrimary: '#F8FAFC',   // slate 50 — headlines, values, primary content
  textSecondary: '#CBD5E1',   // slate 300 — body, descriptions
  textMuted: '#64748B',   // slate 500 — labels, tertiary info, placeholders
  textInverse: '#0F172A',   // slate 900 — text on bright surfaces (buttons, tags)

  // Borders — tailored for dark mode cards
  borderSubtle: '#334155',   // slate 700 — card edges, dividers
  borderDefault: '#475569',   // slate 600 — standard borders
  borderStrong: '#64748B',   // slate 500 — emphasized / focused borders
  borderGold: 'rgba(234,179,8,0.40)',    // gold active / selected state
  borderNavy: 'rgba(248,250,252,0.15)',  // ghost border (secondary buttons)
  borderRed: 'rgba(248,113,113,0.35)',  // crisis / danger border
  borderBlue: 'rgba(59,130,246,0.25)',   // info / blue border
};

// Backwards-compatible alias — screens importing `tokens.accentGold` etc. still work
export const tokens = {
  ...colors,
  // Legacy aliases (preserved so unreached screens don't break)
  accentGold: colors.goldMid,
  border: colors.borderDefault,
  borderTeal: 'rgba(14,158,138,0.40)',
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
  sizeBase: 15,   // standard body
  sizeMD: 17,   // card titles
  sizeLG: 20,   // subheadings
  sizeXL: 24,   // film titles, modal headings
  size2XL: 30,   // screen titles
  size3XL: 40,   // hero metrics

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
// Pure black shadows for depth against dark backgrounds
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,

  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,

  glowGold: {
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowBlue: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowRed: {
    shadowColor: '#F87171',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,

  glowGreen: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 6,
  } as ViewStyle,
};

// ── Blur intensities (kept for any remaining BlurView usage) ──
export const blur = {
  card: 0,
  elevated: 0,
  modal: 0,
  tabBar: 0,
};
