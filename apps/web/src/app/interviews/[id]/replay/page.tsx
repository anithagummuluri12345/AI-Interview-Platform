'use client';

import React, { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../../components/auth.guard';
import { fetchClient } from '../../../../lib/api.client';

interface Interview {
  id: string;
  title: string;
  targetRole: string;
  companyName: string | null;
  company: string;
  type: string;
  mode: string;
  difficulty: string;
  duration: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  resumeId: string | null;
}

interface InterviewReport {
  overallScore: number;
  technicalScore: number | null;
  problemSolvingScore: number | null;
  communicationScore: number | null;
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string[];
  summary: string | null;
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
    responseDurationSeconds?: number;
    evaluation: QuestionEvaluation | null;
  } | null;
}

interface CodingSubmission {
  id: string;
  language: string;
  sourceCode: string;
  status: string;
  passedTests: number;
  failedTests: number;
  totalTests: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  compilationError: string | null;
  runtimeError: string | null;
  aiReview: {
    score: number;
    technicalAccuracy: number;
    codeQuality: number;
    readability: number;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    summary: string;
    timeComplexity?: string;
    spaceComplexity?: string;
  } | null;
  problem: {
    id: string;
    title: string;
    description: string;
    starterCode: unknown;
    testCases: Array<{
      id: string;
      input: string;
      expectedOutput: string;
      isSample: boolean;
      explanation: string | null;
    }>;
  };
}

interface TimelineDetails {
  title?: string;
  role?: string;
  company?: string;
  difficulty?: string;
  sequence?: number;
  topic?: string;
  questionText?: string;
  answerText?: string;
  durationSeconds?: number;
  technicalAccuracy?: number;
  clarity?: number;
  completeness?: number;
  feedback?: string;
  language?: string;
  passedTests?: number;
  totalTests?: number;
  status?: string;
  overallScore?: number;
  summary?: string | null;
  completedAt?: string | null;
}

interface TimelineEvent {
  type: 'STARTED' | 'QUESTION' | 'ANSWER' | 'EVALUATION' | 'CODE_SUBMISSION' | 'COMPLETED' | 'REPORT';
  label: string;
  timestamp: string;
  status: string;
  details?: TimelineDetails;
}

interface Statistics {
  totalQuestions: number;
  questionsAnswered: number;
  interviewDuration: number;
  averageAnswerTime: number;
  fastestAnswer: number;
  slowestAnswer: number;
  averageTechnicalScore: number;
  averageCommunicationScore: number;
  averageCompleteness: number;
  averageClarity: number;
  overallScore: number;
  passFail: 'PASS' | 'FAIL';
  averageRuntime?: number;
  memoryUsage?: number;
  passedTests?: number;
  failedTests?: number;
}

interface AICoaching {
  strengths: string[];
  weaknesses: string[];
  frequentlyMissedConcepts: string[];
  communicationAdvice: string;
  technicalAdvice: string;
  recommendedLearningTopics: string[];
  suggestedNextInterviewType: string;
  suggestedCompanyToPractice: string;
}

interface ResumeCorrelation {
  resumeSkills: string[];
  evaluatedSkills: string[];
  demonstratedSkills: string[];
  missingSkills: string[];
}

