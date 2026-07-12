'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth.context';

interface AuthGuardProps {
  children: React.ReactNode;
  mode: 'protected' | 'guest';
}

export function AuthGuard({ children, mode }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (mode === 'protected' && !user) {
      router.replace('/login');
    } else if (mode === 'guest' && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, mode, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"></div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (mode === 'protected' && !user) {
    return null;
  }

  if (mode === 'guest' && user) {
    return null;
  }

  return <>{children}</>;
}
