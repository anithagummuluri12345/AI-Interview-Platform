'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../../components/auth.guard';
import { fetchClient } from '../../../../lib/api.client';

interface InterviewReport {
  id: string;
  interviewId: string;
  overallScore: number;
  technicalScore: number | null;
  problemSolvingScore: number | null; // Clarity
  communicationScore: number | null; // Completeness
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string[];
  summary: string | null;
  generatedAt: string;
}

interface QuestionEvaluation {
  id: string;
  technicalAccuracy: number;
  completeness: number;
  clarity: number;
  coveredConcepts: string[];
  missingConcepts: string[];
  strengths: string[];
  feedback: string;
  recommendedAction: string;
}

interface Question {
  id: string;
  sequence: number;
  topic: string;
  difficulty: string;
  questionText: string;
  expectedConcepts: string[];
  answer: {
    id: string;
    answerText: string;
    submittedAt: string;
    evaluation: QuestionEvaluation | null;
  } | null;
}

interface ReportState {
  report: InterviewReport;
  questions: Question[];
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReportState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (autoGenerate = true) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Try to fetch existing report
      const res = await fetchClient(`/api/v1/interviews/${id}/report`);
      if (res.status === 404 && autoGenerate) {
        // 2. If not found, start generation
        setIsGenerating(true);
        setIsLoading(true);

        const generateRes = await fetchClient(`/api/v1/interviews/${id}/report/generate`, {
          method: 'POST',
        });

        if (!generateRes.ok) {
          const errData = await generateRes.json();
          throw new Error(errData.message || 'AI generation failed.');
        }

        // Fetch again after generation succeeds
        const retryRes = await fetchClient(`/api/v1/interviews/${id}/report`);
        if (!retryRes.ok) {
          throw new Error('Failed to retrieve generated report.');
        }
        const retryData = await retryRes.json();
        setData(retryData);
        setIsGenerating(false);
      } else if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch report.');
      } else {
        const reportData = await res.json();
        setData(reportData);
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'An error occurred loading the report.');
      setIsGenerating(false);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchReport();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchReport]);

  if (isGenerating) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800 border-t-white animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Generating Performance Review</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Our AI recruiter is grading your responses, analyzing core terminology coverage, and building your personalized feedback metrics...
              </p>
            </div>
            <div className="text-[10px] text-zinc-550 font-semibold tracking-wider uppercase bg-zinc-950 p-2.5 rounded-lg border border-zinc-850">
              Generating report via Gemini 2.5
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (isLoading) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-white mb-4"></div>
          <p className="text-sm text-zinc-400 font-semibold tracking-wide">Loading report details...</p>
        </div>
      </AuthGuard>
    );
  }

  if (error || !data) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center space-y-4">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-lg font-bold text-white">Evaluation Failed</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {error || 'The interview must be completed and fully evaluated to view report.'}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => fetchReport()}
                className="px-4 py-2 bg-white text-zinc-900 text-sm font-bold rounded-lg hover:bg-zinc-200 transition"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const { report, questions } = data;

  // Grade badge mapping
  const getGrade = (score: number) => {
    if (score >= 90) return { label: 'EXCELLENT', color: 'text-emerald-400 border-emerald-950/30 bg-emerald-950/10' };
    if (score >= 75) return { label: 'STRONG', color: 'text-indigo-400 border-indigo-950/30 bg-indigo-950/10' };
    if (score >= 50) return { label: 'PASS', color: 'text-yellow-450 border-yellow-950/30 bg-yellow-950/10' };
    return { label: 'NEEDS IMPROVEMENT', color: 'text-red-400 border-red-950/30 bg-red-950/10' };
  };

  const grade = getGrade(report.overallScore);

  return (
    <AuthGuard mode="protected">
      <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
        {/* Navigation Bar */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 md:px-8 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <Link href="/dashboard" className="hover:text-white transition">
              ← Dashboard
            </Link>
            <span>/</span>
            <span className="text-white">Evaluation Report</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/interviews/${id}/replay`}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-lg transition-all text-white flex items-center gap-1 shadow-md"
            >
              🔁 Replay Interview
            </Link>
            <span className="text-[10px] text-zinc-500 font-bold">
              Generated: {new Date(report.generatedAt).toLocaleDateString()}
            </span>
          </div>
        </header>

        <main className="max-w-5xl w-full mx-auto px-6 md:px-8 mt-8 space-y-8">
          {/* Top Panel: Scores & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Ring Card */}
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative flex items-center justify-center">
                {/* Visual circle path */}
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" className="stroke-zinc-800" strokeWidth="8" fill="transparent" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    className="stroke-white"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 56}
                    strokeDashoffset={2 * Math.PI * 56 * (1 - report.overallScore / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white">{report.overallScore}</span>
                  <span className="text-[9px] text-zinc-500 font-bold tracking-widest">SCORE</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold border px-3 py-1 rounded-full ${grade.color}`}>
                {grade.label}
              </span>
            </div>

            {/* Score Breakdowns Meter Card */}
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl md:col-span-2 flex flex-col justify-center space-y-6">
              <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider">Metrics Breakdown</h2>
              <div className="space-y-4">
                {/* Technical Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300">Technical Accuracy</span>
                    <span className="text-white">{report.technicalScore || 0} / 10</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${(report.technicalScore || 0) * 10}%` }}
                    ></div>
                  </div>
                </div>

                {/* Problem Solving Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300">Communication & Clarity</span>
                    <span className="text-white">{report.problemSolvingScore || 0} / 10</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${(report.problemSolvingScore || 0) * 10}%` }}
                    ></div>
                  </div>
                </div>

                {/* Communication Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300">Answer Completeness</span>
                    <span className="text-white">{report.communicationScore || 0} / 10</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${(report.communicationScore || 0) * 10}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Synthesis & Summary */}
          {report.summary && (
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-3">
              <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider">Executive Summary</h2>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
            </div>
          )}

          {/* Section: Strengths / Weaknesses / Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strengths */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 col-span-1">
              <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>✓</span> Key Strengths
              </h3>
              <ul className="space-y-2 text-xs text-zinc-300 list-disc list-inside">
                {report.strengths.map((s, idx) => (
                  <li key={idx} className="leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 col-span-1">
              <h3 className="text-xs font-extrabold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>✗</span> Weaknesses & Gaps
              </h3>
              <ul className="space-y-2 text-xs text-zinc-300 list-disc list-inside">
                {report.weaknesses.map((w, idx) => (
                  <li key={idx} className="leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 col-span-1">
              <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>★</span> Improvement Action Plan
              </h3>
              <ul className="space-y-2 text-xs text-zinc-300 list-disc list-inside">
                {report.improvementPlan.map((ip, idx) => (
                  <li key={idx} className="leading-relaxed">{ip}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section: Per-Question Logs */}
          <div className="space-y-6">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2">Questions Log & Grading</h2>

            <div className="space-y-6">
              {questions.map((q) => {
                const evalItem = q.answer?.evaluation;
                return (
                  <div key={q.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    {/* Header Row */}
                    <div className="bg-zinc-900/60 px-6 py-4 border-b border-zinc-850 flex flex-wrap justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-zinc-500">
                          Q{q.sequence} ({q.topic})
                        </span>
                        <span className="text-[9px] font-bold bg-zinc-850 px-2 py-0.5 rounded text-zinc-400 uppercase">
                          {q.difficulty}
                        </span>
                      </div>
                      {evalItem && (
                        <div className="flex gap-4 text-xs font-semibold text-zinc-400">
                          <span>Accuracy: <strong className="text-white">{evalItem.technicalAccuracy}</strong></span>
                          <span>Clarity: <strong className="text-white">{evalItem.clarity}</strong></span>
                          <span>Completeness: <strong className="text-white">{evalItem.completeness}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Question / Answer / Feedback Content */}
                    <div className="p-6 space-y-5">
                      {/* Text */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Question text</h4>
                        <p className="text-sm font-semibold text-white leading-relaxed">{q.questionText}</p>
                      </div>

                      {/* Candidate Answer */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Candidate Response</h4>
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {q.answer?.answerText || <em className="text-zinc-650">No answer submitted.</em>}
                        </div>
                      </div>

                      {/* AI Evaluation */}
                      {evalItem && (
                        <div className="border-t border-zinc-850 pt-5 space-y-4">
                          {/* Covered vs Missing Concepts */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <span className="font-bold text-emerald-400 block">✓ Covered Concepts</span>
                              <div className="flex flex-wrap gap-1.5">
                                {evalItem.coveredConcepts.length > 0 ? (
                                  evalItem.coveredConcepts.map((c, i) => (
                                    <span key={i} className="bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded text-[10px] text-emerald-300 font-medium">
                                      {c}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-600">None identified.</span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="font-bold text-red-400 block">✗ Missing Concepts</span>
                              <div className="flex flex-wrap gap-1.5">
                                {evalItem.missingConcepts.length > 0 ? (
                                  evalItem.missingConcepts.map((c, i) => (
                                    <span key={i} className="bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded text-[10px] text-red-300 font-medium">
                                      {c}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-600">None identified.</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Evaluation comment */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Evaluator Feedback</h4>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {evalItem.feedback}
                            </p>
                          </div>

                          {/* Action step */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Recommended Practice</h4>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {evalItem.recommendedAction}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
