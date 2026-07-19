import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import type { Employee } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import GoldButton from '@/components/ui/GoldButton';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { colors, font, space, radius } from '@/constants/theme';

function randomPassword(): string {
  return Math.random().toString(36).slice(-8);
}

export default function ManageEmployees() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'viewer'>('employee');
  const [showPass, setShowPass] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.role !== 'owner') return;
    setLoading(true);
    setEmployees(await backend.getEmployees(user.ownerId));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return <Redirect href="/" />;
  if (user.role !== 'owner') return <Redirect href="/(employee)/stores" />;

  const openAdd = () => {
    setName('');
    setEmail('');
    setPassword(randomPassword());
    setRole('employee');
    setShowPass(true);
    setModal(true);
  };

  const save = async () => {
    if (!user) return;
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Name, email and password are all required.');
      return;
    }
    setSaving(true);
    try {
      await backend.createEmployee(user.ownerId, { name: name.trim(), email: email.trim(), password, role });
      setModal(false);
      load();
      Alert.alert('Employee created', `${name.trim()} can now sign in.\n\nEmail: ${email.trim()}\nPassword: ${password}`);
    } catch (e: any) {
      Alert.alert('Create failed', e?.message ?? 'Unable to create employee.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (emp: Employee) => {
    if (!user) return;
    await backend.setEmployeeActive(user.ownerId, emp.uid, !emp.active);
    load();
  };

  const confirmDelete = (emp: Employee) => {
    Alert.alert('Delete employee?', `${emp.name} will lose access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await backend.deleteEmployee(user.ownerId, emp.uid);
          load();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Employees" showBack backTo="/(admin)/admin" rightIcon="person-add-outline" onRightPress={openAdd} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : employees.length === 0 ? (
        <EmptyState icon="people-outline" title="No employees yet" subtitle="Tap + to create an employee account." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {employees.map((e) => (
            <View key={e.uid} style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{e.name}</Text>
                  <StatusBadge kind={e.active ? 'positive' : 'negative'} label={e.active ? 'Active' : 'Disabled'} />
                </View>
                <Text style={styles.email}>{e.email}</Text>
                <Text style={styles.roleText}>Role: {e.role}</Text>
              </View>
              <Switch
                value={e.active}
                onValueChange={() => toggleActive(e)}
                trackColor={{ true: colors.primary, false: colors.cardBorder }}
                thumbColor="#fff"
              />
              <TouchableOpacity onPress={() => confirmDelete(e)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>Add employee</Text>
            <Text style={styles.inputLabel}>NAME</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.subtext} style={styles.input} />
            <Text style={styles.inputLabel}>ROLE</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'employee' && styles.roleOptionActive]}
                onPress={() => setRole('employee')}
              >
                <Text style={[styles.roleOptionText, role === 'employee' && styles.roleOptionTextActive]}>Employee</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'viewer' && styles.roleOptionActive]}
                onPress={() => setRole('viewer')}
              >
                <Text style={[styles.roleOptionText, role === 'viewer' && styles.roleOptionTextActive]}>Viewer</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="employee@company.com"
              placeholderTextColor={colors.subtext}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.passRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholder="Password"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
              />
              <TouchableOpacity onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.subtext} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPassword(randomPassword())} style={styles.eyeBtn}>
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <GoldButton label="Create employee" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: space.md }} />
            <TouchableOpacity onPress={() => setModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  email: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  roleText: { color: colors.primary, fontSize: font.xs, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  iconBtn: { padding: space.xs },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.lg,
  },
  sheetTitle: { color: colors.text, fontSize: font.lg, fontWeight: '800', marginBottom: space.md },
  inputLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginBottom: space.xs },
  input: {
    height: 48,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: font.sm,
    marginBottom: space.md,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  eyeBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: space.md },
  cancelText: { color: colors.subtext, fontSize: font.sm, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
  },
  roleOptionActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  roleOptionText: { color: colors.subtext, fontSize: font.sm, fontWeight: '700' },
  roleOptionTextActive: { color: colors.primary },
});
