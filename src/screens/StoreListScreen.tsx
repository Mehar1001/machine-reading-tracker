import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backend } from '@/backend';
import type { Store, Run } from '@/backend/types';
import { useSession } from '@/context/SessionContext';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import GoldButton from '@/components/ui/GoldButton';
import { colors, font, space, radius } from '@/constants/theme';
import { formatDateTime } from '@/utils/format';

interface Props {
  isAdmin?: boolean;
}

export default function StoreListScreen({ isAdmin }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();

  const [stores, setStores] = useState<Store[]>([]);
  const [machineCounts, setMachineCounts] = useState<Record<string, number>>({});
  const [lastRuns, setLastRuns] = useState<Record<string, Run | null>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const list = await backend.getStores(user.ownerId);
    setStores(list);
    const counts: Record<string, number> = {};
    const runs: Record<string, Run | null> = {};
    await Promise.all(
      list.map(async (s) => {
        const machines = await backend.getMachines(user.ownerId, s.id);
        counts[s.id] = machines.length;
        runs[s.id] = await backend.getLastRun(user.ownerId, s.id);
      })
    );
    setMachineCounts(counts);
    setLastRuns(runs);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase())
  );

  const renderStore = ({ item }: { item: Store }) => {
    const last = lastRuns[item.id];
    const count = machineCounts[item.id] ?? 0;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.storeCard}
        onPress={() => router.push((isAdmin ? `/admin/stores/${item.id}` : `/stores/${item.id}`) as any)}
      >
        <View style={styles.storeIcon}>
          <Ionicons name="storefront-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.storeInfo}>
          <View style={styles.storeTitleRow}>
            <Text style={styles.storeName}>{item.name}</Text>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={12} color={colors.subtext} />
            <Text style={styles.address} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{count} machine{count === 1 ? '' : 's'}</Text>
            {last && <Text style={styles.metaText}>• Last run {formatDateTime(last.timestamp)}</Text>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={isAdmin ? `All stores (${filtered.length})` : 'Select store'}
        rightIcon={isAdmin ? 'add' : 'log-out-outline'}
        onRightPress={isAdmin ? () => router.push('/admin/manage-stores') : signOut}
      />
      {isAdmin && <Text style={styles.subline}>{user?.name ?? 'Admin'}</Text>}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.subtext} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search stores..."
          placeholderTextColor={colors.subtext}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            icon="storefront-outline"
            title="No stores found"
            subtitle={isAdmin ? 'Tap below to add your first store.' : 'No stores assigned. Contact your admin.'}
          />
          {isAdmin && (
            <GoldButton
              label="Add store"
              icon="add"
              onPress={() => router.push('/admin/manage-stores' as any)}
              style={{ marginTop: space.md }}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderStore}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md },
  subline: { color: colors.subtext, fontSize: font.sm, marginBottom: space.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    height: 44,
    marginBottom: space.md,
    gap: space.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.sm, height: '100%' },
  list: { paddingBottom: space.xl },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
    gap: space.md,
  },
  storeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1 },
  storeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  storeName: { color: colors.text, fontSize: font.md, fontWeight: '600', flexShrink: 1 },
  codeBadge: {
    backgroundColor: colors.amberBadge,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  codeText: { color: colors.goldDark, fontSize: 10, fontWeight: '700' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  address: { color: colors.subtext, fontSize: font.sm, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaText: { color: colors.subtext, fontSize: font.xs },
});
