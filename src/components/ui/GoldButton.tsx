import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'gold' | 'success' | 'danger' | 'warning' | 'run';
  style?: StyleProp<ViewStyle>;
}

const CONFIG: Record<Exclude<Props['variant'], undefined>, { bg: string; text: string }> = {
  primary: { bg: colors.primary, text: colors.onPrimary },
  gold: { bg: colors.gold, text: colors.onGold },
  success: { bg: colors.success, text: '#ffffff' },
  danger: { bg: colors.danger, text: '#ffffff' },
  warning: { bg: colors.warning, text: '#ffffff' },
  run: { bg: colors.primary, text: colors.onPrimary },
};

export default function GoldButton({ label, onPress, disabled, loading, icon, variant = 'primary', style }: Props) {
  const inactive = disabled || loading;
  const cfg = CONFIG[variant];
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={inactive} style={[styles.wrap, style]}>
      <View style={[styles.button, { backgroundColor: cfg.bg }, inactive && styles.inactive]}>
        {loading ? (
          <ActivityIndicator color={cfg.text} />
        ) : (
          <View style={styles.row}>
            {icon && <Ionicons name={icon} size={18} color={cfg.text} style={styles.icon} />}
            <Text style={[styles.label, { color: cfg.text }]}>{label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.button, overflow: 'hidden' },
  button: { height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  inactive: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 8 },
  label: { fontSize: font.md, fontWeight: '700', letterSpacing: 0.5 },
});
