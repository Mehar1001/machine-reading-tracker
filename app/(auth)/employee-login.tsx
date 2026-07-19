import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InputField from '@/components/ui/InputField';
import GoldButton from '@/components/ui/GoldButton';
import { useSession } from '@/context/SessionContext';
import { BACKEND_MODE, SEED_CREDENTIALS, getSeedCredentials } from '@/backend';
import { colors, font, space, radius } from '@/constants/theme';
import type { Role } from '@/backend/types';

const ROLES: { key: Role; label: string; icon: any }[] = [
  { key: 'employee', label: 'Employee', icon: 'person-outline' },
  { key: 'viewer', label: 'Viewer', icon: 'eye-outline' },
  { key: 'owner', label: 'Admin / Owner', icon: 'shield-checkmark-outline' },
];

export default function EmployeeLogin() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: Role }>();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [selectedRole, setSelectedRole] = useState<Role>(params.role === 'owner' ? 'owner' : 'employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedCreds, setSeedCreds] = useState(SEED_CREDENTIALS);

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await signIn(email, password);
      if (user.role === 'owner') {
        router.replace('/(admin)/stores');
      } else if (user.role === 'viewer') {
        router.replace('/(employee)/history');
      } else {
        router.replace('/(employee)/stores');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const fillSeed = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  const roleTitle = selectedRole === 'owner' ? 'Admin portal' : selectedRole === 'viewer' ? 'Read-only access' : 'Welcome to GMT';
  const roleSub = selectedRole === 'owner' ? 'GMT machine management system' : selectedRole === 'viewer' ? 'Sign in to view history' : 'Sign in to your account';

  useEffect(() => {
    let active = true;
    if (BACKEND_MODE === 'local') {
      getSeedCredentials().then((creds) => {
        if (active) setSeedCreds(creds);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  const seedCredentials = seedCreds.filter((credential) => credential.role === selectedRole);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons
              name={
                selectedRole === 'owner'
                  ? 'shield-checkmark-outline'
                  : selectedRole === 'viewer'
                  ? 'eye-outline'
                  : 'person-outline'
              }
              size={26}
              color={colors.onPrimary}
            />
          </View>
          <Text style={styles.appName}>{roleTitle}</Text>
          <Text style={styles.tagline}>{roleSub}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.roleSwitch}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setSelectedRole(r.key)}
                style={[styles.roleOption, selectedRole === r.key && styles.roleOptionActive]}
              >
                <Ionicons name={r.icon} size={18} color={selectedRole === r.key ? colors.primary : colors.subtext} />
                <Text style={[styles.roleText, selectedRole === r.key && styles.roleTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <InputField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            icon="mail-outline"
            keyboardType="email-address"
          />
          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            icon="lock-closed-outline"
            secure
          />

          {selectedRole === 'employee' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.goldDark} style={{ marginTop: 2 }} />
              <Text style={styles.infoText}>Employee credentials are created by your admin. Contact your manager if you need access.</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <GoldButton label="Sign in" onPress={onSignIn} loading={loading} icon="log-in-outline" style={styles.signIn} />
        </View>

        {BACKEND_MODE === 'local' && seedCredentials.length > 0 && (
          <View style={styles.seedCard}>
            <Text style={styles.seedTitle}>DEMO ACCOUNTS (local mode)</Text>
            {seedCredentials.map((c) => (
              <TouchableOpacity key={c.email} style={styles.seedRow} onPress={() => fillSeed(c.email, c.password)}>
                <View style={styles.seedRoleDot} />
                <Text style={styles.seedEmail}>{c.email}</Text>
                <Text style={styles.seedPass}>{c.password}</Text>
                <Text style={styles.seedRole}>{c.role}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.seedHint}>Tap a row to autofill</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xl, maxWidth: 420, alignSelf: 'center', width: '100%' },
  logoWrap: { alignItems: 'center', marginBottom: space.xl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  appName: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  tagline: { color: colors.subtext, fontSize: font.sm, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: space.lg,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 4,
    marginBottom: space.lg,
  },
  roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 6 },
  roleOptionActive: { backgroundColor: colors.primaryLight, borderWidth: 0.5, borderColor: colors.primary },
  roleText: { color: colors.subtext, fontSize: font.sm, fontWeight: '600' },
  roleTextActive: { color: colors.primary },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.amberBadge,
    borderRadius: radius.badge,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    padding: space.sm,
    marginBottom: space.md,
    gap: 8,
  },
  infoText: { color: colors.goldDark, fontSize: font.sm, flex: 1, lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.negativeBadge,
    borderRadius: radius.badge,
    padding: space.sm,
    marginBottom: space.md,
    gap: 6,
  },
  errorText: { color: colors.negativeText, fontSize: font.sm, flex: 1 },
  signIn: { marginTop: space.sm },
  seedCard: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: space.md,
  },
  seedTitle: { color: colors.primary, fontSize: font.xs, fontWeight: '700', letterSpacing: 0.5, marginBottom: space.sm },
  seedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
  seedRoleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  seedEmail: { color: colors.text, fontSize: font.xs, flex: 1 },
  seedPass: { color: colors.subtext, fontSize: font.xs, width: 64 },
  seedRole: { color: colors.primary, fontSize: font.xs, width: 64, textAlign: 'right' },
  seedHint: { color: colors.subtext, fontSize: font.xs, marginTop: space.sm, fontStyle: 'italic' },
});
