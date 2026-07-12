'use client';

import React, { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '../../../../components/auth.guard';
import { InterviewForm, InterviewFormData } from '../../../../components/interview-form';
import { fetchClient } from '../../../../lib/api.client';

export default function EditInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [initialData, setInitialData] = useState<InterviewFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInterviewDetails = async () => {
      try {
        const res = await fetchClient(`/api/v1/interviews/${id}`);
        if (res.ok) {
          const data = await res.json();
          // Verify status allows editing
          if (data.status !== 'DRAFT' && data.status !== 'READY') {
            setError('Only interviews in DRAFT or READY status can be edited.');
          } else {
            setInitialData({
              title: data.title,
              targetRole: data.targetRole,
              companyName: data.companyName || '',
              experienceLevel: data.experienceLevel,
              type: data.type,
              mode: data.mode,
              duration: data.duration,
              skills: data.skills,
              jobDescription: data.jobDescription || '',
            });
          }
        } else {
          setError('Failed to retrieve interview details.');
        }
      } catch {
        setError('Connection to backend failed.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInterviewDetails();
  }, [id]);

  const handleSubmit = async (formData: InterviewFormData, asReady: boolean) => {
    setIsUpdating(true);
    try {
      const payload = {
        ...formData,
        status: asReady ? 'READY' : 'DRAFT',
      };

      const res = await fetchClient(`/api/v1/interviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[InterviewForm] Interview updated successfully:', data.id);
        console.log('[InterviewForm] Interview mode:', data.mode);
        if (asReady) {
          const targetPath = `/interviews/${data.id}/session`;
          console.log('[InterviewForm] Navigating to:', targetPath);
          router.push(targetPath);
        } else {
          console.log('[InterviewForm] Navigating to: /dashboard');
          router.push('/dashboard');
        }
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update interview configurations.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AuthGuard mode="protected">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 md:px-8">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Edit Interview Configuration
          </span>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            Cancel & Go Back
          </Link>
        </header>

        {/* Wizard Form container */}
        <main className="flex-1 flex items-center justify-center p-6 md:p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"></div>
              <p className="text-sm text-zinc-500">Loading configurations...</p>
            </div>
          ) : error ? (
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-xl shadow-md text-center space-y-4">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Cannot Edit Interview</h3>
              <p className="text-sm text-zinc-550 dark:text-zinc-400 leading-relaxed">{error}</p>
              <Link
                href="/dashboard"
                className="inline-block px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-800 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <InterviewForm
              initialData={initialData!}
              onSubmit={handleSubmit}
              isLoading={isUpdating}
              titleText="Edit Interview Setup"
            />
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
