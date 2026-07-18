import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { backend } from '@/backend';
import type { SessionUser } from '@/backend/types';
import { saveSession, clearSession, getSession } from '@/utils/asyncStorage';

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((s) => setUser(s))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await backend.login(email, password);
    await saveSession(u);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await backend.logout();
    await clearSession();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, signIn, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
