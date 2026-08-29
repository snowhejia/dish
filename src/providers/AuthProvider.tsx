import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { ApiError, api, setApiSessionToken } from '@/lib/api';
import { appendImageUpload, type ImageUpload } from '@/lib/imageUpload';

const SESSION_STORAGE_KEY = 'dish.auth.session.v1';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  campus: string | null;
  status?: string;
  createdAt?: string;
  avatarUrl?: string | null;
  stats?: {
    reviews: number;
    photos: number;
    versionsAdded: number;
    pendingContributions: number;
  };
};

export type AuthSession = {
  token: string;
  expiresAt?: string;
  user: AuthUser;
};

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

type AuthStatus = 'loading' | 'guest' | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfile: (input: { displayName?: string; campus?: string | null }) => Promise<AuthUser>;
  updateAvatar: (photo: Exclude<ImageUpload, null>) => Promise<AuthUser>;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
  expiresAt?: string;
};

type MeResponse = {
  user: AuthUser;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const activeToken = useRef<string | null>(null);

  const clearLocalSession = useCallback(async () => {
    activeToken.current = null;
    setApiSessionToken(null);
    setSession(null);
    setStatus('guest');
    await sessionStorage.remove().catch(() => undefined);
  }, []);

  const commitSession = useCallback(async (nextSession: AuthSession) => {
    activeToken.current = nextSession.token;
    setApiSessionToken(nextSession.token);
    setSession(nextSession);
    setStatus('authenticated');
    // Authentication should still work for the current tab if device storage is unavailable.
    await sessionStorage.set(nextSession).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const stored = await sessionStorage.get();
      if (!active) return;
      if (!stored || isExpired(stored.expiresAt)) {
        await clearLocalSession();
        return;
      }

      activeToken.current = stored.token;
      setApiSessionToken(stored.token);
      try {
        const response = await api.get<MeResponse>('/api/v1/me');
        if (!active) return;
        await commitSession({ ...stored, user: response.user });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await clearLocalSession();
          return;
        }

        // Keep a valid cached session when the API is temporarily unreachable.
        setSession(stored);
        setStatus('authenticated');
      }
    };

    void restoreSession().catch(() => {
      if (active) void clearLocalSession();
    });

    return () => {
      active = false;
    };
  }, [clearLocalSession, commitSession]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<AuthResponse>('/api/v1/auth/login', input, { authenticated: false });
    const nextSession = toSession(response);
    await commitSession(nextSession);
    return nextSession.user;
  }, [commitSession]);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await api.post<AuthResponse>('/api/v1/auth/register', input, { authenticated: false });
    const nextSession = toSession(response);
    await commitSession(nextSession);
    return nextSession.user;
  }, [commitSession]);

  const logout = useCallback(async () => {
    const token = session?.token;
    await clearLocalSession();
    if (token) {
      await api.post<void>('/api/v1/auth/logout', undefined, { token });
    }
  }, [clearLocalSession, session?.token]);

  const refreshUser = useCallback(async () => {
    if (!session) return null;
    const requestToken = session.token;
    try {
      const response = await api.get<MeResponse>('/api/v1/me');
      if (activeToken.current !== requestToken) return null;
      const nextSession = { ...session, user: response.user };
      await commitSession(nextSession);
      return response.user;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearLocalSession();
        return null;
      }
      throw error;
    }
  }, [clearLocalSession, commitSession, session]);

  const updateProfile = useCallback(async (input: { displayName?: string; campus?: string | null }) => {
    if (!session) throw new Error('Sign in to update your profile.');
    const requestToken = session.token;
    const response = await api.patch<MeResponse>('/api/v1/me', input);
    if (activeToken.current !== requestToken) throw new Error('Your session changed before the update completed.');
    await commitSession({ ...session, user: response.user });
    return response.user;
  }, [commitSession, session]);

  const updateAvatar = useCallback(async (photo: Exclude<ImageUpload, null>) => {
    if (!session) throw new Error('Sign in to update your profile photo.');
    const requestToken = session.token;
    const form = new FormData();
    await appendImageUpload(form, 'avatar', photo, 'dish-avatar');
    const response = await api.put<MeResponse>('/api/v1/me/avatar', form);
    if (activeToken.current !== requestToken) throw new Error('Your session changed before the upload completed.');
    await commitSession({ ...session, user: response.user });
    return response.user;
  }, [commitSession, session]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    isAuthenticated: status === 'authenticated' && Boolean(session),
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    updateAvatar,
  }), [login, logout, refreshUser, register, session, status, updateAvatar, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

function toSession(response: AuthResponse): AuthSession {
  if (
    !response?.token
    || !response.user?.id
    || !response.user.email
    || !response.user.displayName
  ) {
    throw new Error('The server returned an invalid session.');
  }
  return {
    token: response.token,
    expiresAt: response.expiresAt,
    user: response.user,
  };
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

const sessionStorage = {
  async get(): Promise<AuthSession | null> {
    const serialized = Platform.OS === 'web'
      ? readWebStorage()
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!serialized) return null;
    try {
      const value = JSON.parse(serialized) as Partial<AuthSession>;
      if (
        typeof value.token !== 'string'
        || !value.token
        || typeof value.user?.id !== 'string'
        || typeof value.user.email !== 'string'
        || typeof value.user.displayName !== 'string'
        || typeof value.user.role !== 'string'
      ) return null;
      return value as AuthSession;
    } catch {
      return null;
    }
  },
  async set(value: AuthSession) {
    const serialized = JSON.stringify(value);
    if (Platform.OS === 'web') {
      writeWebStorage(serialized);
      return;
    }
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, serialized);
  },
  async remove() {
    if (Platform.OS === 'web') {
      removeWebStorage();
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  },
};

function readWebStorage() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function writeWebStorage(value: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_STORAGE_KEY, value);
}

function removeWebStorage() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_STORAGE_KEY);
}
