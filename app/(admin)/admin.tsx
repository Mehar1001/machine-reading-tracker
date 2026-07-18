import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { colors, font, space, radius } from '@/constants/theme';
import { money, toDateKey } from '@/utils/format';

interface Kpis {
  stores: number;
  employees: number;
  runsToday: number;
  netToday: number;
  runsWeek: number;
  netWeek: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();

  const [kpis, setKpis] = useState<Kpis>({ stores: 0, employees: 0, runsToday: 0, netToday: 0, runsWeek: 0, netWeek: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = toDateKey(new Date());
    const weekAgoDate = new Date();
    weekAgoDate.setDate(weekAgoDate.getDate() - 7);
    const weekAgo = toDateKey(weekAgoDate);
    const [stores, employees, runs, weekRuns] = await Promise.all([
      backend.getStores(user.ownerId),
      backend.getEmployees(user.ownerId),
      backend.getRuns(user.ownerId, { dateFrom: today, dateTo: today }),
      backend.getRuns(user.ownerId, { dateFrom: weekAgo, dateTo: today }),
    ]);
    setKpis({
      stores: stores.length,
      employees: employees.length,
      runsToday: runs.length,
      netToday: runs.reduce((s, r) => s + r.netTotal, 0),
      runsWeek: weekRuns.length,
      netWeek: weekRuns.reduce((s, r) => s + r.netTotal, 0),
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const kpiCards = [
    { label: 'Total Stores', value: String(kpis.stores), icon: 'storefront-outline' as const, tint: colors.blueBadge, iconColor: colors.info },
    { label: 'Total Employees', value: String(kpis.employees), icon: 'people-outline' as const, tint: colors.amberBadge, iconColor: colors.goldDark },
    { label: 'Runs Today', value: String(kpis.runsToday), icon: 'play-circle-outline' as const, tint: colors.grayBadge, iconColor: colors.subtext },
    {
      label: 'Net Today',
      value: money(kpis.netToday),
      icon: 'trending-up-outline' as const,
      tint: kpis.netToday >= 0 ? colors.positiveBadge : colors.negativeBadge,
      iconColor: kpis.netToday >= 0 ? colors.success : colors.danger,
      valueColor: kpis.netToday >= 0 ? colors.success : colors.danger,
    },
    { label: 'Runs This Week', value: String(kpis.runsWeek), icon: 'calendar-outline' as const, tint: colors.grayBadge, iconColor: colors.subtext },
    {
      label: 'Net This Week',
      value: money(kpis.netWeek),
      icon: 'stats-chart-outline' as const,
      tint: kpis.netWeek >= 0 ? colors.positiveBadge : colors.negativeBadge,
      iconColor: kpis.netWeek >= 0 ? colors.success : colors.danger,
      valueColor: kpis.netWeek >= 0 ? colors.success : colors.danger,
    },
  ];

  const actions = [
    { label: 'Manage Stores', desc: 'Add, edit & configure machines', icon: 'storefront' as const, route: '/admin/manage-stores' },
    { label: 'Manage Employees', desc: 'Create & deactivate accounts', icon: 'people' as const, route: '/admin/manage-employees' },
    { label: 'Transaction History', desc: 'All runs with calendar filter', icon: 'documents' as const, route: '/admin/manage-runs' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Admin dashboard" rightIcon="log-out-outline" onRightPress={signOut} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
          <Text style={styles.greeting}>Welcome, {user?.name}</Text>

          <View style={styles.kpiGrid}>
            {kpiCards.map((k) => (
              <View key={k.label} style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: k.tint }]}>
                  <Ionicons name={k.icon} size={18} color={k.iconColor} />
                </View>
                <Text style={[styles.kpiValue, 'valueColor' in k && { color: k.valueColor }]}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {kpis.stores === 0 && (
            <TouchableOpacity style={styles.onboardingCard} activeOpacity={0.85} onPress={() => router.push('/admin/manage-stores' as any)}>
              <Ionicons name="add-circle" size={28} color={colors.primary} />
              <Text style={styles.onboardingTitle}>Add your first store</Text>
              <Text style={styles.onboardingDesc}>Create a store and add machines so employees can start voucher runs.</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Quick actions</Text>
          {actions.map((a) => (
            <TouchableOpacity key={a.label} style={styles.actionTile} activeOpacity={0.85} onPress={() => router.push(a.route as any)}>
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  greeting: { color: colors.subtext, fontSize: font.sm, marginBottom: space.md },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: space.md,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  kpiValue: { color: colors.text, fontSize: font.lg, fontWeight: '900' },
  kpiLabel: { color: colors.subtext, fontSize: font.xs, fontWeight: '700', marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: font.sm, fontWeight: '800', letterSpacing: 0.5, marginTop: space.lg, marginBottom: space.sm },
  actionTile: {
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
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.card,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  actionDesc: { color: colors.subtext, fontSize: font.sm, marginTop: 2 },
  onboardingCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: space.md,
    marginBottom: space.md,
    alignItems: 'center',
  },
  onboardingTitle: { color: colors.primary, fontSize: font.md, fontWeight: '800', marginTop: space.sm },
  onboardingDesc: { color: colors.text, fontSize: font.sm, textAlign: 'center', marginTop: 4 },
});
