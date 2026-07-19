import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { backend } from '@/backend';
import type { Store, Machine, Run } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import GoldButton from '@/components/ui/GoldButton';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { colors, font, space, radius } from '@/constants/theme';
import { money, toNumber, toDateKey } from '@/utils/format';

interface RowState {
  machine: Machine;
  in: string;
  out: string;
  photo: string | null;
}

export default function StoreDetail() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [store, setStore] = useState<Store | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [dateInput, setDateInput] = useState(toDateKey(new Date()));

  const load = useCallback(async () => {
    if (!user || !storeId) return;
    setLoading(true);
    const [s, machines, last] = await Promise.all([
      backend.getStore(user.ownerId, storeId),
      backend.getMachines(user.ownerId, storeId),
      backend.getLastRun(user.ownerId, storeId),
    ]);
    setStore(s);
    setLastRun(last);
    setRows(
      machines.map((m) => ({
        machine: m,
        in: String(last?.machines[m.id]?.presentIn ?? m.initialIn ?? 0),
        out: String(last?.machines[m.id]?.presentOut ?? m.initialOut ?? 0),
        photo: null,
      }))
    );
    setLoading(false);
  }, [user, storeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rowComputations = useMemo(() => {
    return rows.map((r) => {
      const prevIn = lastRun?.machines[r.machine.id]?.presentIn ?? r.machine.initialIn ?? 0;
      const prevOut = lastRun?.machines[r.machine.id]?.presentOut ?? r.machine.initialOut ?? 0;
      const newIn = toNumber(r.in) - prevIn;
      const newOut = toNumber(r.out) - prevOut;
      // Machine net = voucher IN - voucher OUT (derived from the incremental new readings).
      return { ...r, prevIn, prevOut, newIn, newOut, netMachine: newIn - newOut };
    });
  }, [rows, lastRun]);

  const totals = useMemo(() => {
    let totalNewIn = 0;
    let totalNewOut = 0;
    rowComputations.forEach((r) => {
      totalNewIn += r.newIn;
      totalNewOut += r.newOut;
    });
    // Net total = Total new IN - Total new OUT.
    return { totalNewIn, totalNewOut, net: totalNewIn - totalNewOut };
  }, [rowComputations]);

  const updateRow = (id: string, key: 'in' | 'out', value: string) => {
    setRows((prev) => prev.map((r) => (r.machine.id === id ? { ...r, [key]: value } : r)));
  };

  const takePhoto = async (id: string) => {
    try {
      if (Platform.OS === 'web') {
        const lib = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
        if (!lib.canceled) {
          setRows((prev) => prev.map((r) => (r.machine.id === id ? { ...r, photo: lib.assets[0].uri } : r)));
        }
        return;
      }

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        const lib = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
        if (!lib.canceled) {
          setRows((prev) => prev.map((r) => (r.machine.id === id ? { ...r, photo: lib.assets[0].uri } : r)));
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!result.canceled) {
        setRows((prev) => prev.map((r) => (r.machine.id === id ? { ...r, photo: result.assets[0].uri } : r)));
      }
    } catch {
      Alert.alert('Camera Error', 'Unable to open camera on this device.');
    }
  };

  const onRun = async () => {
    if (!user || !store) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD for the run date.');
      return;
    }
    // Validation: all fields filled
    const blank = rows.find((r) => r.in.trim() === '' || r.out.trim() === '');
    if (blank) {
      Alert.alert('Missing readings', 'Enter IN and OUT values for every machine before running.');
      return;
    }
    // Non-blocking warning for lower-than-previous readings
    const warnings = rows
      .filter((r) => {
        const li = lastRun?.machines[r.machine.id]?.presentIn ?? r.machine.initialIn ?? 0;
        const lo = lastRun?.machines[r.machine.id]?.presentOut ?? r.machine.initialOut ?? 0;
        return toNumber(r.in) < li || toNumber(r.out) < lo;
      })
      .map((r) => r.machine.label);

    const proceed = async () => {
      setRunning(true);
      try {
        const run = await backend.createRun(user.ownerId, {
          storeId: store.id,
          employeeUid: user.uid,
          employeeName: user.name,
          date: dateInput,
          machines: rows.map((r) => ({
            machineId: r.machine.id,
            label: r.machine.label,
            presentIn: toNumber(r.in),
            presentOut: toNumber(r.out),
            photoUrl: r.photo ?? undefined,
          })),
        });

        if (run.isPositive) {
          router.push(`/runs/${run.id}` as any);
        } else {
          // Negative net runs are saved directly to history; print is not offered.
          await backend.submitRun(user.ownerId, {
            runId: run.id,
            storePercentage: store.lastStorePercentage,
            vendorPercentage: store.lastVendorPercentage,
          });
          router.replace('/(employee)/history');
        }
      } catch (e: any) {
        Alert.alert('Run failed', e?.message ?? 'Unable to save run.');
      } finally {
        setRunning(false);
      }
    };

    if (warnings.length > 0) {
      Alert.alert(
        'Verify readings',
        `Lower than previous for: ${warnings.join(', ')}. Continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: proceed },
        ]
      );
    } else {
      proceed();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isPositive = totals.net >= 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={store?.name ?? 'Store'}
        showBack
        backTo={user?.role === 'owner' ? '/(admin)/stores' : '/(employee)/stores'}
        rightIcon="settings-outline"
        onRightPress={() => router.push('/admin/manage-stores' as any)}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 360 }} showsVerticalScrollIndicator={false}>
        {/* Store info card (collapsible) */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setCollapsed((c) => !c)} style={styles.infoCard}>
          <View style={styles.infoMain}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.infoName}>{store?.name}</Text>
              <View style={styles.codePill}>
                <Text style={styles.codePillText}>{store?.code}</Text>
              </View>
            </View>
            {!collapsed && (
              <>
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={12} color={colors.subtext} />
                  <Text style={styles.infoAddress}>{store?.address}</Text>
                </View>
                <View style={styles.pctRow}>
                  <Text style={styles.pctText}>Store {store?.lastStorePercentage}%</Text>
                  <Text style={styles.pctText}>Vendor {store?.lastVendorPercentage}%</Text>
                </View>
              </>
            )}
          </View>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.subtext} />
        </TouchableOpacity>

        {/* Date + live net preview */}
        <View style={styles.dateRow}>
          <View style={styles.dateBox}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <TextInput
              value={dateInput}
              onChangeText={setDateInput}
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtext}
            />
          </View>
          <View style={[styles.netPreview, isPositive ? styles.netPreviewPos : styles.netPreviewNeg]}>
            <Text style={styles.netPreviewLabel}>Net</Text>
            <Text style={[styles.netPreviewValue, { color: isPositive ? colors.success : colors.danger }]}>
              {money(totals.net)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Voucher entry</Text>

        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="hardware-chip-outline" size={40} color={colors.cardBorder} />
            <Text style={styles.emptyTitle}>No machines yet</Text>
            <Text style={styles.emptySubtitle}>Add machines in Manage stores before entering vouchers.</Text>
          </View>
        ) : (
          rowComputations.map((r) => (
            <View key={r.machine.id} style={styles.machineCard}>
              <View style={styles.machineHeader}>
                <View style={styles.machineMeta}>
                  <Text style={styles.machineCode}>{r.machine.code}</Text>
                  <Text style={styles.machineLabel}>{r.machine.label}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.photoBtn, !!r.photo && styles.photoActive]}
                  onPress={() => takePhoto(r.machine.id)}
                >
                  {r.photo ? (
                    <Image source={{ uri: r.photo }} style={styles.thumb} />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.previousRow}>
                <Text style={styles.previousLabel}>
                  Previous IN: <Text style={styles.previousValue}>{money(r.prevIn)}</Text>
                </Text>
                <Text style={styles.previousLabel}>
                  Previous OUT: <Text style={styles.previousValue}>{money(r.prevOut)}</Text>
                </Text>
              </View>

              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.inputWrap]}>VOUCHER IN</Text>
                <Text style={[styles.tableHeaderCell, styles.inputWrap]}>VOUCHER OUT</Text>
                <Text style={[styles.tableHeaderCell, styles.netBoxHeader]}>NET</Text>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputWrap}>
                  <CurrencyInput
                    value={r.in}
                    onChangeValue={(v) => updateRow(r.machine.id, 'in', v)}
                    placeholder="$0.00"
                    borderColor={colors.success}
                  />
                </View>
                <View style={styles.inputWrap}>
                  <CurrencyInput
                    value={r.out}
                    onChangeValue={(v) => updateRow(r.machine.id, 'out', v)}
                    placeholder="$0.00"
                    borderColor={colors.danger}
                  />
                </View>
                <View style={[styles.netBox, r.netMachine >= 0 ? styles.netBoxPos : styles.netBoxNeg]}>
                  <Text style={[styles.netValue, r.netMachine >= 0 ? styles.netValuePos : styles.netValueNeg]}>
                    {money(r.netMachine)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sticky bottom: live totals + status + action */}
      <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + space.sm }]}>
        <View style={styles.totalsCard}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total new IN</Text>
            <Text style={[styles.totalValue, { color: colors.success }]}>{money(totals.totalNewIn)}</Text>
          </View>
          <View style={styles.dividerV} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total new OUT</Text>
            <Text style={[styles.totalValue, { color: colors.danger }]}>{money(totals.totalNewOut)}</Text>
          </View>
          <View style={styles.dividerV} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Net total</Text>
            <Text style={[styles.totalValue, { color: isPositive ? colors.success : colors.danger }]}>
              {money(totals.net)}
            </Text>
          </View>
        </View>

        <View style={[styles.statusBanner, isPositive ? styles.bannerPos : styles.bannerNeg]}>
          <Ionicons
            name={isPositive ? 'checkmark-circle' : 'warning'}
            size={18}
            color={isPositive ? colors.success : colors.danger}
          />
          <Text style={[styles.statusText, { color: isPositive ? colors.success : colors.danger }]}>
            {isPositive
              ? 'Net is positive. Print and Save to History will be available on the next screen.'
              : 'Net is negative. This run will be saved directly to history.'}
          </Text>
        </View>

        <GoldButton label="Enter vouchers" icon="arrow-forward" onPress={onRun} loading={running} variant="primary" disabled={rows.length === 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.md,
  },
  infoMain: { flex: 1 },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoName: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  codePill: {
    backgroundColor: colors.amberBadge,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codePillText: { color: colors.goldDark, fontSize: 10, fontWeight: '700' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  infoAddress: { color: colors.subtext, fontSize: font.sm },
  pctRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  pctText: { color: colors.subtext, fontSize: font.xs },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  dateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: space.md,
  },
  dateInput: { color: colors.text, fontSize: font.sm, fontWeight: '700', flex: 1, height: '100%' },
  netPreview: {
    width: 120,
    height: 48,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  netPreviewPos: { backgroundColor: colors.positiveBadge, borderColor: colors.success },
  netPreviewNeg: { backgroundColor: colors.negativeBadge, borderColor: colors.danger },
  netPreviewLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700' },
  netPreviewValue: { fontSize: font.md, fontWeight: '800', marginTop: 2 },
  sectionTitle: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  machineCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.sm,
  },
  machineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  machineMeta: { flex: 1 },
  machineCode: { color: colors.goldDark, fontSize: font.xs, fontWeight: '700', marginBottom: 2 },
  machineLabel: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  previousRow: { flexDirection: 'row', gap: space.md, marginBottom: 8 },
  previousLabel: { color: colors.subtext, fontSize: font.xs },
  previousValue: { color: colors.text, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  tableHeaderRow: { flexDirection: 'row', gap: space.sm, marginBottom: 4, paddingHorizontal: 2 },
  tableHeaderCell: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', textAlign: 'center' },
  netBoxHeader: { width: 72, textAlign: 'center' },
  inputWrap: { flex: 1 },
  cellInput: {
    height: 44,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.text,
    textAlign: 'center',
    fontSize: font.sm,
    fontWeight: '700',
  },
  netBox: {
    width: 72,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  netBoxPos: { backgroundColor: colors.positiveBadge },
  netBoxNeg: { backgroundColor: colors.negativeBadge },
  netValue: { fontSize: font.sm, fontWeight: '800' },
  netValuePos: { color: colors.success },
  netValueNeg: { color: colors.danger },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.lg,
    alignItems: 'center',
    marginBottom: space.md,
  },
  emptyTitle: { color: colors.text, fontSize: font.md, fontWeight: '600', marginTop: space.md },
  emptySubtitle: { color: colors.subtext, fontSize: font.sm, textAlign: 'center', marginTop: space.xs },
  photoBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActive: { borderColor: colors.success, backgroundColor: colors.positiveBadge },
  thumb: { width: 32, height: 32, borderRadius: 6 },
  stickyBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  totalsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.sm,
  },
  dividerV: { width: 1, backgroundColor: colors.cardBorder },
  totalItem: { alignItems: 'center', flex: 1 },
  totalLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700' },
  totalValue: { fontSize: font.md, fontWeight: '800', marginTop: 4 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.badge,
    padding: space.sm,
    marginBottom: space.sm,
  },
  bannerPos: { backgroundColor: colors.positiveBadge },
  bannerNeg: { backgroundColor: colors.negativeBadge },
  statusText: { fontSize: font.sm, fontWeight: '600', flex: 1 },
});
