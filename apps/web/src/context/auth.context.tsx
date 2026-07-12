'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchClient, setAccessToken, setSessionExpiredCallback } from '../lib/api.client';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setAccessToken('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rt');
    }
    router.push('/login');
  }, [router]);

  useEffect(() => {
    setSessionExpiredCallback(handleSessionExpired);

    const restoreSession = async () => {
      const rt = typeof window !== 'undefined' ? window.localStorage.getItem('rt') : null;
      if (!rt) {
        setIsLoading(false);
        return;
      }

      try {
        const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanApiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: rt }),
        });

        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('rt', data.refreshToken);
          }

          const userRes = await fetchClient('/api/v1/auth/me');
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser({
              id: userData.id,
              email: userData.email,
              role: userData.role,
            });
          } else {
            handleSessionExpired();
          }
        } else {
          handleSessionExpired();
        }
      } catch {
        handleSessionExpired();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [handleSessionExpired]);

  const login = async (email: string, password: string) => {
    const res = await fetchClient('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Invalid credentials');
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rt', data.refreshToken);
    }
    setUser(data.user);
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const res = await fetchClient('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }

    // Automatically login after register
    await login(email, password);
  };

  const logout = async () => {
    const rt = typeof window !== 'undefined' ? window.localStorage.getItem('rt') : null;
    if (rt) {
      try {
        await fetchClient('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {
        // Proceed with logout anyway
      }
    }
    handleSessionExpired();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
