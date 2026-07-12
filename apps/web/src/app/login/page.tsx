'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth.context';
import { AuthGuard } from '../../components/auth.guard';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard mode="guest">
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-200/50 dark:border-zinc-800/50">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Welcome Back
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Sign in to resume your AI mock interviews
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-900/50">
                <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-450 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                  placeholder="candidate@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-3 text-sm font-semibold shadow hover:bg-zinc-800 dark:hover:bg-zinc-200 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

            <div className="text-center text-sm mt-4">
              <span className="text-zinc-650 dark:text-zinc-400">New to the platform? </span>
              <Link href="/register" className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline">
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}
