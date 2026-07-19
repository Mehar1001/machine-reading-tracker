import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SessionProvider, useSession } from '@/context/SessionContext';
import { colors } from '@/constants/theme';

function RootNavigator() {
  const { user, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const atHome = !firstSegment;

    if (!user && !inAuthGroup && !atHome) {
      router.replace('/');
    } else if (user && (inAuthGroup || atHome)) {
      if (user.role === 'owner') {
        router.replace('/(admin)/stores');
      } else if (user.role === 'viewer') {
        router.replace('/(employee)/history');
      } else {
        router.replace('/(employee)/stores');
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(employee)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="stores/[storeId]" />
      <Stack.Screen name="runs/[runId]" />
      <Stack.Screen name="admin/manage-stores" />
      <Stack.Screen name="admin/manage-employees" />
      <Stack.Screen name="admin/manage-runs" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
