'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '../../../components/auth.guard';
import { InterviewForm, InterviewFormData } from '../../../components/interview-form';
import { fetchClient } from '../../../lib/api.client';

export default function NewInterviewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: InterviewFormData, asReady: boolean) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: asReady ? 'READY' : 'DRAFT',
      };

      const res = await fetchClient('/api/v1/interviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[InterviewForm] Interview created successfully:', data.id);
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
        throw new Error(errorData.message || 'Failed to create mock interview.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard mode="protected">
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 md:px-8">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Configure Interview Setup
          </span>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            Cancel & Go Back
          </Link>
        </header>

        {/* Wizard Form */}
        <main className="flex-1 flex items-center justify-center p-6 md:p-8">
          <InterviewForm onSubmit={handleSubmit} isLoading={isSubmitting} titleText="Create Mock Interview" />
        </main>
      </div>
    </AuthGuard>
  );
}
