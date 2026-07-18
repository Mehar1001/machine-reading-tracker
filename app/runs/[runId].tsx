import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import type { Run } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import GoldButton from '@/components/ui/GoldButton';
import OutlinedButton from '@/components/ui/OutlinedButton';
import StatusBadge from '@/components/ui/StatusBadge';
import { colors, font, space, radius } from '@/constants/theme';
import { money, formatFullDateTime, digitsOnly, toNumber } from '@/utils/format';
import { generateRunPdf } from '@/utils/generatePdf';

export default function RunResults() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [storePct, setStorePct] = useState('');
  const [vendorPct, setVendorPct] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user || !runId) return;
    setLoading(true);
    const r = await backend.getRun(user.ownerId, runId);
    setRun(r);
    if (r) {
      const store = await backend.getStore(user.ownerId, r.storeId);
      setStorePct(String(r.storePercentage ?? store?.lastStorePercentage ?? 40));
      setVendorPct(String(r.vendorPercentage ?? store?.lastVendorPercentage ?? 60));
    }
    setLoading(false);
  }, [user, runId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const machineIds = run ? Object.keys(run.machines) : [];
  const locked = run?.status === 'locked';

  const pctSum = toNumber(storePct) + toNumber(vendorPct);
  const pctValid = pctSum === 100;
  const storeAmount = run ? (run.netTotal * toNumber(storePct)) / 100 : 0;
  const vendorAmount = run ? (run.netTotal * toNumber(vendorPct)) / 100 : 0;

  const canSubmit = !!run && run.isPositive && pctValid && !locked;

  const onSubmit = async () => {
    if (!user || !run || !canSubmit) return;
    setSubmitting(true);
    try {
      const updated = await backend.submitRun(user.ownerId, {
        runId: run.id,
        storePercentage: toNumber(storePct),
        vendorPercentage: toNumber(vendorPct),
      });
      await generateRunPdf(updated);
      router.replace(user.role === 'owner' ? '/(admin)/stores' : '/(employee)/stores');
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message ?? 'Unable to submit run.');
    } finally {
      setSubmitting(false);
    }
  };

  const onPrint = async () => {
    if (!run) return;
    try {
      const forPrint: Run = locked
        ? run
        : { ...run, storePercentage: toNumber(storePct), vendorPercentage: toNumber(vendorPct), storeCalculatedAmount: storeAmount, vendorCalculatedAmount: vendorAmount };
      await generateRunPdf(forPrint);
    } catch (e: any) {
      Alert.alert('Print failed', e?.message ?? 'Unable to generate PDF.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFound}>Run not found.</Text>
        <OutlinedButton label="GO BACK" onPress={() => router.back()} icon="arrow-back" style={{ marginTop: space.md }} />
      </View>
    );
  }

  const hasLast = machineIds.some((id) => run.machines[id].lastIn > 0 || run.machines[id].lastOut > 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="chevron-back" size={26} color={colors.text} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Run results</Text>
        <View style={styles.headerRight}>
          {locked && <StatusBadge kind="locked" />}
          <Text style={styles.storeBadge}>{run.storeName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Date bar */}
        <View style={styles.dateBar}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>LAST RUN</Text>
            <Text style={styles.dateValue}>
              {run.previousRunTimestamp ? formatFullDateTime(run.previousRunTimestamp) : 'No previous run'}
            </Text>
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>TODAY</Text>
            <Text style={styles.dateValue}>{formatFullDateTime(run.timestamp)}</Text>
          </View>
        </View>
        <Text style={styles.employeeLine}>Employee: {run.employeeName}</Text>

        {/* Last reading */}
        <Text style={styles.tableTitle}>LAST READING</Text>
        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={[styles.hCell, styles.cMachine]}>MACHINE</Text>
            <Text style={[styles.hCell, styles.cNum]}>LAST IN</Text>
            <Text style={[styles.hCell, styles.cNum]}>LAST OUT</Text>
            <Text style={[styles.hCell, styles.cNum]}>NET</Text>
          </View>
          {!hasLast ? (
            <Text style={styles.noPrev}>No previous reading</Text>
          ) : (
            machineIds.map((id, i) => {
              const m = run.machines[id];
              return (
                <View key={id} style={[styles.tRow, i % 2 === 1 && styles.tRowAlt]}>
                  <Text style={[styles.cell, styles.cMachine]}>{m.label}</Text>
                  <Text style={[styles.cell, styles.cNum, { color: colors.success }]}>{money(m.lastIn)}</Text>
                  <Text style={[styles.cell, styles.cNum, { color: colors.danger }]}>{money(m.lastOut)}</Text>
                  <Text style={[styles.cell, styles.cNum, { color: colors.goldDark }]}>{money(m.lastIn - m.lastOut)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Present reading */}
        <Text style={styles.tableTitle}>PRESENT READING</Text>
        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={[styles.hCell, styles.cMachine]}>MACHINE</Text>
            <Text style={[styles.hCell, styles.cNum]}>PRESENT IN</Text>
            <Text style={[styles.hCell, styles.cNum]}>PRESENT OUT</Text>
            <Text style={[styles.hCell, styles.cNum]}>NET</Text>
          </View>
          {machineIds.map((id, i) => {
            const m = run.machines[id];
            const net = m.newIn - m.newOut;
            return (
              <View key={id} style={[styles.tRow, i % 2 === 1 && styles.tRowAlt]}>
                <Text style={[styles.cell, styles.cMachine]}>{m.label}</Text>
                <Text style={[styles.cell, styles.cNum]}>{money(m.presentIn)}</Text>
                <Text style={[styles.cell, styles.cNum]}>{money(m.presentOut)}</Text>
                <Text style={[styles.cell, styles.cNum, { color: net >= 0 ? colors.success : colors.danger }]}>
                  {money(net)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Total net hero */}
        <View style={styles.heroRow}>
          <Text style={styles.heroLabel}>TOTAL NET</Text>
          <Text style={[styles.heroValue, { color: run.isPositive ? colors.success : colors.danger }]}>
            {money(run.netTotal)}
          </Text>
        </View>
        <Text style={[styles.heroSub, { color: run.isPositive ? colors.success : colors.danger }]}>
          {run.isPositive ? 'Positive — submit & print available' : 'Negative — print only, saved to history'}
        </Text>

        {/* Percentages */}
        <View style={styles.pctRow}>
          <View style={styles.pctCard}>
            <Text style={styles.pctLabel}>STORE PERCENTAGE</Text>
            <View style={styles.pctInputWrap}>
              <TextInput
                value={storePct}
                onChangeText={(v) => setStorePct(digitsOnly(v))}
                keyboardType="numeric"
                editable={!locked}
                style={styles.pctInput}
              />
              <Text style={styles.pctSign}>%</Text>
            </View>
          </View>
          <View style={styles.pctCard}>
            <Text style={styles.pctLabel}>VENDOR PERCENTAGE</Text>
            <View style={styles.pctInputWrap}>
              <TextInput
                value={vendorPct}
                onChangeText={(v) => setVendorPct(digitsOnly(v))}
                keyboardType="numeric"
                editable={!locked}
                style={styles.pctInput}
              />
              <Text style={styles.pctSign}>%</Text>
            </View>
          </View>
        </View>

        {!locked && (
          <View style={[styles.pctBadge, pctValid ? styles.pctOk : styles.pctWarn]}>
            <Ionicons
              name={pctValid ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={pctValid ? colors.success : colors.warning}
            />
            <Text style={[styles.pctBadgeText, { color: pctValid ? colors.success : colors.warning }]}>
              {pctValid ? 'Percentages add to 100%' : `Must add to 100% (currently ${pctSum}%)`}
            </Text>
          </View>
        )}

        {/* Calculated amounts */}
        <View style={styles.calcRow}>
          <View style={styles.calcCard}>
            <Text style={styles.calcLabel}>CALCULATED (STORE)</Text>
            <Text style={styles.calcValue}>{money(storeAmount)}</Text>
          </View>
          <View style={styles.calcCard}>
            <Text style={styles.calcLabel}>CALCULATED (VENDOR)</Text>
            <Text style={styles.calcValue}>{money(vendorAmount)}</Text>
          </View>
        </View>

        {/* Buttons */}
        {!locked && (
          <GoldButton
            label="SUBMIT & PRINT"
            icon="print"
            variant="success"
            disabled={!canSubmit}
            loading={submitting}
            onPress={onSubmit}
            style={{ marginTop: space.lg }}
          />
        )}
        <OutlinedButton label="PRINT REPORT" icon="print-outline" onPress={onPrint} style={{ marginTop: space.md }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.subtext, fontSize: font.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  headerTitle: { color: colors.text, fontSize: font.md, fontWeight: '800', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  storeBadge: { color: colors.goldDark, fontSize: font.sm, fontWeight: '800' },
  dateBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.md,
  },
  dateCol: { flex: 1 },
  dateLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700' },
  dateValue: { color: colors.text, fontSize: font.sm, fontWeight: '600', marginTop: 2 },
  employeeLine: { color: colors.subtext, fontSize: font.sm, fontWeight: '600', marginBottom: space.md },
  tableTitle: { color: colors.text, fontSize: font.sm, fontWeight: '800', letterSpacing: 1, marginBottom: space.sm },
  table: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  tHead: { flexDirection: 'row', backgroundColor: colors.tableHeader, paddingVertical: space.sm, paddingHorizontal: space.sm },
  hCell: { color: colors.subtext, fontSize: font.xs, fontWeight: '700' },
  tRow: { flexDirection: 'row', paddingVertical: space.sm, paddingHorizontal: space.sm, backgroundColor: colors.card },
  tRowAlt: { backgroundColor: colors.rowAlt },
  cell: { color: colors.text, fontSize: font.sm },
  cMachine: { flex: 1.3, fontWeight: '600' },
  cNum: { flex: 1, textAlign: 'center', fontWeight: '700' },
  noPrev: { color: colors.subtext, fontStyle: 'italic', textAlign: 'center', padding: space.md, fontSize: font.sm },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  heroLabel: { color: colors.text, fontSize: font.md, fontWeight: '800', letterSpacing: 1 },
  heroValue: { fontSize: font.xl, fontWeight: '900' },
  heroSub: { textAlign: 'right', fontSize: font.sm, fontWeight: '700', marginTop: space.xs, marginBottom: space.md },
  pctRow: { flexDirection: 'row', gap: space.md },
  pctCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
  },
  pctLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginBottom: space.sm },
  pctInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    paddingHorizontal: space.md,
  },
  pctInput: { flex: 1, color: colors.text, fontSize: font.md, fontWeight: '800' },
  pctSign: { color: colors.primary, fontSize: font.md, fontWeight: '800' },
  pctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.badge,
    padding: space.sm,
    marginTop: space.sm,
  },
  pctOk: { backgroundColor: colors.positiveBadge },
  pctWarn: { backgroundColor: colors.amberBadge },
  pctBadgeText: { fontSize: font.sm, fontWeight: '700' },
  calcRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  calcCard: {
    flex: 1,
    backgroundColor: colors.amberBadge,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.goldDark,
    padding: space.md,
    alignItems: 'center',
  },
  calcLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700' },
  calcValue: { color: colors.goldDark, fontSize: font.lg, fontWeight: '900', marginTop: space.xs },
});
