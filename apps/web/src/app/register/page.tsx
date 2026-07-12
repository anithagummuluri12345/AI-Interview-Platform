'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth.context';
import { AuthGuard } from '../../components/auth.guard';

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password requirements helper
  const isLengthValid = password.length >= 8;
  const isMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLengthValid) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!isMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, fullName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard mode="guest">
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-200/50 dark:border-zinc-800/50">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Create an Account
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Get started with your AI Mock Interview preparation
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
                <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-450 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                  placeholder="John Doe"
                />
              </div>

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
                <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
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
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className={isLengthValid ? 'text-green-600 dark:text-green-400 font-medium' : 'text-zinc-500'}>
                    ✓ Minimum 8 characters
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                  placeholder="••••••••"
                />
                {confirmPassword && (
                  <div className="mt-1 text-xs">
                    {isMatch ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">✓ Passwords match</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">✗ Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !isLengthValid || !isMatch}
                className="flex w-full justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-3 text-sm font-semibold shadow hover:bg-zinc-800 dark:hover:bg-zinc-200 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </button>
            </div>

            <div className="text-center text-sm mt-4">
              <span className="text-zinc-650 dark:text-zinc-400">Already have an account? </span>
              <Link href="/login" className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}
