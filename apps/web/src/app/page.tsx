'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth.context';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50">
      {/* Landing Header */}
      <header className="h-20 max-w-7xl w-full mx-auto flex items-center justify-between px-6 md:px-8 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI Mock Interviewer
        </span>
        <nav className="flex items-center gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto flex flex-col items-center justify-center text-center px-6 py-20 md:py-32 space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.1]">
            Calibrate Your Skills with <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-zinc-700 to-zinc-900 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
              Realistic AI Mock Interviews
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-500 dark:text-zinc-400">
            Upload your resume, define target job descriptions, and undergo voice-guided or text-based mock interview simulations. Receive real-time structural feedback.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto h-12 flex items-center justify-center px-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-base font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
            >
              Enter Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="w-full sm:w-auto h-12 flex items-center justify-center px-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-base font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                Start Practice Now
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto h-12 flex items-center justify-center px-8 rounded-lg border border-zinc-300 dark:border-zinc-800 text-base font-semibold hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
