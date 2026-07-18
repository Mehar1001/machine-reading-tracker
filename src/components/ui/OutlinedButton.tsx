import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export default function OutlinedButton({ label, onPress, disabled, icon, color = colors.primary, style }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { borderColor: color }, disabled && styles.disabled, style]}
    >
      <View style={styles.row}>
        {icon && <Ionicons name={icon} size={18} color={color} style={styles.icon} />}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.4, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 8 },
  label: { fontSize: font.md, fontWeight: '700', letterSpacing: 0.5 },
});