interface ReplayData {
  interview: Interview;
  report: InterviewReport | null;
  questions: Question[];
  codingSubmission: CodingSubmission | null;
  timeline: TimelineEvent[];
  statistics: Statistics;
  aiCoaching: AICoaching;
  resumeCorrelation: ResumeCorrelation | null;
}

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded card tracking states
  const [expandedTimelineNode, setExpandedTimelineNode] = useState<number | null>(null);
  const [expandedQuestionCard, setExpandedQuestionCard] = useState<Record<string, boolean>>({});

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const fetchReplay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}/replay`);
      if (res.ok) {
        const replayPayload = await res.json();
        setData(replayPayload);
      } else {
        const errData = await res.json();
        setError(errData.message || 'Failed to load completed replay data.');
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
        fetchReplay();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchReplay]);

  const scrollToSection = (sectionId: string) => {
    const el = cardRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getEventEmoji = (type: string) => {
    switch (type) {
      case 'STARTED': return '🚀';
      case 'QUESTION': return '❓';
      case 'ANSWER': return '✏️';
      case 'EVALUATION': return '🧠';
      case 'CODE_SUBMISSION': return '💻';
      case 'COMPLETED': return '🏁';
      case 'REPORT': return '📊';
      default: return '📍';
    }
  };



  if (isLoading) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-white mb-4"></div>
          <p className="text-sm text-zinc-400 font-semibold tracking-wide">Loading completed replay details...</p>
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
            <h3 className="text-lg font-bold text-white">Replay Load Failed</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {error || 'This interview is either incomplete or you do not have permission to view it.'}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => fetchReplay()}
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

  const { interview, report, questions, codingSubmission, timeline, statistics, aiCoaching, resumeCorrelation } = data;
  const isCoding = interview.type === 'CODING';

  // Custom SVG line chart renderer for score/dimension trends
  const renderProgressionChart = () => {
    if (isCoding) return null;

    const chartPoints = questions
      .filter(q => q.answer?.evaluation)
      .map((q) => {
        const ev = q.answer!.evaluation!;
        const difficultyValue = q.difficulty === 'EASY' ? 1 : q.difficulty === 'MEDIUM' ? 2 : 3;
        return {
          label: `Q${q.sequence}`,
          technical: ev.technicalAccuracy,
          communication: ev.clarity,
          completeness: ev.completeness,
          difficulty: difficultyValue * 3.3,
        };
      });

    if (chartPoints.length === 0) return null;

    const width = 600;
    const height = 220;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const getX = (index: number) => {
      if (chartPoints.length <= 1) return padding + chartWidth / 2;
      return padding + (index / (chartPoints.length - 1)) * chartWidth;
    };

    const getY = (score: number) => {
      return padding + chartHeight - (score / 10) * chartHeight;
    };

    const technicalPath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.technical)}`).join(' ');
    const communicationPath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.communication)}`).join(' ');
    const difficultyPath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.difficulty)}`).join(' ');

    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Progression Metrics Graph</h3>
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px] h-auto overflow-visible">
            {[0, 2, 4, 6, 8, 10].map((val) => (
              <g key={val}>
                <line
                  x1={padding}
                  y1={getY(val)}
                  x2={width - padding}
                  y2={getY(val)}
                  className="stroke-zinc-800"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text x={padding - 10} y={getY(val) + 4} className="text-[10px] fill-zinc-500 text-right" textAnchor="end">
                  {val}
                </text>
              </g>
            ))}

            {chartPoints.map((p, i) => (
              <text key={i} x={getX(i)} y={height - padding + 18} className="text-[10px] fill-zinc-500" textAnchor="middle">
                {p.label}
              </text>
            ))}

            <path d={technicalPath} fill="none" className="stroke-blue-400" strokeWidth="2.5" strokeLinecap="round" />
            <path d={communicationPath} fill="none" className="stroke-emerald-400" strokeWidth="2.5" strokeLinecap="round" />
            <path d={difficultyPath} fill="none" className="stroke-amber-400" strokeWidth="2" strokeDasharray="3 3" />

            {chartPoints.map((p, i) => (
              <g key={i}>
                <circle cx={getX(i)} cy={getY(p.technical)} r="4" className="fill-zinc-900 stroke-blue-400" strokeWidth="2" />
                <circle cx={getX(i)} cy={getY(p.communication)} r="4" className="fill-zinc-900 stroke-emerald-400" strokeWidth="2" />
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-4 text-[10px] font-semibold tracking-wide justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-400 block"></span>
            <span className="text-zinc-300">Technical Accuracy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400 block"></span>
            <span className="text-zinc-300">Communication & Clarity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400 block"></span>
            <span className="text-zinc-300">Difficulty Progression</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard mode="protected">
      <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 font-sans print:bg-white print:text-black">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 md:px-8 max-w-5xl mx-auto w-full no-print">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <Link href="/dashboard" className="hover:text-white transition">
              ← Dashboard
            </Link>
            <span>/</span>
            {report && (
              <Link href={`/interviews/${id}/report`} className="hover:text-white transition">
                Report Page
              </Link>
            )}
            <span>/</span>
            <span className="text-white">Replay Session</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold border border-zinc-700 hover:border-zinc-650 rounded-lg transition-all flex items-center gap-1.5 shadow-md"
            >
              📥 Download Replay PDF
            </button>
          </div>
        </header>

        {/* Print-Only Header */}
        <div className="hidden print:block max-w-4xl mx-auto text-center border-b border-zinc-350 pb-6 mb-8 text-black bg-white">
          <h1 className="text-3xl font-extrabold">{interview.title}</h1>
          <p className="text-sm mt-1.5 text-zinc-500 font-semibold">
            Mock Interview Evaluation Replay Report • Simulated Target: {interview.targetRole}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-4 text-xs font-semibold text-zinc-600 text-left bg-zinc-50 p-4 border rounded-xl">
            <div><strong>Company:</strong> {interview.company}</div>
            <div><strong>Category:</strong> {interview.type}</div>
            <div><strong>Mode:</strong> {interview.mode}</div>
            <div><strong>Overall Score:</strong> {statistics.overallScore}% ({statistics.passFail})</div>
          </div>
        </div>

        <main className="max-w-5xl w-full mx-auto px-6 md:px-8 mt-8 space-y-8 print:max-w-4xl print:px-0">
          
          {/* Main Stats Grid */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 print:border-zinc-300 print:bg-white print:text-black">
            <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider print:text-zinc-700">Session Summary Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
              
              <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl print:bg-zinc-50 print:border-zinc-300">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Questions</span>
                <span className="text-2xl font-extrabold text-white mt-1 block print:text-black">
                  {statistics.questionsAnswered} / {statistics.totalQuestions}
                </span>
                <p className="text-[9px] text-zinc-450 mt-1 font-semibold">Answered count</p>
              </div>

              <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl print:bg-zinc-50 print:border-zinc-300">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Avg Answer Time</span>
                <span className="text-2xl font-extrabold text-white mt-1 block print:text-black">
                  {statistics.averageAnswerTime}s
                </span>
                <p className="text-[9px] text-zinc-450 mt-1 font-semibold">
                  Min: {statistics.fastestAnswer}s • Max: {statistics.slowestAnswer}s
                </p>
              </div>

              <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl print:bg-zinc-50 print:border-zinc-300">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Technical Score</span>
                <span className="text-2xl font-extrabold text-white mt-1 block print:text-black">
                  {statistics.averageTechnicalScore}/10
                </span>
                <p className="text-[9px] text-zinc-450 mt-1 font-semibold">Technical mastery average</p>
              </div>

              <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl print:bg-zinc-50 print:border-zinc-300">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Overall Rating</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold text-white mt-1 block print:text-black">{statistics.overallScore}%</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                    statistics.passFail === 'PASS' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 print:text-emerald-700' 
                      : 'bg-red-500/10 text-red-400 border-red-500/20 print:text-red-700'
                  }`}>
                    {statistics.passFail}
                  </span>
                </div>
              </div>
            </div>

            {isCoding && codingSubmission && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 border-t border-zinc-800 pt-6 print:border-zinc-300">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Language</span>
                  <span className="text-sm font-bold text-white mt-0.5 block print:text-black">{codingSubmission.language}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Code Runtime</span>
                  <span className="text-sm font-bold text-white mt-0.5 block print:text-black">{codingSubmission.executionTimeMs || 0}ms</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Memory Utilized</span>
                  <span className="text-sm font-bold text-white mt-0.5 block print:text-black">{codingSubmission.memoryUsedKb || 0} KB</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Hidden Tests</span>
                  <span className="text-sm font-bold text-white mt-0.5 block print:text-black">
                    {codingSubmission.passedTests}/{codingSubmission.totalTests} Passed
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Timeline & Replay Panel Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-1 space-y-6 print:hidden">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Interview Event Timeline</h3>
                
                <div className="relative pl-6 border-l border-zinc-800 space-y-5">
                  {timeline.map((event, idx) => {
                    const isExpanded = expandedTimelineNode === idx;
                    const eventTime = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    return (
                      <div key={idx} className="relative group">
                        <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[10px] group-hover:scale-110 transition cursor-pointer">
                          {getEventEmoji(event.type)}
                        </span>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span 
                              onClick={() => {
                                if (event.details?.sequence) {
                                  scrollToSection(`q-card-${event.details.sequence}`);
                                } else {
                                  scrollToSection('summary-section');
                                }
                              }}
                              className="text-xs font-bold text-zinc-200 group-hover:text-white transition cursor-pointer"
                            >
                              {event.label}
                            </span>
                            <span className="text-[9px] text-zinc-555">{eventTime}</span>
                          </div>
                          
                          <button
                            onClick={() => setExpandedTimelineNode(isExpanded ? null : idx)}
                            className="text-[10px] text-zinc-450 hover:text-zinc-200 transition font-semibold"
                          >
                            {isExpanded ? 'Collapse detail' : 'Expand detail'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 bg-zinc-950/60 border border-zinc-850 rounded-lg text-[10px] text-zinc-400 space-y-2 whitespace-pre-wrap leading-relaxed">
                              {event.type === 'STARTED' && (
                                <p>Initialized role profile target role <strong className="text-zinc-200">{event.details?.role}</strong> under difficulty <strong className="text-zinc-200">{event.details?.difficulty}</strong>.</p>
                              )}
                              {event.type === 'QUESTION' && (
                                <p>AI generator created target topic challenge: <br/><em className="text-zinc-300">&ldquo;{event.details?.questionText}&rdquo;</em></p>
                              )}
                              {event.type === 'ANSWER' && (
                                <p>Candidate submitted text solution: <br/>{event.details?.answerText?.slice(0, 150)}...</p>
                              )}
                              {event.type === 'EVALUATION' && (
                                <div>
                                  <p>AI Evaluator graded results:</p>
                                  <div className="mt-1 flex gap-2 font-bold text-zinc-300">
                                    <span>Accuracy: {event.details?.technicalAccuracy}</span>
                                    <span>Clarity: {event.details?.clarity}</span>
                                  </div>
                                </div>
                              )}
                              {event.type === 'CODE_SUBMISSION' && (
                                <p>Compiled code executed in {event.details?.language} status: <strong className="text-zinc-200">{event.details?.status}</strong>.</p>
                              )}
                              {event.type === 'REPORT' && (
                                <p>Report evaluated successfully with overall grade: <strong className="text-zinc-200">{event.details?.overallScore}%</strong>.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8 print:col-span-3">
              {renderProgressionChart()}
              
              {!isCoding && questions.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 print:hidden">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Quick Question Navigation</h3>
                  <div className="flex flex-wrap gap-2">
                    {questions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => scrollToSection(`q-card-${q.sequence}`)}
                        className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-xs font-semibold rounded-lg border border-zinc-800 text-zinc-300 transition-all hover:scale-105"
                      >
                        Q{q.sequence} ({q.topic})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <section className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2 print:text-zinc-700 print:border-zinc-300">Questions Log & Submissions</h3>
                
                {questions.map((q) => {
                  const evalItem = q.answer?.evaluation;
                  const isCardExpanded = expandedQuestionCard[q.id] || false;
                  
                  return (
                    <div
                      key={q.id}
                      ref={(el) => { cardRefs.current[`q-card-${q.sequence}`] = el; }}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:border-zinc-700 transition print:bg-white print:border-zinc-300 print:text-black print:shadow-none"
                    >
                      <div className="bg-zinc-950/40 px-6 py-4 border-b border-zinc-850 flex flex-wrap justify-between items-center gap-4 print:bg-zinc-50 print:border-zinc-300">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-extrabold text-zinc-400 print:text-zinc-600">
                            Question {q.sequence} ({q.topic})
                          </span>
                          <span className="text-[9px] font-bold bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 uppercase print:bg-zinc-200 print:text-zinc-700">
                            {q.difficulty}
                          </span>
                        </div>
                        {evalItem && (
                          <div className="flex gap-4 text-xs font-bold text-zinc-400 print:text-zinc-700">
                            <span>Accuracy: <strong className="text-white print:text-black">{evalItem.technicalAccuracy}</strong></span>
                            <span>Clarity: <strong className="text-white print:text-black">{evalItem.clarity}</strong></span>
                            <span>Completeness: <strong className="text-white print:text-black">{evalItem.completeness}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="p-6 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Question Context</h4>
                          <p className="text-sm font-semibold text-white leading-relaxed print:text-black">{q.questionText}</p>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-bold text-zinc-555 uppercase tracking-wider">Candidate Response</h4>
                          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap print:bg-zinc-50 print:border-zinc-300 print:text-black">
                            {q.answer?.answerText || <em className="text-zinc-650">No answer submitted.</em>}
                          </div>
                        </div>

                        {!isCoding && interview.mode === 'VOICE' && q.answer && (
                          <div className="grid grid-cols-3 gap-4 text-[10px] font-semibold text-zinc-400 bg-zinc-950/40 p-3 rounded-lg border border-zinc-850 print:bg-zinc-50 print:border-zinc-300 print:text-zinc-700">
                            <div>Speaking: <strong className="text-white print:text-black">{q.answer.responseDurationSeconds}s</strong></div>
                            <div>Thinking Time: <strong className="text-white print:text-black">0s</strong></div>
                            <div>Transcript Available: <strong className="text-emerald-400 print:text-emerald-700">Yes</strong></div>
                          </div>
                        )}

                        {evalItem && (
                          <div className="space-y-3">
                            <button
                              onClick={() => setExpandedQuestionCard(prev => ({ ...prev, [q.id]: !isCardExpanded }))}
                              className="text-[10px] text-zinc-400 hover:text-white transition font-bold flex items-center gap-1 mt-1 no-print"
                            >
                              <span>{isCardExpanded ? '▼' : '▶'}</span>
                              {isCardExpanded ? 'Collapse Detailed AI Rubric' : 'Expand Detailed AI Rubric'}
                            </button>

                            <div className={`${isCardExpanded ? 'block' : 'hidden print:block'} border-t border-zinc-850 pt-4 space-y-4 print:border-zinc-300`}>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1">
                                  <span className="font-bold text-emerald-400 print:text-emerald-700 block">✓ Key strengths</span>
                                  <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px] print:text-zinc-600">
                                    {evalItem.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                                  </ul>
                                </div>
                                <div className="space-y-1">
                                  <span className="font-bold text-indigo-400 print:text-indigo-700 block">★ Recommended Action</span>
                                  <p className="text-zinc-400 text-[11px] leading-relaxed print:text-zinc-600">{evalItem.recommendedAction}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t border-zinc-850/60 pt-4 print:border-zinc-300">
                                <div className="space-y-1">
                                  <span className="font-bold text-emerald-400 print:text-emerald-700 block">✓ Demonstrated concepts</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {evalItem.coveredConcepts.length > 0 ? (
                                      evalItem.coveredConcepts.map((c, i) => (
                                        <span key={i} className="bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded text-[10px] text-emerald-300 font-semibold print:bg-emerald-50 print:text-emerald-800 print:border-emerald-200">
                                          {c}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-zinc-655 text-[11px]">None identified.</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <span className="font-bold text-red-400 print:text-red-700 block">✗ Missing concepts</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {evalItem.missingConcepts.length > 0 ? (
                                      evalItem.missingConcepts.map((c, i) => (
                                        <span key={i} className="bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded text-[10px] text-red-300 font-semibold print:bg-red-50 print:text-red-800 print:border-red-200">
                                          {c}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-zinc-655 text-[11px]">None identified.</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1 border-t border-zinc-850/60 pt-4 print:border-zinc-300">
                                <span className="font-bold text-zinc-400 print:text-zinc-600 block">Feedback Details</span>
                                <p className="text-zinc-350 text-xs leading-relaxed print:text-zinc-700">{evalItem.feedback}</p>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              {isCoding && codingSubmission && (
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 print:bg-white print:border-zinc-300 print:text-black">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2 print:text-zinc-700 print:border-zinc-300">Coding challenge Solution</h3>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Problem Statement</h4>
                    <div className="prose prose-invert max-w-none text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-950 p-5 rounded-xl border border-zinc-850 print:bg-zinc-50 print:border-zinc-300 print:text-black">
                      {codingSubmission.problem.description}
                    </div>
                  </div>

                  {(codingSubmission.compilationError || codingSubmission.runtimeError) && (
                    <div className="p-4 bg-red-955/20 border border-red-900/40 rounded-xl text-xs font-mono text-red-400 space-y-2 print:bg-red-50 print:border-red-300 print:text-red-700">
                      <strong className="text-red-350 block">⚠️ Execution Error Output:</strong>
                      <pre className="whitespace-pre-wrap">{codingSubmission.compilationError || codingSubmission.runtimeError}</pre>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Submitted Source Code ({codingSubmission.language})</h4>
                    <pre className="p-5 bg-zinc-950 rounded-xl border border-zinc-850 font-mono text-xs text-zinc-350 overflow-x-auto whitespace-pre leading-relaxed print:bg-zinc-50 print:border-zinc-300 print:text-zinc-800">
                      {codingSubmission.sourceCode}
                    </pre>
                  </div>

                  {codingSubmission.aiReview && (
                    <div className="border-t border-zinc-800 pt-6 space-y-5 print:border-zinc-300">
                      <h4 className="text-xs font-bold text-zinc-550 uppercase tracking-wider print:text-zinc-600">AI Code Review Summary</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="font-bold text-zinc-400 print:text-zinc-650 block mb-1">Time Complexity</span>
                          <span className="font-bold text-white bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-850 block print:bg-zinc-50 print:border-zinc-300 print:text-black">{codingSubmission.aiReview.timeComplexity || 'O(N)'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-zinc-400 print:text-zinc-650 block mb-1">Space Complexity</span>
                          <span className="font-bold text-white bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-850 block print:bg-zinc-50 print:border-zinc-300 print:text-black">{codingSubmission.aiReview.spaceComplexity || 'O(1)'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-emerald-400 print:text-emerald-700 block text-xs">✓ Code Review Strengths</span>
                        <ul className="list-disc list-inside text-xs text-zinc-450 space-y-1 print:text-zinc-600">
                          {codingSubmission.aiReview.strengths.map((str, i) => <li key={i}>{str}</li>)}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-indigo-400 print:text-indigo-700 block text-xs">★ Optimization Suggestions</span>
                        <ul className="list-disc list-inside text-xs text-zinc-450 space-y-1 print:text-zinc-600">
                          {codingSubmission.aiReview.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-zinc-400 print:text-zinc-600 block text-xs">AI Evaluation Summary</span>
                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-4 rounded-xl border border-zinc-850 print:bg-zinc-50 print:border-zinc-300 print:text-zinc-700">
                          {codingSubmission.aiReview.summary}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {resumeCorrelation && (
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 print:bg-white print:border-zinc-300 print:text-black">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2 print:text-zinc-700 print:border-zinc-300">Resume Skill Mapping Alignment</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2">
                      <span className="font-bold text-zinc-400 print:text-zinc-600 block">Demonstrated Skills (Accredited)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {resumeCorrelation.demonstratedSkills.map((s, i) => (
                          <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-bold print:bg-emerald-50 print:border-emerald-300 print:text-emerald-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-zinc-400 print:text-zinc-600 block">Missing or Under-demonstrated Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {resumeCorrelation.missingSkills.length > 0 ? (
                          resumeCorrelation.missingSkills.map((s, i) => (
                            <span key={i} className="bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-[10px] text-red-400 font-bold print:bg-red-50 print:border-red-300 print:text-red-800">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-550">No missing skills. Mastery demonstrated!</span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section 
                ref={(el) => { cardRefs.current['summary-section'] = el; }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 print:bg-white print:border-zinc-300 print:text-black"
              >
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2 print:text-zinc-700 print:border-zinc-300">AI Coaching & Feedback</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                  <div className="space-y-2">
                    <span className="font-bold text-zinc-400 print:text-zinc-600 block uppercase tracking-wider text-[10px]">Technical Advice</span>
                    <p className="text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-850 print:bg-zinc-50 print:border-zinc-300 print:text-zinc-700">{aiCoaching.technicalAdvice}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-zinc-400 print:text-zinc-600 block uppercase tracking-wider text-[10px]">Communication Advice</span>
                    <p className="text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-850 print:bg-zinc-50 print:border-zinc-300 print:text-zinc-700">{aiCoaching.communicationAdvice}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-bold text-zinc-400 print:text-zinc-600 block">Recommended Practice Topics</span>
                  <div className="flex flex-wrap gap-1.5">
                    {aiCoaching.recommendedLearningTopics.map((topic, idx) => (
                      <span key={idx} className="bg-zinc-950 border border-zinc-850 text-zinc-350 px-2.5 py-1 rounded font-bold print:bg-zinc-50 print:border-zinc-300 print:text-black">
                        📚 {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-zinc-400 border-t border-zinc-850 pt-6 print:border-zinc-300 print:text-zinc-600">
                  <div>
                    Next Practice Challenge: <strong className="text-white block mt-0.5 print:text-black">{aiCoaching.suggestedNextInterviewType} Run</strong>
                  </div>
                  <div>
                    Next Target Practice Partner: <strong className="text-white block mt-0.5 print:text-black">🏢 {aiCoaching.suggestedCompanyToPractice} Mock</strong>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
