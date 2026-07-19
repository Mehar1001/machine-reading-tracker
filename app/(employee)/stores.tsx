import React from 'react';
import { Redirect } from 'expo-router';
import StoreListScreen from '@/screens/StoreListScreen';
import { useSession } from '@/context/SessionContext';

export default function EmployeeStores() {
  const { user } = useSession();
  if (user?.role === 'viewer') return <Redirect href="/(employee)/history" />;
  return <StoreListScreen />;
}
