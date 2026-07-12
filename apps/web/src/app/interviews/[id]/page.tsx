'use client';

import React, { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '../../../components/auth.guard';
import { fetchClient } from '../../../lib/api.client';

interface Interview {
  id: string;
  title: string;
  targetRole: string;
  companyName: string | null;
  type: string;
  mode: string;
  experienceLevel: string;
  skills: string[];
  jobDescription: string | null;
  status: string;
  duration: number;
  createdAt: string;
}

export default function InterviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInterview(data);
      } else {
        setError('Failed to fetch interview details.');
      }
    } catch {
      setError('Connection to server failed.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchDetails();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchDetails]);

  const handleDelete = async () => {
    if (!interview) return;
    if (!confirm('Are you sure you want to delete or cancel this interview?')) return;

    try {
      const res = await fetchClient(`/api/v1/interviews/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        alert('Action failed.');
      }
    } catch {
      alert('Connection error.');
    }
  };

  if (isLoading) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"></div>
            <p className="text-sm text-zinc-500">Loading details...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error || !interview) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-xl shadow-md text-center space-y-4">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Error Loading Interview</h3>
            <p className="text-sm text-zinc-550 dark:text-zinc-400">{error || 'Interview not found.'}</p>
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-800 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const formattedDate = new Date(interview.createdAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AuthGuard mode="protected">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              ← Back
            </Link>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Interview Specifications
            </span>
          </div>
        </header>

        {/* Details Card */}
        <main className="flex-1 p-6 md:p-8 max-w-3xl w-full mx-auto space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-150 dark:border-zinc-850 pb-5">
              <div>
                <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                  {interview.title}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Target job role: <span className="font-semibold text-zinc-755 dark:text-zinc-300">{interview.targetRole}</span>
                  {interview.companyName ? ` at ${interview.companyName}` : ''}
                </p>
              </div>
              <span
                className={`self-start text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                  interview.status === 'READY'
                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50'
                    : interview.status === 'IN_PROGRESS'
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'
                      : interview.status === 'DRAFT'
                        ? 'bg-zinc-105 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                Status: {interview.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm border-b border-zinc-150 dark:border-zinc-850 pb-5">
              <div>
                <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Experience Calibration
                </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250 capitalize">
                  {interview.experienceLevel.toLowerCase()} Level
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Simulation Settings
                </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250 capitalize">
                  {interview.type.toLowerCase()} • {interview.mode.toLowerCase()} mode
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Allotted Time Limit
                </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250">
                  {interview.duration} Minutes
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  Configured On
                </span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250">
                  {formattedDate}
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">
                Target Technologies & Skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {interview.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-300 rounded-lg text-xs font-bold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {interview.jobDescription && (
              <div className="border-t border-zinc-150 dark:border-zinc-850 pt-5">
                <span className="block text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-2">
                  Job Description Alignment Context
                </span>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {interview.jobDescription}
                </p>
              </div>
            )}

            <div className="pt-6 border-t border-zinc-150 dark:border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {(interview.status === 'DRAFT' || interview.status === 'READY') && (
                  <Link
                    href={`/interviews/${interview.id}/edit`}
                    className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 font-semibold transition"
                  >
                    Edit Setup
                  </Link>
                )}

                {interview.status !== 'COMPLETED' && interview.status !== 'CANCELLED' && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-650 border border-red-200/50 dark:border-red-900/50 hover:bg-red-100/50 transition font-semibold"
                  >
                    {interview.status === 'DRAFT' ? 'Delete Setup' : 'Cancel Interview'}
                  </button>
                )}
              </div>

              {(interview.status === 'READY' || interview.status === 'IN_PROGRESS') && (
                <Link
                  href={`/interviews/${interview.id}/session`}
                  className="w-full sm:w-auto text-center px-6 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold transition shadow-md"
                >
                  {interview.status === 'IN_PROGRESS' ? 'Resume Simulation' : 'Start Simulation Now'}
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
