import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, font } from '@/constants/theme';

export type BadgeKind = 'positive' | 'negative' | 'open' | 'locked' | 'submitted' | 'active' | 'inactive' | 'gold' | 'blue' | 'gray';

const CONFIG: Record<BadgeKind, { bg: string; color: string; label: string }> = {
  positive: { bg: colors.positiveBadge, color: colors.positiveText, label: 'Positive' },
  negative: { bg: colors.negativeBadge, color: colors.negativeText, label: 'Negative' },
  open: { bg: colors.amberBadge, color: colors.amberText, label: 'Open' },
  submitted: { bg: colors.blueBadge, color: colors.blueText, label: 'Submitted' },
  locked: { bg: colors.grayBadge, color: colors.grayText, label: 'Locked' },
  active: { bg: colors.positiveBadge, color: colors.positiveText, label: 'Active' },
  inactive: { bg: colors.grayBadge, color: colors.grayText, label: 'Inactive' },
  gold: { bg: colors.amberBadge, color: colors.goldDark, label: 'Gold' },
  blue: { bg: colors.blueBadge, color: colors.blueText, label: 'Blue' },
  gray: { bg: colors.grayBadge, color: colors.grayText, label: 'Gray' },
};

export default function StatusBadge({ kind, label }: { kind: BadgeKind; label?: string }) {
  const cfg = CONFIG[kind];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.color }]}>{label ?? cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});
