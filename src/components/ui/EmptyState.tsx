import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, space } from '@/constants/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon = 'document-text-outline', title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={56} color={colors.cardBorder} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  title: { color: colors.text, fontSize: font.md, fontWeight: '600', marginTop: space.md, textAlign: 'center' },
  subtitle: { color: colors.subtext, fontSize: font.sm, marginTop: space.xs, textAlign: 'center' },
});
