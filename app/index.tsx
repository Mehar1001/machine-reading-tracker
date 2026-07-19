import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GoldButton from '@/components/ui/GoldButton';
import { useSession } from '@/context/SessionContext';
import { colors, font, radius, space } from '@/constants/theme';
import type { Role } from '@/backend/types';

const OPTIONS: Array<{ role: Role; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = [
  {
    role: 'employee',
    title: 'Employee',
    subtitle: 'Enter machine readings and print visit reports',
    icon: 'person-outline',
  },
  {
    role: 'owner',
    title: 'Admin / Owner',
    subtitle: 'Manage stores, employees, machines and all runs',
    icon: 'shield-checkmark-outline',
  },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useSession();
  const [selected, setSelected] = useState<Role>('employee');

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href={user.role === 'owner' ? '/(admin)/stores' : '/(employee)/stores'} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="hardware-chip-outline" size={28} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>Welcome to GMT</Text>
        <Text style={styles.subtitle}>Machine tracking & reporting</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SELECT ROLE</Text>
        <View style={styles.optionGrid}>
          {OPTIONS.map((option) => {
            const active = option.role === selected;
            return (
              <TouchableOpacity
                key={option.role}
                activeOpacity={0.85}
                onPress={() => setSelected(option.role)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Ionicons name={option.icon} size={22} color={active ? colors.primary : colors.subtext} />
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.title}</Text>
                <Text style={[styles.optionSub, active && styles.optionTextActive]} numberOfLines={2}>
                  {option.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <GoldButton
          label="Continue"
          icon="arrow-forward"
          onPress={() => router.push({ pathname: '/(auth)/employee-login', params: { role: selected } })}
          style={styles.continue}
        />

        <TouchableOpacity onPress={() => router.push('/(auth)/owner-signup' as any)} style={styles.signUpLink}>
          <Text style={styles.signUpText}>Create owner account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  brand: { alignItems: 'center', marginBottom: space.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.subtext, fontSize: font.sm, marginTop: space.xs, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: space.lg,
  },
  label: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: space.sm },
  optionGrid: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  option: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionText: { color: colors.text, fontSize: font.sm, fontWeight: '600', textAlign: 'center' },
  optionTextActive: { color: colors.primary },
  optionSub: { color: colors.subtext, fontSize: 10, textAlign: 'center' },
  continue: { marginTop: space.sm },
  signUpLink: { alignItems: 'center', marginTop: space.md },
  signUpText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
});
