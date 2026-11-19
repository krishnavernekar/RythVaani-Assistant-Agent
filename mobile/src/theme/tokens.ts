/**
 * RythuVaani Design Tokens
 * Sunlight-readable color palette tuned for outdoor field usage (WCAG AAA ≥7:1 contrast).
 * Telugu typography rule: lineHeight >= fontSize * 1.55 on every text container.
 */
import { StyleSheet } from 'react-native';

// ─── Color Palette ───────────────────────────────────────────────────────────
export const Colors = {
  // Primary brand
  primary: '#1B5E20',
  primaryLight: '#2E7D32',
  primarySoft: '#E8F5E9',

  // Canvas & surfaces
  background: '#F7F9F5',
  cardWhite: '#FFFFFF',
  cardBorder: '#E2E8F0',

  // Semantic
  warning: '#FFF8E1',
  warningText: '#D97706',
  alert: '#FEF2F2',
  alertText: '#DC2626',

  // Text
  ink: '#0F172A',
  slate: '#475569',
  slateLight: '#94A3B8',

  // Positive / negative
  success: '#16A34A',
  successBg: '#DCFCE7',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.4)',
} as const;

// ─── Spacing Scale (4dp base) ────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

// ─── Touch target minimum (52dp per spec) ─────────────────────────────────────
export const touchTarget = 52;

// ─── Typography helpers ──────────────────────────────────────────────────────
/**
 * Telugu line-height multiplier — MUST be >= 1.55x on every Telugu text container.
 * English may use 1.5 as a minimum.
 */
export const TELUGU_LINE_HEIGHT_MULTIPLIER = 1.55;
export const EN_LINE_HEIGHT_MULTIPLIER = 1.5;

// ─── Font families ───────────────────────────────────────────────────────────
export const fonts = {
  telugu: 'System', // Noto Sans Telugu loaded via expo-font at startup
  english: 'System', // Plus Jakarta Sans / Inter loaded via expo-font
  mono: 'monospace',
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ─── StyleSheet preset ───────────────────────────────────────────────────────
export const tokens = StyleSheet.create({
  // Backgrounds
  bgCanvas: { backgroundColor: Colors.background },
  bgCard: { backgroundColor: Colors.cardWhite },
  bgPrimary: { backgroundColor: Colors.primary },
  bgPrimarySoft: { backgroundColor: Colors.primarySoft },
  bgWarning: { backgroundColor: Colors.warning },
  bgAlert: { backgroundColor: Colors.alert },

  // Text colors
  textInk: { color: Colors.ink },
  textSlate: { color: Colors.slate },
  textPrimary: { color: Colors.primary },
  textSuccess: { color: Colors.success },
  textDanger: { color: Colors.danger },
  textWarning: { color: Colors.warningText },

  // Telugu-safe text container (LINE_HEIGHT >= 1.55 * fontSize)
  teluguText: {
    lineHeight: TELUGU_LINE_HEIGHT_MULTIPLIER,
    includeFontPadding: false,
  },
  enText: {
    lineHeight: EN_LINE_HEIGHT_MULTIPLIER,
  },

  // Touch target
  touchTarget: {
    minHeight: touchTarget,
    minWidth: touchTarget,
  },

  // Spacing presets
  pSm: { padding: spacing.sm },
  pMd: { padding: spacing.md },
  pLg: { padding: spacing.lg },
  pxLg: { paddingHorizontal: spacing.lg },
  pyLg: { paddingVertical: spacing.lg },
  gapMd: { gap: spacing.md },
  gapLg: { gap: spacing.lg },

  // Border radius
  roundedSm: { borderRadius: radius.sm },
  roundedMd: { borderRadius: radius.md },
  roundedLg: { borderRadius: radius.lg },
  roundedXl: { borderRadius: radius.xl },
  roundedFull: { borderRadius: radius.full },

  // Card — note: consumers must NOT also pass backgroundColor/borderRadius/borderWidth/borderColor inline
  card: {
    backgroundColor: Colors.cardWhite,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...shadows.card,
  },
  cardElevated: {
    backgroundColor: Colors.cardWhite,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...shadows.elevated,
  },

  // Screen wrapper
  screenWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
});