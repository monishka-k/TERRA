'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import type { LoginRequest, LogoutResponse, UserResponse } from '@/lib/api/types';

export interface AuthContextValue {
  /** The currently authenticated user identity, or null if unauthenticated. */
  user: UserResponse | null;
  /** True while resolving initial session hydration or executing login/logout. */
  isLoading: boolean;
  /** Convenient boolean shorthand for user !== null. */
  isAuthenticated: boolean;
  /** Human-readable error message from the most recent auth attempt. */
  error: string | null;
  /** Authenticates user with email and password via POST /auth/login. */
  login: (credentials: LoginRequest) => Promise<UserResponse>;
  /** Revokes active session via POST /auth/logout and clears local user state. */
  logout: () => Promise<void>;
  /** Re-evaluates active session cookie via GET /auth/me. */
  refreshUser: () => Promise<UserResponse | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async (): Promise<UserResponse | null> => {
    try {
      const data = await apiGet<UserResponse>('/auth/me');
      setUser(data);
      setError(null);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Normal unauthenticated session state — silent resolution
        setUser(null);
        setError(null);
      } else if (err instanceof ApiError && err.status === 0) {
        // Backend service unreachable
        setUser(null);
        setError('Backend service unreachable.');
      } else {
        setUser(null);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial session hydration from existing HTTP-only session cookie
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) {
        await refreshUser();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (credentials: LoginRequest): Promise<UserResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const authenticatedUser = await apiPost<UserResponse>('/auth/login', credentials);
        setUser(authenticatedUser);
        return authenticatedUser;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Authentication failed.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiPost<LogoutResponse>('/auth/logout');
    } catch {
      // Regardless of server status, purge local session state
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      error,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, error, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
