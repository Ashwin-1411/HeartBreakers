"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, SessionPayload, UserProfile, authApi } from "@/lib/api";

interface SessionState {
  authenticated: boolean;
  user?: UserProfile;
}

interface SessionContextValue {
  session: SessionState;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function mapSessionPayload(payload: SessionPayload): SessionState {
  if (!payload.authenticated || !payload.user) {
    return { authenticated: false };
  }
  return { authenticated: true, user: payload.user };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ authenticated: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      setError(err.message);
    } else if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Unexpected error");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await authApi.session();
      setSession(mapSessionPayload(payload));
      setError(null);
    } catch (err) {
      handleError(err);
      setSession({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      setError(null);
      try {
        const { user } = await authApi.login(username, password);
        setSession({ authenticated: true, user });
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [handleError],
  );

  const register = useCallback(
    async (username: string, password: string, email?: string) => {
      setError(null);
      try {
        const { user } = await authApi.register(username, password, email);
        setSession({ authenticated: true, user });
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [handleError],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setSession({ authenticated: false });
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, error, login, register, logout, refresh, clearError: () => setError(null) }),
    [session, loading, error, login, register, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
