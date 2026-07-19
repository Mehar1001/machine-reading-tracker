import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';

export default function EmployeeLayout() {
  const { user } = useSession();

  if (!user) return <Redirect href="/" />;
  if (user.role === 'owner') return <Redirect href="/(admin)/stores" />;

  const isViewer = user.role === 'viewer';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.tableHeader,
          borderTopColor: colors.cardBorder,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: '700', letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="stores"
        options={{
          title: 'Stores',
          href: isViewer ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
