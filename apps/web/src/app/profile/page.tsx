'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth.context';
import { AuthGuard } from '../../components/auth.guard';
import { fetchClient } from '../../lib/api.client';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('ENTRY_LEVEL');
  const [targetRolesInput, setTargetRolesInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetchClient('/api/v1/profile/me');
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || '');
          setHeadline(data.headline || '');
          setBio(data.bio || '');
          setExperienceLevel(data.experienceLevel || 'ENTRY_LEVEL');
          setTargetRolesInput((data.targetRoles || []).join(', '));
        } else {
          setError('Failed to load profile details.');
        }
      } catch {
        setError('Error establishing connection to backend.');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const targetRoles = targetRolesInput
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role !== '');

    try {
      const res = await fetchClient('/api/v1/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          headline,
          bio,
          experienceLevel,
          targetRoles,
        }),
      });

      if (res.ok) {
        setSuccess('Profile updated successfully.');
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to update profile.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthGuard mode="protected">
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Navigation Sidebar */}
        <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex flex-col justify-between p-6">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                AI Interviewer
              </span>
            </div>

            <nav className="space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
              >
                My Profile
              </Link>
            </nav>
          </div>

          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            <div className="px-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Signed in as</p>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar for Mobile */}
          <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 md:px-8">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 md:hidden">
              AI Interviewer
            </span>
            <div className="flex items-center gap-4 ml-auto">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-zinc-650 dark:text-zinc-450 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => logout()}
                className="text-sm font-medium text-red-650 hover:text-red-700 transition md:hidden"
              >
                Sign Out
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 max-w-3xl w-full mx-auto space-y-8">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Candidate Profile
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Manage your professional background details used to calibrate your AI mock interviews.
              </p>
            </div>

            {isLoadingProfile ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"></div>
                <p className="text-sm text-zinc-550 dark:text-zinc-450">Loading profile data...</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-900/50">
                    <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-900/50">
                    <p className="text-sm font-medium text-green-800 dark:text-green-400">{success}</p>
                  </div>
                )}

                {/* Uneditable User Account Details */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-500">Account Email</label>
                    <div className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-not-allowed">
                      {user?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-500">Platform Role</label>
                    <div className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 uppercase cursor-not-allowed">
                      {user?.role}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="headline" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Professional Headline
                    </label>
                    <input
                      id="headline"
                      name="headline"
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                      placeholder="Senior Full Stack Developer"
                    />
                  </div>

                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Biography
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                      placeholder="Tell us about your developer journey..."
                    />
                  </div>

                  <div>
                    <label htmlFor="experienceLevel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Experience Level
                    </label>
                    <select
                      id="experienceLevel"
                      name="experienceLevel"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                    >
                      <option value="ENTRY_LEVEL">Entry Level</option>
                      <option value="MID_LEVEL">Mid Level</option>
                      <option value="SENIOR">Senior Level</option>
                      <option value="LEAD">Lead / Architect</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="targetRoles" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Target Job Roles (comma separated)
                    </label>
                    <input
                      id="targetRoles"
                      name="targetRoles"
                      type="text"
                      value={targetRolesInput}
                      onChange={(e) => setTargetRolesInput(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
                      placeholder="React Developer, Node.js Engineer"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-semibold shadow hover:bg-zinc-800 dark:hover:bg-zinc-200 transition focus:outline-none disabled:opacity-50"
                  >
                    {isSaving ? 'Saving changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
