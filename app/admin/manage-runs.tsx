import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import { generateRunPdf } from '@/utils/generatePdf';
import type { Run } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import StatusBadge, { BadgeKind } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { colors, font, space, radius } from '@/constants/theme';
import { formatDateTime, money } from '@/utils/format';

function badgeKind(run: Run): BadgeKind {
  if (run.status === 'locked') return 'locked';
  return run.isPositive ? 'positive' : 'negative';
}

export default function ManageRuns() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || user.role !== 'owner') return;
    setLoading(true);
    setRuns(await backend.getRuns(user.ownerId));
    setLoading(false);
  }, [user]);

  const reprint = async (run: Run) => {
    if (!user) return;
    try {
      const printed = await backend.printRun(user.ownerId, run.id);
      if (printed) await generateRunPdf(printed);
    } catch (e: any) {
      Alert.alert('Reprint failed', e?.message ?? 'Unable to reprint.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return <Redirect href="/" />;
  if (user.role !== 'owner') return <Redirect href="/(employee)/stores" />;

  const unlock = (run: Run) => {
    Alert.alert('Unlock run?', 'This reopens the run for editing and clears its submitted state.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock',
        onPress: async () => {
          if (!user) return;
          await backend.unlockRun(user.ownerId, run.id);
          load();
        },
      },
    ]);
  };

  const remove = (run: Run) => {
    Alert.alert('Delete run?', `${run.storeName} · ${formatDateTime(run.timestamp)}. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await backend.deleteRun(user.ownerId, run.id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="All runs" showBack backTo="/(admin)/admin" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : runs.length === 0 ? (
        <EmptyState title="No runs yet" subtitle="Runs will appear here once employees start recording." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {runs.map((r) => (
            <View key={r.id} style={styles.card}>
              <TouchableOpacity onPress={() => router.push(`/runs/${r.id}`)}>
                <View style={styles.topRow}>
                  <Text style={styles.date}>{formatDateTime(r.timestamp)}</Text>
                  <StatusBadge kind={badgeKind(r)} />
                </View>
                <Text style={styles.store}>{r.storeName}</Text>
                <Text style={styles.emp}>{r.employeeName}</Text>
                <View style={styles.numRow}>
                  <Text style={styles.in}>IN {money(r.totalNewIn)}</Text>
                  <Text style={styles.out}>OUT {money(r.totalNewOut)}</Text>
                  <Text style={[styles.net, { color: r.isPositive ? colors.success : colors.danger }]}>NET {money(r.netTotal)}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => reprint(r)}>
                  <Ionicons name="print-outline" size={16} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Reprint</Text>
                </TouchableOpacity>
                {r.status === 'locked' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => unlock(r)}>
                    <Ionicons name="lock-open-outline" size={16} color={colors.warning} />
                    <Text style={[styles.actionText, { color: colors.warning }]}>Unlock</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionBtn} onPress={() => remove(r)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  date: { color: colors.text, fontSize: font.sm, fontWeight: '700' },
  store: { color: colors.goldDark, fontSize: font.sm, fontWeight: '700' },
  emp: { color: colors.subtext, fontSize: font.xs, marginTop: 2 },
  numRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  in: { color: colors.success, fontSize: font.sm, fontWeight: '700' },
  out: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },
  net: { fontSize: font.sm, fontWeight: '900' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.md,
    marginTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: space.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: font.sm, fontWeight: '700' },
});
