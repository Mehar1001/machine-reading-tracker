import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font, space } from '@/constants/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
  chevron?: boolean;
}

export default function Chip({ label, active, onPress, chevron }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.inactive]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      {chevron && (
        <Ionicons name="chevron-down" size={14} color={active ? colors.onPrimary : colors.primary} style={styles.icon} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: space.sm,
  },
  inactive: { borderColor: colors.border, backgroundColor: colors.surface },
  active: { borderColor: colors.primary, backgroundColor: colors.primary },
  label: { color: colors.subtext, fontSize: font.sm, fontWeight: '600' },
  activeLabel: { color: colors.onPrimary },
  icon: { marginLeft: 4 },
});
