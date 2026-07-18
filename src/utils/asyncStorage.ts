// Typed helpers for the 4 session keys cached after login.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role, SessionUser } from '@/backend/types';

const KEYS = {
  ownerId: 'ownerId',
  employeeUid: 'employeeUid',
  employeeName: 'employeeName',
  role: 'role',
} as const;

export async function saveSession(user: SessionUser): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.ownerId, user.ownerId],
    [KEYS.employeeUid, user.uid],
    [KEYS.employeeName, user.name],
    [KEYS.role, user.role],
  ]);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.ownerId, KEYS.employeeUid, KEYS.employeeName, KEYS.role]);
}

export async function getSession(): Promise<SessionUser | null> {
  const pairs = await AsyncStorage.multiGet([KEYS.ownerId, KEYS.employeeUid, KEYS.employeeName, KEYS.role]);
  const map = Object.fromEntries(pairs) as Record<string, string | null>;
  const ownerId = map[KEYS.ownerId];
  const uid = map[KEYS.employeeUid];
  const name = map[KEYS.employeeName];
  const role = map[KEYS.role] as Role | null;
  if (!ownerId || !uid || !role) return null;
  return { ownerId, uid, name: name ?? '', email: '', role };
}

export async function getOwnerId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ownerId);
}

export async function getRole(): Promise<Role | null> {
  return (await AsyncStorage.getItem(KEYS.role)) as Role | null;
}
