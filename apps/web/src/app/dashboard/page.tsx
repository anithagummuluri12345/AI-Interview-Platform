'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth.context';
import { AuthGuard } from '../../components/auth.guard';
import { fetchClient } from '../../lib/api.client';

interface Interview {
  id: string;
  title: string;
  targetRole: string;
  companyName: string | null;
  company?: string;
  type: string;
  mode: string;
  difficulty: string;
  duration: number;
  status: string;
  createdAt: string;
  report?: {
    overallScore: number;
  } | null;
}

interface AnalyticsSummary {
  totalCompleted: number;
  totalEvaluated: number;
  avgScore: number | null;
  bestScore: number | null;
  passRate: number | null;
  textAvgScore: number | null;
  voiceAvgScore: number | null;
  avgTechnical: number | null;
  avgClarity: number | null;
  avgCompleteness: number | null;
  mostPracticedCompany?: string;
  bestPerformingCompany?: string;
  weakestCompany?: string;
  avgScorePerCompany?: Record<string, number>;
  companyWiseProgress?: Record<string, number>;
}

interface TrendItem {
  interviewId: string;
  title: string;
  mode: string;
  overallScore: number;
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  completedAt: string;
}

interface StringGapItem {
  label: string;
  count: number;
}

interface SkillGaps {
  weakAreas: StringGapItem[];
  strongAreas: StringGapItem[];
  missingConcepts: StringGapItem[];
  focusAreas: StringGapItem[];
}

