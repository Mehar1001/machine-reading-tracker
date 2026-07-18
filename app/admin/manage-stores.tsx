import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import type { Store, Machine } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import GoldButton from '@/components/ui/GoldButton';
import EmptyState from '@/components/ui/EmptyState';
import { colors, font, space, radius } from '@/constants/theme';
import { numericInput } from '@/utils/format';

export default function ManageStores() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [stores, setStores] = useState<Store[]>([]);
  const [machineCounts, setMachineCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);

  // store form modal
  const [storeModal, setStoreModal] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  // machine form modal
  const [machineModal, setMachineModal] = useState(false);
  const [mLabel, setMLabel] = useState('');
  const [mOrder, setMOrder] = useState('');
  const [mInitialIn, setMInitialIn] = useState('0');
  const [mInitialOut, setMInitialOut] = useState('0');

  const load = useCallback(async () => {
    if (!user || user.role !== 'owner') return;
    setLoading(true);
    const list = await backend.getStores(user.ownerId);
    setStores(list);
    const counts = await Promise.all(list.map(async (s) => [s.id, (await backend.getMachines(user.ownerId, s.id)).length] as const));
    setMachineCounts(Object.fromEntries(counts));
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return <Redirect href="/" />;
  if (user.role !== 'owner') return <Redirect href="/(employee)/stores" />;

  const openAddStore = () => {
    setEditStore(null);
    setName('');
    setAddress('');
    setStoreModal(true);
  };
  const openEditStore = (s: Store) => {
    setEditStore(s);
    setName(s.name);
    setAddress(s.address);
    setStoreModal(true);
  };

  const saveStore = async () => {
    if (!user || !name.trim()) {
      Alert.alert('Name required', 'Enter a store name.');
      return;
    }
    if (editStore) {
      await backend.updateStore(user.ownerId, editStore.id, { name: name.trim(), address: address.trim() });
    } else {
      await backend.createStore(user.ownerId, { name: name.trim(), address: address.trim() });
    }
    setStoreModal(false);
    load();
  };

  const confirmDeleteStore = (s: Store) => {
    Alert.alert('Delete store?', `"${s.name}" and its machines will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await backend.deleteStore(user.ownerId, s.id);
          load();
        },
      },
    ]);
  };

  const toggleExpand = async (s: Store) => {
    if (expanded === s.id) {
      setExpanded(null);
      return;
    }
    if (!user) return;
    setExpanded(s.id);
    setMachines(await backend.getMachines(user.ownerId, s.id));
  };

  const openAddMachine = () => {
    setMLabel(`Machine ${machines.length + 1}`);
    setMOrder(String(machines.length + 1));
    setMInitialIn('0');
    setMInitialOut('0');
    setMachineModal(true);
  };

  const saveMachine = async () => {
    if (!user || !expanded || !mLabel.trim()) {
      Alert.alert('Label required', 'Enter a machine label.');
      return;
    }
    await backend.createMachine(user.ownerId, {
      storeId: expanded,
      label: mLabel.trim(),
      order: Number(mOrder) || machines.length + 1,
      initialIn: Number(mInitialIn) || 0,
      initialOut: Number(mInitialOut) || 0,
    });
    setMachineModal(false);
    setMachines(await backend.getMachines(user.ownerId, expanded));
    load();
  };

  const deleteMachine = (m: Machine) => {
    Alert.alert('Delete machine?', m.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user || !expanded) return;
          await backend.deleteMachine(user.ownerId, expanded, m.id);
          setMachines(await backend.getMachines(user.ownerId, expanded));
          load();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="All stores" showBack rightIcon="add-circle-outline" onRightPress={openAddStore} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : stores.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon="storefront-outline" title="No stores yet" subtitle="Tap below to add your first store." />
          <GoldButton label="Add store" icon="add" onPress={openAddStore} style={{ marginTop: space.md }} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {stores.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.cardRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleExpand(s)}>
                  <View style={styles.nameRow}>
                    <Text style={styles.storeName}>{s.name}</Text>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{s.code}</Text>
                    </View>
                  </View>
                  <Text style={styles.storeAddr}>{s.address || 'No address'}</Text>
                  <Text style={styles.machineCount}>{machineCounts[s.id] ?? 0} machines</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditStore(s)} style={styles.iconBtn}>
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteStore(s)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleExpand(s)} style={styles.iconBtn}>
                  <Ionicons name={expanded === s.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subtext} />
                </TouchableOpacity>
              </View>

              {expanded === s.id && (
                <View style={styles.machineSection}>
                  {machines.map((m) => (
                    <View key={m.id} style={styles.machineRow}>
                      <Text style={styles.machineCode}>{m.code}</Text>
                      <Text style={styles.machineLabel}>{m.label}</Text>
                      <TouchableOpacity onPress={() => deleteMachine(m)}>
                        <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addMachineBtn} onPress={openAddMachine}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={styles.addMachineText}>Add Machine</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Store modal */}
      <Modal visible={storeModal} transparent animationType="slide" onRequestClose={() => setStoreModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>{editStore ? 'Edit store' : 'Add store'}</Text>
            {!editStore && <Text style={styles.autoNote}>Store ID is auto-generated from the store name.</Text>}
            <Text style={styles.inputLabel}>STORE NAME</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Store name" placeholderTextColor={colors.subtext} style={styles.input} />
            <Text style={styles.inputLabel}>ADDRESS</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor={colors.subtext} style={styles.input} />
            <GoldButton label={editStore ? 'Save' : 'Add'} icon="checkmark" onPress={saveStore} style={{ marginTop: space.md }} />
            <TouchableOpacity onPress={() => setStoreModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Machine modal */}
      <Modal visible={machineModal} transparent animationType="slide" onRequestClose={() => setMachineModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>Add machine</Text>
            <Text style={styles.autoNote}>Machine ID is auto-generated from the store name.</Text>
            <Text style={styles.inputLabel}>LABEL</Text>
            <TextInput value={mLabel} onChangeText={setMLabel} placeholder="Machine 5" placeholderTextColor={colors.subtext} style={styles.input} />
            <Text style={styles.inputLabel}>ORDER</Text>
            <TextInput value={mOrder} onChangeText={(v) => setMOrder(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.subtext} style={styles.input} />
            <View style={styles.initialRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>INITIAL IN</Text>
                <TextInput value={mInitialIn} onChangeText={(v) => setMInitialIn(numericInput(v))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.subtext} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>INITIAL OUT</Text>
                <TextInput value={mInitialOut} onChangeText={(v) => setMInitialOut(numericInput(v))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.subtext} style={styles.input} />
              </View>
            </View>
            <GoldButton label="Add" icon="checkmark" onPress={saveMachine} style={{ marginTop: space.md }} />
            <TouchableOpacity onPress={() => setMachineModal(false)} style={styles.cancelBtn}>
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
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeName: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  codeBadge: {
    backgroundColor: colors.amberBadge,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeText: { color: colors.goldDark, fontSize: 10, fontWeight: '700' },
  storeAddr: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  machineCount: { color: colors.subtext, fontSize: font.xs, marginTop: 4 },
  iconBtn: { padding: space.sm },
  machineSection: { marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: space.sm },
  machineRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  machineCode: { color: colors.goldDark, fontSize: font.xs, fontWeight: '700', width: 52 },
  machineLabel: { color: colors.text, fontSize: font.sm, flex: 1 },
  addMachineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.sm },
  addMachineText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  autoNote: { color: colors.subtext, fontSize: font.xs, marginBottom: space.sm },
  initialRow: { flexDirection: 'row', gap: space.sm },
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
  cancelBtn: { alignItems: 'center', paddingVertical: space.md },
  cancelText: { color: colors.subtext, fontSize: font.sm, fontWeight: '600' },
});
