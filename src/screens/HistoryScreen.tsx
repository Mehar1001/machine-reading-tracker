import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import type { Run, Store, Employee, RunStatus } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import StatusBadge, { BadgeKind } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Chip from '@/components/ui/Chip';
import { colors, font, space, radius } from '@/constants/theme';
import { formatDateTime, money, toDateKey, dateKeyToLabel } from '@/utils/format';

type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';
type StatusFilter = 'all' | 'positive' | 'negative' | 'submitted' | 'open';

interface Props {
  isAdmin?: boolean;
  title?: string;
}

function startOfRange(range: DateRange): string | undefined {
  if (range === 'all' || range === 'custom') return undefined;
  const d = new Date();
  if (range === 'today') return toDateKey(d);
  if (range === 'week') d.setDate(d.getDate() - 7);
  if (range === 'month') d.setMonth(d.getMonth() - 1);
  return toDateKey(d);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badgeKind(run: Run): BadgeKind {
  if (run.status === 'locked' || run.status === 'submitted') return 'locked';
  return run.isPositive ? 'positive' : 'negative';
}

export default function HistoryScreen({ isAdmin, title = 'Transaction history' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();

  const [runs, setRuns] = useState<Run[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [storeId, setStoreId] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [employeeUid, setEmployeeUid] = useState<string>('all');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [r, s] = await Promise.all([backend.getRuns(user.ownerId), backend.getStores(user.ownerId)]);
    setRuns(r);
    setStores(s);
    if (isAdmin) setEmployees(await backend.getEmployees(user.ownerId));
    setLoading(false);
  }, [user, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const from = dateRange === 'custom' ? (DATE_RE.test(dateFrom) ? dateFrom : undefined) : startOfRange(dateRange);
    const to = dateRange === 'custom' && DATE_RE.test(dateTo) ? dateTo : undefined;
    return runs.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (storeId !== 'all' && r.storeId !== storeId) return false;
      if (employeeUid !== 'all' && r.employeeUid !== employeeUid) return false;
      if (status === 'positive' && !r.isPositive) return false;
      if (status === 'negative' && r.isPositive) return false;
      if (status === 'submitted' && r.status !== 'locked') return false;
      if (status === 'open' && r.status !== 'open') return false;
      return true;
    });
  }, [runs, dateRange, dateFrom, dateTo, storeId, employeeUid, status]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.count += 1;
        acc.totalIn += r.totalNewIn;
        acc.totalOut += r.totalNewOut;
        acc.net += r.netTotal;
        return acc;
      },
      { count: 0, totalIn: 0, totalOut: 0, net: 0 }
    );
  }, [filtered]);

  const cycleDate = () => {
    const order: DateRange[] = ['all', 'today', 'week', 'month'];
    setDateRange(order[(order.indexOf(dateRange) + 1) % order.length]);
  };
  const cycleStore = () => {
    const ids = ['all', ...stores.map((s) => s.id)];
    setStoreId(ids[(ids.indexOf(storeId) + 1) % ids.length]);
  };
  const cycleStatus = () => {
    const order: StatusFilter[] = ['all', 'positive', 'negative', 'submitted', 'open'];
    setStatus(order[(order.indexOf(status) + 1) % order.length]);
  };
  const cycleEmployee = () => {
    const ids = ['all', ...employees.map((e) => e.uid)];
    setEmployeeUid(ids[(ids.indexOf(employeeUid) + 1) % ids.length]);
  };

  const customLabel =
    DATE_RE.test(dateFrom) || DATE_RE.test(dateTo)
      ? `${DATE_RE.test(dateFrom) ? dateKeyToLabel(dateFrom) : 'Start'} – ${DATE_RE.test(dateTo) ? dateKeyToLabel(dateTo) : 'Now'}`
      : 'Custom range';
  const dateLabel = { all: 'All Dates', today: 'Today', week: 'This Week', month: 'This Month', custom: customLabel }[dateRange];
  const storeLabel = storeId === 'all' ? 'All Stores' : stores.find((s) => s.id === storeId)?.name ?? 'Store';
  const statusLabel = { all: 'All Status', positive: 'Positive', negative: 'Negative', submitted: 'Submitted', open: 'Open' }[status];
  const empLabel = employeeUid === 'all' ? 'All Employees' : employees.find((e) => e.uid === employeeUid)?.name ?? 'Employee';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={title} rightIcon={!isAdmin ? 'log-out-outline' : undefined} onRightPress={!isAdmin ? signOut : undefined} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={styles.calendarChip} onPress={() => setCalendarOpen(true)}>
          <Ionicons name="calendar-outline" size={15} color={dateRange === 'custom' ? colors.card : colors.primary} />
        </TouchableOpacity>
        <Chip label={dateLabel} active={dateRange !== 'all'} onPress={cycleDate} chevron />
        <Chip label={storeLabel} active={storeId !== 'all'} onPress={cycleStore} chevron />
        <Chip label={statusLabel} active={status !== 'all'} onPress={cycleStatus} chevron />
        {isAdmin && <Chip label={empLabel} active={employeeUid !== 'all'} onPress={cycleEmployee} chevron />}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No runs found" subtitle="No runs match the selected filters." />
      ) : (
        <ScrollView style={styles.tableWrap} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {filtered.map((r) => {
            const hasPhotos = Object.values(r.machines).some((m) => !!m.photoUrl);
            return (
              <TouchableOpacity key={r.id} activeOpacity={0.85} style={styles.row} onPress={() => router.push(`/runs/${r.id}`)}>
                <View style={styles.rowTop}>
                  <Text style={styles.dateText}>{formatDateTime(r.timestamp)}</Text>
                  <StatusBadge kind={badgeKind(r)} />
                </View>
                <Text style={styles.storeText}>{r.storeName}</Text>
                <Text style={styles.empText}>{r.employeeName}</Text>
                <View style={styles.rowBottom}>
                  <Text style={styles.inText}>IN {money(r.totalNewIn)}</Text>
                  <Text style={styles.outText}>OUT {money(r.totalNewOut)}</Text>
                  <Text style={[styles.netText, { color: r.isPositive ? colors.success : colors.danger }]}>
                    NET {money(r.netTotal)}
                  </Text>
                  <Ionicons name="camera" size={16} color={hasPhotos ? colors.goldDark : colors.cardBorder} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.summaryBar, { paddingBottom: insets.bottom + space.sm }]}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Runs</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total IN</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{money(summary.totalIn)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total OUT</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{money(summary.totalOut)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryValue, { color: summary.net >= 0 ? colors.success : colors.danger }]}>{money(summary.net)}</Text>
        </View>
      </View>

      {/* Calendar range modal */}
      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by date</Text>
              <TouchableOpacity onPress={() => setCalendarOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>From</Text>
            <TextInput
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtext}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>To</Text>
            <TextInput
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtext}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalClear}
                onPress={() => {
                  setDateFrom('');
                  setDateTo('');
                  setDateRange('all');
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.modalClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApply}
                onPress={() => {
                  setDateRange('custom');
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.modalApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  filterBar: { flexGrow: 0, marginBottom: space.sm },
  filterContent: { paddingVertical: space.xs },
  tableWrap: { flex: 1 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dateText: { color: colors.text, fontSize: font.sm, fontWeight: '700' },
  storeText: { color: colors.goldDark, fontSize: font.sm, fontWeight: '700' },
  empText: { color: colors.subtext, fontSize: font.xs, marginTop: 2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  inText: { color: colors.success, fontSize: font.sm, fontWeight: '700' },
  outText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },
  netText: { fontSize: font.sm, fontWeight: '900', flex: 1 },
  summaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.tableHeader,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { color: colors.subtext, fontSize: font.xs },
  summaryValue: { color: colors.text, fontSize: font.sm, fontWeight: '800', marginTop: 2 },
  calendarChip: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  modalTitle: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  modalLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginBottom: 4 },
  modalInput: {
    height: 46,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: font.sm,
    fontWeight: '700',
    marginBottom: space.md,
  },
  modalActions: { flexDirection: 'row', gap: space.sm },
  modalClear: {
    flex: 1,
    height: 46,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClearText: { color: colors.text, fontSize: font.sm, fontWeight: '700' },
  modalApply: {
    flex: 1,
    height: 46,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: colors.onPrimary, fontSize: font.sm, fontWeight: '800' },
});