export default function DashboardPage() {
  const { user, logout } = useAuth();

  // Averages & Summary Stats
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [skillGaps, setSkillGaps] = useState<SkillGaps | null>(null);

  // History & Paginated state
  const [historyItems, setHistoryItems] = useState<Interview[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Filter query states
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [sumRes, trendRes, gapRes] = await Promise.all([
        fetchClient('/api/v1/analytics/summary'),
        fetchClient('/api/v1/analytics/trends'),
        fetchClient('/api/v1/analytics/skill-gaps'),
      ]);

      if (sumRes.ok && trendRes.ok && gapRes.ok) {
        const sumData = await sumRes.json();
        const trendData = await trendRes.json();
        const gapData = await gapRes.json();

        setSummary(sumData);
        setTrends(trendData);
        setSkillGaps(gapData);
      }
    } catch (err) {
      console.error('Failed to load candidate analytics:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        mode: modeFilter,
        difficulty: difficultyFilter,
        status: statusFilter,
        company: companyFilter,
      }).toString();

      const res = await fetchClient(`/api/v1/interviews/history?${query}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.items);
        setTotalItems(data.total);
        setTotalPages(data.totalPages);
      } else {
        setError('Failed to fetch interview history.');
      }
    } catch {
      setError('Connection to backend failed.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, modeFilter, difficultyFilter, statusFilter, companyFilter]);

  const refreshAllData = useCallback(() => {
    Promise.all([fetchAnalytics(), fetchHistory()]);
  }, [fetchAnalytics, fetchHistory]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        refreshAllData();
      }
    });
    return () => {
      active = false;
    };
  }, [page, modeFilter, difficultyFilter, statusFilter, companyFilter, refreshAllData]);

  // Handle manual search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete or cancel this interview?')) return;
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        refreshAllData();
      } else {
        alert('Action failed. Interview could not be deleted.');
      }
    } catch {
      alert('Error establishing connection.');
    }
  };

  // SVG Trend Chart builder
  const renderTrendChart = () => {
    if (trends.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-6 text-center">
          <span className="text-2xl mb-1 text-zinc-400">📈</span>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Score Trend</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-normal">
            No score trends available yet. Complete your first practice category simulation to draw your progress.
          </p>
        </div>
      );
    }

    if (trends.length === 1) {
      const score = trends[0].overallScore;
      return (
        <div className="h-48 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Score Trend</h4>
          <div className="flex items-center gap-4 flex-1 justify-center">
            <span className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50">{score}%</span>
            <div className="text-left">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">First interview completed</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{trends[0].title}</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 text-center leading-normal">
            Complete more interviews to unlock dynamic trend progression tracking.
          </p>
        </div>
      );
    }

    const width = 600;
    const height = 140;
    const padding = 15;
    const pointsCount = trends.length;
    const xStep = (width - padding * 2) / (pointsCount - 1);

    const coordinates = trends.map((item, idx) => {
      const x = padding + idx * xStep;
      // Map 0-100 overall score to coordinate height
      const y = height - padding - (item.overallScore / 100) * (height - padding * 2);
      return { x, y, score: item.overallScore, title: item.title };
    });

    const dPath = coordinates.reduce(
      (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    const fillPath = `${dPath} L ${coordinates[pointsCount - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;

    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Score Trend Progression</h4>
          <span className="text-[10px] font-semibold text-zinc-500">
            Last {trends.length} Evaluated Sessions
          </span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible text-zinc-200 dark:text-zinc-800" aria-label="Candidate score trend line chart">
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" className="text-zinc-600 dark:text-zinc-200" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" className="text-zinc-600 dark:text-zinc-200" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" strokeDasharray="3 3" strokeWidth="0.5" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" strokeDasharray="3 3" strokeWidth="0.5" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeWidth="0.5" />

            {/* Area Path */}
            <path d={fillPath} fill="url(#chart-grad)" />

            {/* Line Path */}
            <path d={dPath} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-900 dark:text-zinc-100" />

            {/* Point Nodes */}
            {coordinates.map((p, idx) => (
              <g key={idx} className="group/dot cursor-pointer">
                <circle cx={p.x} cy={p.y} r="5" fill="currentColor" className="text-zinc-900 dark:text-zinc-50 hover:r-7 transition-all" />
                <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-900 dark:text-zinc-50 opacity-0 group-hover/dot:opacity-100 transition-opacity" />
                {/* Embedded dynamic node scores labels */}
                <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[9px] font-extrabold fill-zinc-800 dark:fill-zinc-200 bg-zinc-900">
                  {p.score}%
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const getCompanyEmoji = (comp?: string) => {
    switch (comp) {
      case 'GOOGLE': return '🔴';
      case 'AMAZON': return '📦';
      case 'MICROSOFT': return '💻';
      case 'FLIPKART': return '🛒';
      case 'ADOBE': return '🎨';
      case 'ATLASSIAN': return '🌍';
      case 'UBER': return '🚗';
      case 'GOLDMAN_SACHS': return '🏦';
      case 'SALESFORCE': return '☁️';
      default: return '⚙️';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50';
      case 'IN_PROGRESS':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50';
      case 'DRAFT':
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700';
      case 'COMPLETED':
        return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50';
      default:
        return 'bg-zinc-50 dark:bg-zinc-900 text-zinc-450 dark:text-zinc-500 border border-zinc-200/50 dark:border-zinc-800';
    }
  };

  return (
    <AuthGuard mode="protected">
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Sidebar */}
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
                className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                My Profile
              </Link>
            </nav>
          </div>
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            <div className="px-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Signed in as</p>
              <p className="text-sm font-medium text-zinc-705 dark:text-zinc-300 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Content Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6 md:px-8">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 md:hidden">
              AI Interviewer
            </span>
            <div className="flex items-center gap-4 ml-auto">
              <Link
                href="/profile"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Profile Settings
              </Link>
              <button
                onClick={() => logout()}
                className="text-sm font-semibold text-red-650 hover:text-red-700 transition md:hidden"
              >
                Sign Out
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8 overflow-y-auto">
            {/* Header Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5 gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Candidate Progress Center
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Track your scores, practice simulations, and review personalized skill recommendation paths.
                </p>
              </div>
              <Link
                href="/interviews/new"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-md self-start sm:self-auto"
              >
                + New Interview
              </Link>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center justify-between">
                <p className="text-sm text-red-800 dark:text-red-400 font-semibold">{error}</p>
                <button
                  onClick={refreshAllData}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-xs font-bold hover:bg-red-200 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* 1. Summary Analytics Rows */}
            {summary && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1: Completed */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Total Completed</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                        {summary.totalCompleted}
                      </span>
                      <span className="text-xs text-zinc-400">sessions</span>
                    </div>
                    {summary.totalCompleted > summary.totalEvaluated && (
                      <p className="text-[10px] text-zinc-400 mt-1.5">
                        {summary.totalCompleted - summary.totalEvaluated} pending report generation
                      </p>
                    )}
                  </div>

                  {/* Card 2: Average Score */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Average Score</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                        {summary.avgScore !== null ? `${summary.avgScore}%` : 'N/A'}
                      </span>
                      {summary.avgScore !== null && (
                        <span className="text-[10px] font-bold text-emerald-500">
                          {summary.avgScore >= 75 ? 'Strong' : summary.avgScore >= 50 ? 'Pass' : 'Improve'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      Evaluated on {summary.totalEvaluated} reviews
                    </p>
                  </div>

                  {/* Card 3: Best Score */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Best Score</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                        {summary.bestScore !== null ? `${summary.bestScore}%` : 'N/A'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5">Highest grade recorded</p>
                  </div>

                  {/* Card 4: Pass Rate */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Pass Rate</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                        {summary.passRate !== null ? `${summary.passRate}%` : 'N/A'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5">Score threshold ≥ 50%</p>
                  </div>
                </div>

                {/* Sub Averages Row */}
                {summary.totalEvaluated > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Mode averages */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm flex justify-between items-center">
                      <div className="flex-1 text-center border-r border-zinc-150 dark:border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">TEXT Average</span>
                        <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">
                          {summary.textAvgScore !== null ? `${summary.textAvgScore}%` : 'N/A'}
                        </p>
                      </div>
                      <div className="flex-1 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">VOICE Average</span>
                        <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">
                          {summary.voiceAvgScore !== null ? `${summary.voiceAvgScore}%` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Dimension averages */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3 text-center md:text-left">
                        Average Answer Performance Dimensions
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                        <div>
                          <p className="text-zinc-400 font-normal text-[9px] uppercase">Accuracy</p>
                          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {summary.avgTechnical !== null ? `${summary.avgTechnical}/10` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-400 font-normal text-[9px] uppercase">Clarity</p>
                          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {summary.avgClarity !== null ? `${summary.avgClarity}/10` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-400 font-normal text-[9px] uppercase">Completeness</p>
                          <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {summary.avgCompleteness !== null ? `${summary.avgCompleteness}/10` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Company Insights Row */}
                {summary.totalCompleted > 0 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Best Performing Company */}
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Best Performing Company</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                            {summary.bestPerformingCompany && summary.bestPerformingCompany !== 'N/A'
                              ? `${getCompanyEmoji(summary.bestPerformingCompany)} ${summary.bestPerformingCompany}`
                              : 'N/A'}
                          </span>
                          {summary.bestPerformingCompany && summary.bestPerformingCompany !== 'N/A' && summary.avgScorePerCompany?.[summary.bestPerformingCompany] !== undefined && (
                            <span className="text-xs font-bold text-emerald-500">
                              ({summary.avgScorePerCompany[summary.bestPerformingCompany]}%)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1.5 font-medium text-zinc-500">Highest average score</p>
                      </div>

                      {/* Weakest Company */}
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Weakest Company</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                            {summary.weakestCompany && summary.weakestCompany !== 'N/A'
                              ? `${getCompanyEmoji(summary.weakestCompany)} ${summary.weakestCompany}`
                              : 'N/A'}
                          </span>
                          {summary.weakestCompany && summary.weakestCompany !== 'N/A' && summary.avgScorePerCompany?.[summary.weakestCompany] !== undefined && (
                            <span className="text-xs font-bold text-red-500">
                              ({summary.avgScorePerCompany[summary.weakestCompany]}%)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1.5 font-medium text-zinc-500">Lowest average score</p>
                      </div>

                      {/* Most Practiced Company */}
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Most Practiced Company</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight">
                            {summary.mostPracticedCompany && summary.mostPracticedCompany !== 'N/A'
                              ? `${getCompanyEmoji(summary.mostPracticedCompany)} ${summary.mostPracticedCompany}`
                              : 'N/A'}
                          </span>
                          {summary.mostPracticedCompany && summary.mostPracticedCompany !== 'N/A' && summary.companyWiseProgress?.[summary.mostPracticedCompany] !== undefined && (
                            <span className="text-xs font-bold text-zinc-500">
                              ({summary.companyWiseProgress[summary.mostPracticedCompany]} completed)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1.5 font-medium text-zinc-500">Most simulated company profile</p>
                      </div>
                    </div>

                    {/* Company Progress & Average Scores Per Company */}
                    {summary.companyWiseProgress && Object.keys(summary.companyWiseProgress).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3 font-semibold">
                            Company Practice Frequency (Progress)
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(summary.companyWiseProgress).map(([comp, count]) => {
                              const totalCompletions = summary.totalCompleted || 1;
                              const percentage = Math.round((count / totalCompletions) * 100);
                              return (
                                <div key={comp} className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                    {getCompanyEmoji(comp)} {comp}
                                  </span>
                                  <div className="flex items-center gap-2 flex-1 max-w-[200px] ml-auto">
                                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div
                                        style={{ width: `${percentage}%` }}
                                        className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full"
                                      />
                                    </div>
                                    <span className="text-[10px] text-zinc-400 font-bold w-4 text-right">{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3 font-semibold">
                            Average Score per Company
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(summary.avgScorePerCompany || {}).map(([comp, avg]) => (
                              <div key={comp} className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                  {getCompanyEmoji(comp)} {comp}
                                </span>
                                <div className="flex items-center gap-2 flex-1 max-w-[200px] ml-auto">
                                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${avg}%` }}
                                      className="h-full bg-emerald-500 rounded-full"
                                    />
                                  </div>
                                  <span className="text-[10px] text-zinc-400 font-bold w-8 text-right">{avg}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Progress Chart & Skill Aggregation Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {renderTrendChart()}
              </div>

              {/* Aggregated Skill gaps intelligence */}
              {skillGaps && (summary?.totalEvaluated || 0) > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Skill Intelligence</h4>
                  <div className="space-y-3">
                    {/* Strengths */}
                    {skillGaps.strongAreas.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-500">Strengths</span>
                        <div className="flex flex-wrap gap-1">
                          {skillGaps.strongAreas.map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                              {s.label} ({s.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Weaknesses */}
                    {skillGaps.weakAreas.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-rose-500">Weak Areas</span>
                        <div className="flex flex-wrap gap-1">
                          {skillGaps.weakAreas.map((w, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 text-[10px] font-bold rounded-lg border border-rose-100 dark:border-rose-900/30">
                              {w.label} ({w.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Missing Concepts */}
                    {skillGaps.missingConcepts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-amber-500">Missing Concepts</span>
                        <div className="flex flex-wrap gap-1">
                          {skillGaps.missingConcepts.map((m, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 text-[10px] font-bold rounded-lg border border-amber-100 dark:border-amber-900/30">
                              {m.label} ({m.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Skill recommendation path */}
            {skillGaps && skillGaps.focusAreas.length > 0 && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">AI Focus Recommendations</h4>
                <ul className="space-y-2 text-xs text-zinc-650 dark:text-zinc-350 list-disc list-inside">
                  {skillGaps.focusAreas.map((f, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {f.label} <span className="text-zinc-400 font-semibold">({f.count} flag{f.count > 1 ? 's' : ''})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. Complete History List & Filters */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Interview Session Directory</h3>
                {/* Search Form */}
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by job role or title..."
                    className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none"
                  />
                  <button type="submit" className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">
                    Search
                  </button>
                </form>
              </div>

              {/* Filters row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Mode</label>
                  <select
                    value={modeFilter}
                    onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-2 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="">All Modes</option>
                    <option value="TEXT">Text Only</option>
                    <option value="VOICE">Voice Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Difficulty</label>
                  <select
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-2 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="">All Difficulties</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-2 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="READY">Ready</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Company</label>
                  <select
                    value={companyFilter}
                    onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-2 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="">All Companies</option>
                    <option value="GENERIC">Generic</option>
                    <option value="AMAZON">Amazon</option>
                    <option value="GOOGLE">Google</option>
                    <option value="MICROSOFT">Microsoft</option>
                    <option value="FLIPKART">Flipkart</option>
                    <option value="ADOBE">Adobe</option>
                    <option value="ATLASSIAN">Atlassian</option>
                    <option value="UBER">Uber</option>
                    <option value="GOLDMAN_SACHS">Goldman Sachs</option>
                    <option value="SALESFORCE">Salesforce</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearch('');
                      setModeFilter('');
                      setDifficultyFilter('');
                      setStatusFilter('');
                      setCompanyFilter('');
                      setPage(1);
                    }}
                    className="w-full py-1.5 text-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* History list */}
              {isLoading ? (
                <div className="text-center py-12 text-sm text-zinc-400 animate-pulse">Loading history directory...</div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/20 dark:bg-zinc-900/10">
                  <span className="text-3xl block mb-2">📁</span>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">No Sessions Found</h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
                    Adjust your active search filter query or configure a new mock interview session to start.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyItems.map((item) => {
                    const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    const score = item.report?.overallScore;
                    const passResult = score !== undefined ? (score >= 50 ? 'PASS' : 'FAIL') : null;

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-350 dark:hover:border-zinc-700 transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-50 leading-tight truncate">
                              {item.title}
                            </h4>
                            <span className={`text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(item.status)}`}>
                              {item.status}
                            </span>
                            {item.company && (
                              <span className="text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                                {getCompanyEmoji(item.company)} {item.company}
                              </span>
                            )}
                            {passResult && (
                              <span className={`text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                                passResult === 'PASS'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-200'
                                  : 'bg-red-50 dark:bg-red-950/20 text-red-500 border border-red-200'
                              }`}>
                                {passResult} ({score}%)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            Role: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.targetRole}</span>
                            {item.companyName ? ` at ${item.companyName}` : ''} • Date: {formattedDate}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">{item.type}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">{item.mode}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">{item.difficulty}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">{item.duration} Min</span>
                          </div>
                        </div>

                        {/* Actions block */}
                        <div className="flex items-center gap-2 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0 justify-end text-xs font-semibold">
                          {item.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-3 py-1.5 rounded-lg text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                              >
                                Delete
                              </button>
                              <Link
                                href={`/interviews/${item.id}/edit`}
                                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
                              >
                                Continue Setup
                              </Link>
                            </>
                          )}

                          {item.status === 'READY' && (
                            <>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-3 py-1.5 rounded-lg text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                              >
                                Cancel
                              </button>
                              <Link
                                href={`/interviews/${item.id}/edit`}
                                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
                              >
                                Edit
                              </Link>
                              <Link
                                href={`/interviews/${item.id}/session`}
                                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
                              >
                                Start Interview
                              </Link>
                            </>
                          )}

                          {item.status === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-3 py-1.5 rounded-lg text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                              >
                                Cancel
                              </button>
                              <Link
                                href={`/interviews/${item.id}/session`}
                                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
                              >
                                Resume
                              </Link>
                            </>
                          )}

                          {(item.status === 'COMPLETED' || item.status === 'CANCELLED') && (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/interviews/${item.id}`}
                                className="px-3 py-1.5 rounded-lg border border-zinc-250 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition text-center text-xs font-semibold"
                              >
                                Specs
                              </Link>
                              {item.status === 'COMPLETED' && (
                                <>
                                  <Link
                                    href={`/interviews/${item.id}/report`}
                                    className="px-3 py-1.5 rounded-lg border border-zinc-250 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition text-center text-xs font-semibold"
                                  >
                                    View Report
                                  </Link>
                                  <Link
                                    href={`/interviews/${item.id}/replay`}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white transition text-center text-xs font-bold shadow-md hover:shadow-indigo-500/20"
                                  >
                                    🔁 Replay Interview
                                  </Link>
                                  <Link
                                    href="/interviews/new"
                                    className="px-3 py-1.5 rounded-lg border border-zinc-250 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition text-center text-xs font-semibold"
                                  >
                                    🎯 Continue Practice
                                  </Link>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination row */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-150 dark:border-zinc-800 text-xs font-semibold text-zinc-500">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span>
                        Page {page} of {totalPages} ({totalItems} total items)
                      </span>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
