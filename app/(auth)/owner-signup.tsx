import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { backend } from '@/backend';
import { useSession } from '@/context/SessionContext';
import InputField from '@/components/ui/InputField';
import GoldButton from '@/components/ui/GoldButton';
import { colors, font, space, radius } from '@/constants/theme';

export default function OwnerSignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Enter your name, email, and password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await backend.registerOwner({ name: name.trim(), email: email.trim(), password });
      const user = await signIn(email.trim(), password);
      router.replace(user.role === 'owner' ? '/(admin)/stores' : '/');
    } catch (e: any) {
      setError(e?.message ?? 'Unable to create owner account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark-outline" size={26} color={colors.onPrimary} />
          </View>
          <Text style={styles.appName}>Create owner account</Text>
          <Text style={styles.tagline}>Set up your store and start tracking machines</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <InputField label="Owner / Gameroom name" value={name} onChangeText={setName} placeholder="Your name" icon="person-outline" />
          <InputField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <InputField label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" icon="lock-closed-outline" secure />
          <InputField label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter password" icon="lock-closed-outline" secure />

          <GoldButton label="Create account" onPress={onSignUp} loading={loading} icon="checkmark" style={styles.signIn} />

          <TouchableOpacity onPress={() => router.replace('/(auth)/employee-login')} style={styles.switchLink}>
            <Text style={styles.switchText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
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
  switchLink: { alignItems: 'center', marginTop: space.md },
  switchText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
});
