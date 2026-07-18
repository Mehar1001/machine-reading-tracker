// GMT Machine Tracker — light, mobile-first design system.

export const colors = {
  bg: '#f1f0e8',               // main background
  surface: '#f8f8f7',          // info boxes, table headers
  card: '#ffffff',
  cardBorder: '#e5e7eb',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  // brand
  primary: '#0d1b3e',          // navy buttons / accents
  primaryLight: '#e6f1fb',     // light navy tint
  onPrimary: '#f5c518',        // gold text on navy
  gold: '#f5c518',             // accent gold
  goldDark: '#854f0b',         // dark gold text
  onGold: '#111827',           // dark text on gold

  // semantics
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#185fa5',

  text: '#111827',
  subtext: '#6b7280',
  textSecondary: '#4b5563',

  inputBg: '#f8f8f7',
  inputBorder: '#d1d5db',
  inputBorderFocus: '#0d1b3e',
  tableHeader: '#f8f8f7',
  rowAlt: '#f8f8f7',
  rowHover: '#f3f4f6',

  positiveBadge: '#eaf3de',
  positiveText: '#27500a',
  negativeBadge: '#fcebeb',
  negativeText: '#791f1f',
  amberBadge: '#faeeda',
  amberText: '#633806',
  blueBadge: '#e6f1fb',
  blueText: '#0c447c',
  grayBadge: '#f3f4f6',
  grayText: '#6b7280',

  // gradients (kept for compatibility, now flat-friendly)
  runGradient: ['#0d1b3e', '#185fa5'] as const,
  goldGradient: ['#f5c518', '#f59e0b'] as const,
  successGradient: ['#16a34a', '#15803d'] as const,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 21,
  xl: 34,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
};

export const radius = {
  input: 8,
  button: 8,
  card: 12,
  badge: 6,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
};
