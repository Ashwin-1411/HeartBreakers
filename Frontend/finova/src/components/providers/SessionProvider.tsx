"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, UserProfile, authApi, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api";

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
      const token = getAuthToken();
      if (!token) {
        setSession({ authenticated: false });
        setError(null);
        return;
      }
      const { user } = await authApi.me();
      setSession({ authenticated: true, user });
      setError(null);
    } catch (err) {
      handleError(err);
      clearAuthToken();
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
        const { token, user } = await authApi.login(username, password);
        setAuthToken(token);
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
        const { token, user } = await authApi.register(username, password, email);
        setAuthToken(token);
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
      clearAuthToken();
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
