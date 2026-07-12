'use client';

import React, { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AuthGuard } from '../../../../components/auth.guard';
import { fetchClient, getAccessToken } from '../../../../lib/api.client';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-950 flex items-center justify-center text-xs text-zinc-400 font-medium">
      <div className="h-4 w-4 animate-spin rounded-full border border-zinc-800 border-t-white mr-2"></div>
      Loading Monaco workspace...
    </div>
  ),
});

const MONACO_LANG_MAP: Record<string, string> = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  JAVA: 'java',
  CPP: 'cpp',
  C: 'c',
};

const LOCAL_STARTER_TEMPLATES: Record<string, string> = {
  JAVA: `public class Solution {
    public static void main(String[] args) {
        
    }
}`,
  PYTHON: `class Solution:
    def solve(self):
        pass`,
  JAVASCRIPT: `function solve() {
    
}`,
  CPP: `#include <bits/stdc++.h>
using namespace std;
int main() {
    
}`,
  C: `#include <stdio.h>
int main() {
    
}`
};

interface CodingProblemDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  starterCode: Record<string, string>;
  expectedTimeMins: number;
  tags: string[];
  requiredConcepts: string[];
  hints: string[];
  testCases: { input: string; expectedOutput: string; isSample: boolean; isHidden: boolean; explanation?: string }[];
}

interface Question {
  id: string;
  questionText: string;
  sequence: number;
  topic: string;
  difficulty: string;
  codingProblemId?: string | null;
  codingProblem?: CodingProblemDetails | null;
}

interface AnswerHistory {
  questionId: string;
  questionText: string;
  answerText: string;
  sequence: number;
  topic: string;
}

interface InterviewSessionState {
  interview: {
    id: string;
    title: string;
    targetRole: string;
    mode: string;
    status: string;
    type: string;
    skills: string[];
    company: string;
  };
  currentQuestionIndex: number;
  totalQuestions: number;
  isCompleted: boolean;
  currentQuestion: Question | null;
  history: AnswerHistory[];
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [session, setSession] = useState<InterviewSessionState | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const [sessionRes, interviewRes] = await Promise.all([
        fetchClient(`/api/v1/interviews/${id}/session`),
        fetchClient(`/api/v1/interviews/${id}`),
      ]);

      if (!sessionRes.ok || !interviewRes.ok) {
        throw new Error('Failed to retrieve interview session.');
      }

      const data = await sessionRes.json();
      const interviewData = await interviewRes.json();

      // Ensure type and skills are merged into the session interview object
      data.interview = {
        ...data.interview,
        type: interviewData.type,
        skills: interviewData.skills,
      };

      if (data.interview.status === 'READY') {
        const startRes = await fetchClient(`/api/v1/interviews/${id}/start`, {
          method: 'POST',
        });
        if (!startRes.ok) {
          const errData = await startRes.json();
          throw new Error(errData.message || 'Failed to start interview session.');
        }
        const refreshedRes = await fetchClient(`/api/v1/interviews/${id}/session`);
        const refreshedData = await refreshedRes.json();

        // Re-merge type and skills into refreshed session
        refreshedData.interview = {
          ...refreshedData.interview,
          type: interviewData.type,
          skills: interviewData.skills,
        };

        setSession(refreshedData);
      } else {
        setSession(data);
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'An error occurred while loading the session.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchSession(true);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchSession]);

  const handleSubmitAnswer = async () => {
    if (!session?.currentQuestion || !answerText.trim() || isSubmitting) return;

    if (answerText.trim().length < 5) {
      setError('Please provide a more detailed answer (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetchClient(`/api/v1/interviews/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: session.currentQuestion.id,
          answerText: answerText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to submit answer.');
      }

      setAnswerText('');
      await fetchSession(false);
    } catch (e: unknown) {
      setError((e as Error).message || 'Submission error. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryQuestion = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}/next-question`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to generate next question.');
      }
      await fetchSession(false);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to regenerate question. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!confirm('Are you sure you want to end this interview session early? Your answers so far will be saved.')) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}/complete`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        alert('Failed to complete interview.');
      }
    } catch {
      alert('Error connecting to backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteFinal = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchClient(`/api/v1/interviews/${id}/complete`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        alert('Failed to complete interview.');
      }
    } catch {
      alert('Error connecting to backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-800 border-t-white mb-4"></div>
          <p className="text-sm text-zinc-400 font-semibold tracking-wide">Calibrating interview engine...</p>
        </div>
      </AuthGuard>
    );
  }

  if (error || !session) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center space-y-4">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-lg font-bold text-white">Session Load Failed</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{error || 'Unable to fetch interview configs.'}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Link href="/dashboard" className="px-4 py-2 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition">
                Return to Dashboard
              </Link>
              <button onClick={() => fetchSession(true)} className="px-4 py-2 bg-white text-zinc-900 text-sm font-bold rounded-lg hover:bg-zinc-200 transition">
                Retry
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const { interview, currentQuestion, currentQuestionIndex, totalQuestions, isCompleted } = session;

  // Custom Voice Session handler view
  if (interview.mode === 'VOICE') {
    return (
      <AuthGuard mode="protected">
        <VoiceSessionContainer
          interviewId={interview.id}
          title={interview.title}
          targetRole={interview.targetRole}
          totalQuestions={totalQuestions}
          onFinish={() => router.push('/dashboard')}
        />
      </AuthGuard>
    );
  }

  // Completion view for TEXT/CODING interviews
  const answeredCount = session.history.length;
  const isPendingNextQuestion = !currentQuestion && interview.status === 'IN_PROGRESS' && answeredCount < totalQuestions;
  const limitReached = isCompleted || (!currentQuestion && answeredCount >= totalQuestions);

  if (limitReached) {
    return (
      <AuthGuard mode="protected">
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 animate-fade-in">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center text-3xl">
              🏁
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Interview Complete</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                You have answered all questions. Select &quot;Finalize Session&quot; to compile your performance analytics report.
              </p>
            </div>
            <button
              onClick={handleCompleteFinal}
              disabled={isSubmitting}
              className="w-full py-3 bg-white text-zinc-900 text-sm font-bold rounded-xl hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Finalizing...' : 'Finalize Session'}
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (interview.type === 'CODING') {
    return (
      <AuthGuard mode="protected">
        <CodingInterviewSession
          interview={interview}
          currentQuestion={currentQuestion}
          history={session.history}
          totalQuestions={totalQuestions}
          currentQuestionIndex={currentQuestionIndex}
          onCompleteEarly={handleCompleteEarly}
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard mode="protected">
      <TextInterviewSession
        session={session}
        answerText={answerText}
        setAnswerText={setAnswerText}
        isSubmitting={isSubmitting}
        error={error}
        setError={setError}
        handleSubmitAnswer={handleSubmitAnswer}
        handleCompleteEarly={handleCompleteEarly}
        isPendingNextQuestion={isPendingNextQuestion}
        handleRetryQuestion={handleRetryQuestion}
      />
    </AuthGuard>
  );
}

/* =========================================================================
   TEXT INTERVIEW SESSION COMPONENT
   ========================================================================= */
interface TextInterviewSessionProps {
  session: InterviewSessionState;
  answerText: string;
  setAnswerText: (val: string) => void;
  isSubmitting: boolean;
  error: string | null;
  setError: (val: string | null) => void;
  handleSubmitAnswer: () => void;
  handleCompleteEarly: () => void;
  isPendingNextQuestion: boolean;
  handleRetryQuestion: () => void;
}

function TextInterviewSession({
  session,
  answerText,
  setAnswerText,
  isSubmitting,
  error,
  setError,
  handleSubmitAnswer,
  handleCompleteEarly,
  isPendingNextQuestion,
  handleRetryQuestion,
}: TextInterviewSessionProps) {
  const { interview, currentQuestion, currentQuestionIndex, totalQuestions } = session;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 md:px-8">
        <div>
          <h1 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{interview.title}</h1>
          <p className="text-[10px] text-zinc-550 font-semibold">{interview.targetRole}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
            Question {Math.min(currentQuestionIndex, totalQuestions)} of {totalQuestions}
          </span>
          <button
            onClick={handleCompleteEarly}
            className="text-xs font-semibold text-red-500 hover:text-red-400 transition"
          >
            End Early
          </button>
        </div>
      </header>

      {/* Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between gap-6">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {session.history.map((h) => (
            <div key={h.questionId} className="space-y-3 border-l-2 border-zinc-800 pl-4 py-1">
              <div className="text-xs font-bold text-zinc-555 uppercase tracking-wider">
                Question {h.sequence} ({h.topic})
              </div>
              <p className="text-sm font-medium text-zinc-300">{h.questionText}</p>
              <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded-lg text-xs text-zinc-400 whitespace-pre-wrap">
                {h.answerText}
              </div>
            </div>
          ))}

          {isPendingNextQuestion ? (
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                The previous answer was saved, but the system experienced a timeout generating the next question.
              </p>
              <button
                onClick={handleRetryQuestion}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white text-zinc-900 text-xs font-bold rounded-lg hover:bg-zinc-200 transition"
              >
                {isSubmitting ? 'Generating...' : 'Regenerate Next Question'}
              </button>
            </div>
          ) : (
            currentQuestion && (
              <div className="space-y-4 animate-fade-in">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Active Question ({currentQuestion.topic})
                </div>
                <p className="text-base font-medium text-white leading-relaxed">{currentQuestion.questionText}</p>
              </div>
            )
          )}
        </div>

        {error && (
          <div className="text-xs text-red-500 font-medium px-4 py-2.5 bg-red-950/20 border border-red-900/30 rounded-xl mb-4">
            {error}
          </div>
        )}

        {!isPendingNextQuestion && currentQuestion && (
          <div className="border-t border-zinc-900 pt-4 space-y-3">
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your response here..."
              disabled={isSubmitting}
              className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700 transition resize-none disabled:opacity-50"
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-zinc-650 font-medium">Use Enter for submission</span>
              <button
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !answerText.trim()}
                className="px-5 py-2.5 bg-white text-zinc-900 text-xs font-bold rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* =========================================================================
   CODING INTERVIEW SESSION COMPONENT
   ========================================================================= */
interface CodeExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'TIME_LIMIT_EXCEEDED';
  stdout?: string;
  stderr?: string;
  passedTests: number;
  totalTests: number;
  executionTimeMs?: number;
  memoryUsedKb?: number;
}

interface CodingInterviewSessionProps {
  interview: {
    id: string;
    title: string;
    targetRole: string;
    mode: string;
    status: string;
    type: string;
    skills: string[];
    company: string;
  };
  currentQuestion: Question | null;
  history: AnswerHistory[];
  totalQuestions: number;
  currentQuestionIndex: number;
  onCompleteEarly: () => void;
}

function CodingInterviewSession({
  interview,
  currentQuestion,
  onCompleteEarly,
}: CodingInterviewSessionProps) {
  const router = useRouter();
  const codingProblem = currentQuestion?.codingProblem;

  // Local Preferences Initialization
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`monaco_pref_lang_${interview.id}`);
      if (saved) return saved;
    }

    const searchTargets = [
      ...(interview.skills || []),
      interview.title || '',
      interview.targetRole || '',
    ].map(s => s.toUpperCase());

    const hasJava = searchTargets.some(t => t.includes('JAVA') && !t.includes('JAVASCRIPT'));
    const hasPython = searchTargets.some(t => t.includes('PYTHON') || t.includes('PY'));
    const hasJavaScript = searchTargets.some(t => t.includes('JAVASCRIPT') || t.includes('JS') || t.includes('TYPESCRIPT') || t.includes('TS'));
    const hasCpp = searchTargets.some(t => t.includes('C++') || t.includes('CPP') || t.includes('CPLUSPLUS'));
    const hasC = searchTargets.some(t => t.includes('C') && !t.includes('C++') && !t.includes('CPP') && !t.includes('C#') && !t.includes('CPLUSPLUS') && !t.includes('CSS'));

    if (hasJava) return 'JAVA';
    if (hasPython) return 'PYTHON';
    if (hasJavaScript) return 'JAVASCRIPT';
    if (hasCpp) return 'CPP';
    if (hasC) return 'C';

    return 'JAVA';
  });

  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monaco_pref_theme');
      if (saved) return saved;
    }
    return 'vs-dark';
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monaco_pref_font_size');
      if (saved) return parseInt(saved);
    }
    return 14;
  });

  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monaco_pref_word_wrap');
      if (saved) return saved === 'true';
    }
    return true;
  });

  const [minimap, setMinimap] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monaco_pref_minimap');
      if (saved) return saved === 'true';
    }
    return false;
  });

  // Resizable Panels States
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`monaco_layout_left_width_${interview.id}`);
      return saved ? parseFloat(saved) : 40;
    }
    return 40;
  });

  const [consoleHeight, setConsoleHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`monaco_layout_console_height_${interview.id}`);
      return saved ? parseInt(saved) : 250;
    }
    return 250;
  });

  const [sourceCodes, setSourceCodes] = useState<Record<string, string>>(() => {
    if (!codingProblem) return {};
    const defaultCodes = { ...codingProblem.starterCode };
    const langs = ['JAVASCRIPT', 'PYTHON', 'JAVA', 'CPP', 'C'];
    langs.forEach(lang => {
      if (!defaultCodes[lang]) {
        defaultCodes[lang] = LOCAL_STARTER_TEMPLATES[lang] || '';
      }
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`monaco_draft_${interview.id}_${lang}`);
        if (saved) {
          defaultCodes[lang] = saved;
        }
      }
    });
    return defaultCodes;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<CodeExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'testcases' | 'console' | 'output' | 'details'>('testcases');
  const [selectedSampleCase, setSelectedSampleCase] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingWidth = useRef(false);
  const isDraggingHeight = useRef(false);

  // Toast notifier helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 3500);
  }, []);

  // Save draft
  const handleSaveDraft = useCallback((quiet = false) => {
    if (!codingProblem) return;
    const code = sourceCodes[language] || '';
    localStorage.setItem(`monaco_draft_${interview.id}_${language}`, code);
    setHasUnsavedChanges(false);
    if (!quiet) {
      showToast('Draft saved successfully', 'success');
    }
  }, [interview.id, language, sourceCodes, codingProblem, showToast]);

  // Autosave setup
  useEffect(() => {
    const timer = setInterval(() => {
      handleSaveDraft(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [handleSaveDraft]);

  // Window resize listeners for drag handle splits
  const stopDragWidthRef = useRef<() => void>(() => {});
  const stopDragHeightRef = useRef<() => void>(() => {});

  const handleDragWidth = useCallback((e: MouseEvent) => {
    if (!isDraggingWidth.current) return;
    const percentage = (e.clientX / window.innerWidth) * 100;
    if (percentage >= 25 && percentage <= 70) {
      setLeftWidth(percentage);
      localStorage.setItem(`monaco_layout_left_width_${interview.id}`, percentage.toString());
    }
  }, [interview.id]);

  const stopDragWidth = useCallback(() => {
    isDraggingWidth.current = false;
    document.removeEventListener('mousemove', handleDragWidth);
    document.removeEventListener('mouseup', stopDragWidthRef.current);
  }, [handleDragWidth]);

  useEffect(() => {
    stopDragWidthRef.current = stopDragWidth;
  }, [stopDragWidth]);

  const startDragWidth = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingWidth.current = true;
    document.addEventListener('mousemove', handleDragWidth);
    document.addEventListener('mouseup', stopDragWidthRef.current);
  }, [handleDragWidth]);

  const handleDragHeight = useCallback((e: MouseEvent) => {
    if (!isDraggingHeight.current) return;
    const height = window.innerHeight - e.clientY;
    if (height >= 100 && height <= 600) {
      setConsoleHeight(height);
      localStorage.setItem(`monaco_layout_console_height_${interview.id}`, height.toString());
    }
  }, [interview.id]);

  const stopDragHeight = useCallback(() => {
    isDraggingHeight.current = false;
    document.removeEventListener('mousemove', handleDragHeight);
    document.removeEventListener('mouseup', stopDragHeightRef.current);
  }, [handleDragHeight]);

  useEffect(() => {
    stopDragHeightRef.current = stopDragHeight;
  }, [stopDragHeight]);

  const startDragHeight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHeight.current = true;
    document.addEventListener('mousemove', handleDragHeight);
    document.addEventListener('mouseup', stopDragHeightRef.current);
  }, [handleDragHeight]);

  const handleEditorDidMount = (editor: any, monaco: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const handleFormatDocument = () => {
    if (editorRef.current) {
      editorRef.current.trigger('editor-toolbar', 'editor.action.formatDocument', null);
      showToast('Document formatted', 'success');
    }
  };

  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {
        showToast('Fullscreen mode blocked by browser preferences', 'error');
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, [showToast]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleResetCode = () => {
    if (!codingProblem) return;
    if (window.confirm('Are you sure you want to reset the editor to the default starter template? This will erase your current modifications.')) {
      const defaultNewCode = codingProblem.starterCode[language] || LOCAL_STARTER_TEMPLATES[language] || '';
      setSourceCodes(prev => ({
        ...prev,
        [language]: defaultNewCode,
      }));
      if (editorRef.current) {
        editorRef.current.setValue(defaultNewCode);
      }
      setHasUnsavedChanges(true);
      showToast('Starter template restored', 'info');
    }
  };

  const handleCopyCode = () => {
    const code = sourceCodes[language] || '';
    navigator.clipboard.writeText(code).then(() => {
      showToast('Code copied to clipboard', 'success');
    }).catch(() => {
      showToast('Copy to clipboard failed', 'error');
    });
  };

  const handleDownloadCode = () => {
    const code = sourceCodes[language] || '';
    const extMap: Record<string, string> = {
      JAVASCRIPT: 'js',
      TYPESCRIPT: 'ts',
      PYTHON: 'py',
      JAVA: 'java',
      CPP: 'cpp',
      C: 'c',
    };
    const ext = extMap[language] || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solution.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Code downloaded successfully', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text !== undefined) {
        setSourceCodes(prev => ({
          ...prev,
          [language]: text,
        }));
        setHasUnsavedChanges(true);
        showToast(`Uploaded file: ${file.name}`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    if (newLang === language) return;

    const currentCode = sourceCodes[language] || '';
    const templateCode = codingProblem?.starterCode[language] || LOCAL_STARTER_TEMPLATES[language] || '';
    const isModified = currentCode.trim() !== templateCode.trim();

    if (isModified) {
      const ok = window.confirm("Changing language will replace your current code.\n\nContinue?");
      if (!ok) return;
    }

    setLanguage(newLang);
    localStorage.setItem(`monaco_pref_lang_${interview.id}`, newLang);

    const defaultNewCode = sourceCodes[newLang] || codingProblem?.starterCode?.[newLang] || LOCAL_STARTER_TEMPLATES[newLang] || '';
    setSourceCodes(prev => ({
      ...prev,
      [newLang]: defaultNewCode,
    }));
    localStorage.setItem(`monaco_draft_${interview.id}_${newLang}`, defaultNewCode);
    setHasUnsavedChanges(false);

    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        model.setValue(defaultNewCode);
        if (monacoRef.current) {
          monacoRef.current.editor.setModelLanguage(model, MONACO_LANG_MAP[newLang]);
        }
      }
    }

    showToast(`Loaded ${newLang.toLowerCase()} starter template`, 'info');
  };

  const handleRunCode = useCallback(async () => {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setRunResult(null);
    setError(null);
    setActiveTab('output');
    showToast('Compiling sandbox environment...', 'info');

    try {
      const code = sourceCodes[language] || '';
      if (!code.trim()) {
        throw new Error('Code content cannot be empty.');
      }

      const res = await fetchClient(`/api/v1/interviews/${interview.id}/run`, {
        method: 'POST',
        body: JSON.stringify({
          language,
          sourceCode: code,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Execution error.');
      }

      const data = await res.json();
      setRunResult(data);
      setActiveTab('details');
      if (data.status === 'ACCEPTED') {
        showToast('Code execution successful', 'success');
      } else {
        showToast(`Execution completed with status: ${data.status}`, 'error');
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Run request failed.');
      setActiveTab('output');
    } finally {
      setIsRunning(false);
    }
  }, [interview.id, language, sourceCodes, isRunning, isSubmitting, showToast]);

  const handleSubmitSolution = useCallback(async () => {
    if (isRunning || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setStatusMessage('Running Hidden Tests...');
    setActiveTab('output');

    try {
      const code = sourceCodes[language] || '';
      if (!code.trim()) {
        throw new Error('Code content cannot be empty.');
      }

      setTimeout(() => setStatusMessage('Evaluating...'), 1500);
      setTimeout(() => setStatusMessage('Generating AI Review...'), 3500);
      setTimeout(() => setStatusMessage('Submitting...'), 5500);

      const res = await fetchClient(`/api/v1/interviews/${interview.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          language,
          sourceCode: code,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Submit error.');
      }

      showToast('Solution submitted successfully', 'success');
      router.push(`/interviews/${interview.id}/report`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Submit request failed.');
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  }, [interview.id, language, sourceCodes, isRunning, isSubmitting, router, showToast]);

  // Keyboard Shortcuts Bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        handleFullscreenToggle();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleRunCode();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitSolution();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [language, sourceCodes, isRunning, isSubmitting, handleSaveDraft, handleFullscreenToggle, handleRunCode, handleSubmitSolution]);

  if (!codingProblem) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center space-y-4">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-lg font-bold text-white">Starter Code Missing</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The coding template context could not be retrieved from the server.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/dashboard" className="px-4 py-2 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sampleCases = codingProblem.testCases ? codingProblem.testCases.filter(t => t.isSample) : [];

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none relative">
      {/* Toast Alert Popups */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-xl animate-fade-in ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-400 border-emerald-900/50'
            : toast.type === 'error'
            ? 'bg-red-955/90 text-red-400 border-red-900/50'
            : 'bg-indigo-950/90 text-indigo-400 border-indigo-900/50'
        }`}>
          <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Shortcuts modal dialog */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4 animate-scale-in text-zinc-200">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Keyboard Shortcuts Reference</h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-zinc-850 pb-2">
                <span>Run Code</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">Ctrl + Enter</kbd>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-2">
                <span>Submit Solution</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">Ctrl + Shift + Enter</kbd>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-2">
                <span>Save Draft</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-2">
                <span>Toggle Comment</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">Ctrl + /</kbd>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-2">
                <span>Toggle Fullscreen</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">F11</kbd>
              </div>
              <div className="flex justify-between">
                <span>Format Code Document</span>
                <kbd className="bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-mono">Alt + Shift + F</kbd>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="px-4 py-2 bg-white text-zinc-900 text-xs font-bold rounded-lg hover:bg-zinc-200 transition"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 md:px-8 shrink-0 no-print">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{interview.title}</h1>
            <p className="text-[10px] text-zinc-550 font-semibold">{interview.targetRole} • Premium Coding Workspace</p>
          </div>
          {interview.company && interview.company !== 'GENERIC' && (
            <span className="bg-indigo-950/40 border border-indigo-900/30 px-2.5 py-0.5 rounded text-[9px] text-indigo-400 font-bold uppercase tracking-wider">
              🏢 {interview.company} Style
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1 animate-pulse">
              <span>●</span> Unsaved Changes
            </span>
          )}
          <button
            onClick={onCompleteEarly}
            disabled={isSubmitting}
            className="text-xs font-semibold text-red-500 hover:text-red-400 transition disabled:opacity-50"
          >
            End Early
          </button>
        </div>
      </header>

      {/* Resizable Splits Container */}
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left Side: Coding Challenge Description Panel */}
        <div
          style={{ width: `${leftWidth}%` }}
          className="overflow-y-auto border-r border-zinc-850 space-y-6 flex flex-col p-6 shrink-0 bg-zinc-950/40 select-text"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] tracking-widest font-extrabold text-zinc-500 uppercase">
              Coding Challenge Description
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
              codingProblem.difficulty === 'EASY'
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                : codingProblem.difficulty === 'MEDIUM'
                ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                : 'bg-rose-950/40 text-rose-400 border border-rose-900/30'
            }`}>
              {codingProblem.difficulty}
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">{codingProblem.title}</h2>
            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500 font-semibold pt-1">
              <span>Expected Time: <strong className="text-zinc-300">{codingProblem.expectedTimeMins} mins</strong></span>
              <span>•</span>
              <span>Skills: <strong className="text-zinc-300">{interview.skills.join(', ')}</strong></span>
            </div>
          </div>

          {/* Render description pre-wrap style */}
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans bg-zinc-900/5 p-4 rounded-xl border border-zinc-900">
            {codingProblem.description}
          </div>

          {/* Tags */}
          {codingProblem.tags && codingProblem.tags.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Assessed Skills / Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {codingProblem.tags.map((t, idx) => (
                  <span key={idx} className="bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-semibold font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Constraints */}
          {codingProblem.constraints && codingProblem.constraints.length > 0 && (
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Constraints</h3>
              <ul className="list-disc pl-5 text-xs text-zinc-450 space-y-1 leading-relaxed">
                {codingProblem.constraints.map((c: string, idx: number) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {codingProblem.examples && codingProblem.examples.length > 0 && (
            <div className="space-y-4 border-t border-zinc-900 pt-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Examples</h3>
              {codingProblem.examples.map((ex, idx) => (
                <div key={idx} className="bg-zinc-900/30 border border-zinc-850 p-4 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-zinc-300">Example {idx + 1}</div>
                  <div className="font-mono text-xs space-y-1 leading-relaxed">
                    <div><span className="text-zinc-550">Input:</span> {ex.input}</div>
                    <div><span className="text-zinc-550">Output:</span> {ex.output}</div>
                  </div>
                  {ex.explanation && (
                    <p className="text-[11px] text-zinc-500 leading-relaxed italic">{ex.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Resizer divider bar handle */}
        <div
          onMouseDown={startDragWidth}
          className="w-1.5 hover:w-2 bg-zinc-900 hover:bg-indigo-650 cursor-col-resize hover:shadow-[0_0_8px_rgba(79,70,229,0.5)] transition-all flex items-center justify-center shrink-0 border-r border-l border-zinc-850/60 active:bg-indigo-750"
          role="separator"
          aria-label="Resize panels"
        >
          <div className="w-[1px] h-8 bg-zinc-800"></div>
        </div>

        {/* Right Side Column (Monaco Workspace + Console output panels) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900/10">
          
          {/* Editor Header controls and Preferences toolbar */}
          <div className="h-14 border-b border-zinc-850 flex items-center justify-between px-6 bg-zinc-900/40 shrink-0 select-none">
            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="lang-select" className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider">Lang:</label>
                <select
                  id="lang-select"
                  value={language}
                  onChange={handleLanguageChange}
                  disabled={isSubmitting}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-lg text-xs font-bold px-3 py-1.5 focus:outline-none transition text-zinc-200 disabled:opacity-50"
                >
                  <option value="JAVA">Java</option>
                  <option value="CPP">C++</option>
                  <option value="C">C</option>
                  <option value="PYTHON">Python</option>
                  <option value="JAVASCRIPT">JavaScript</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="theme-select" className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider">Theme:</label>
                <select
                  id="theme-select"
                  value={theme}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setTheme(e.target.value);
                    localStorage.setItem('monaco_pref_theme', e.target.value);
                    showToast('Theme updated', 'info');
                  }}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-lg text-xs font-bold px-3 py-1.5 focus:outline-none transition text-zinc-200 disabled:opacity-50"
                >
                  <option value="vs-dark">VS Dark</option>
                  <option value="light">VS Light</option>
                  <option value="hc-black">High Contrast</option>
                </select>
              </div>

              {/* Font Size Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="font-select" className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider">Size:</label>
                <select
                  id="font-select"
                  value={fontSize}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const size = parseInt(e.target.value);
                    setFontSize(size);
                    localStorage.setItem('monaco_pref_font_size', size.toString());
                  }}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-lg text-xs font-bold px-2 py-1.5 focus:outline-none transition text-zinc-200 disabled:opacity-50"
                >
                  <option value="12">12px</option>
                  <option value="14">14px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                  <option value="20">20px</option>
                </select>
              </div>
            </div>

            {/* Toolbar buttons */}
            <div className="flex items-center gap-1.5">
              {/* Minimap toggle */}
              <button
                onClick={() => {
                  setMinimap(prev => {
                    localStorage.setItem('monaco_pref_minimap', (!prev).toString());
                    return !prev;
                  });
                }}
                disabled={isSubmitting}
                className={`p-2 rounded-lg border text-xs font-bold transition disabled:opacity-50 ${
                  minimap 
                    ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30' 
                    : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
                }`}
                title="Toggle Minimap"
              >
                🗺️
              </button>

              {/* Word wrap toggle */}
              <button
                onClick={() => {
                  setWordWrap(prev => {
                    localStorage.setItem('monaco_pref_word_wrap', (!prev).toString());
                    return !prev;
                  });
                }}
                disabled={isSubmitting}
                className={`p-2 rounded-lg border text-xs font-bold transition disabled:opacity-50 ${
                  wordWrap 
                    ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30' 
                    : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
                }`}
                title="Toggle Word Wrap"
              >
                WRAP
              </button>

              {/* Format code document */}
              <button
                onClick={handleFormatDocument}
                disabled={isSubmitting}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition disabled:opacity-50"
                title="Format Document (Alt+Shift+F)"
              >
                ✨ Format
              </button>

              {/* Reset code */}
              <button
                onClick={handleResetCode}
                disabled={isSubmitting}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition disabled:opacity-50"
                title="Reset Code Template"
              >
                ↩ Reset
              </button>

              {/* Copy code */}
              <button
                onClick={handleCopyCode}
                disabled={isSubmitting}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition disabled:opacity-50"
                title="Copy solution to clipboard"
              >
                📋 Copy
              </button>

              {/* Download code */}
              <button
                onClick={handleDownloadCode}
                disabled={isSubmitting}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition disabled:opacity-50"
                title="Download solution file"
              >
                📥 Download
              </button>

              {/* Upload local file */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".js,.ts,.py,.java,.cpp,.c,.txt"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition disabled:opacity-50"
                title="Upload local file content"
              >
                📤 Upload
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={handleFullscreenToggle}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition"
                title="Toggle Fullscreen View (F11)"
              >
                {isFullscreen ? '🔍 Exit FS' : '🔍 Fullscreen'}
              </button>

              {/* Keyboard Shortcuts Dialog Trigger */}
              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="p-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition"
                title="Keyboard Shortcuts Guide"
              >
                ❓ Keys
              </button>
            </div>
          </div>

          {/* Monaco Editor Wrapper */}
          <div className="flex-1 relative overflow-hidden bg-zinc-950 select-text">
            {Object.keys(sourceCodes).length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-zinc-500 bg-zinc-950 font-medium">
                <div className="h-4 w-4 animate-spin rounded-full border border-zinc-850 border-t-white mb-2"></div>
                Initializing IDE templates...
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language={MONACO_LANG_MAP[language]}
                theme={theme}
                value={sourceCodes[language] || ''}
                onMount={handleEditorDidMount}
                onChange={(val) => {
                  setSourceCodes((prev) => ({
                    ...prev,
                    [language]: val || '',
                  }));
                  setHasUnsavedChanges(true);
                }}
                options={{
                  fontSize: fontSize,
                  fontFamily: 'Fira Code, Menlo, Monaco, monospace',
                  minimap: { enabled: minimap },
                  wordWrap: wordWrap ? 'on' : 'off',
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  tabSize: 2,
                  automaticLayout: true,
                  matchBrackets: 'always',
                  autoClosingBrackets: 'always',
                  autoClosingQuotes: 'always',
                  folding: true,
                  contextmenu: true,
                  autoIndent: 'advanced',
                  smoothScrolling: true,
                  stickyScroll: { enabled: true },
                  renderLineHighlight: 'all',
                  guides: { indentation: true },
                  readOnly: isSubmitting,
                }}
              />
            )}
          </div>

          {/* Horizontal Resizer divider bar handle */}
          <div
            onMouseDown={startDragHeight}
            className="h-1.5 hover:h-2 bg-zinc-900 hover:bg-indigo-650 cursor-row-resize hover:shadow-[0_0_8px_rgba(79,70,229,0.5)] transition-all flex items-center justify-center shrink-0 border-t border-b border-zinc-850/60 active:bg-indigo-750"
            role="separator"
            aria-label="Resize console"
          >
            <div className="h-[1px] w-8 bg-zinc-800"></div>
          </div>

          {/* Bottom Console Drawer */}
          <div style={{ height: `${consoleHeight}px` }} className="bg-zinc-955 flex flex-col shrink-0 overflow-hidden">
            {/* Drawer Tabs Header */}
            <div className="h-10 border-b border-zinc-850 px-6 flex items-center justify-between bg-zinc-900/30 shrink-0">
              <div className="flex gap-4 text-xs font-bold select-none">
                <button
                  onClick={() => setActiveTab('testcases')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'testcases' ? 'border-indigo-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sample Tests
                </button>
                <button
                  onClick={() => setActiveTab('console')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'console' ? 'border-indigo-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Stdout Logs
                </button>
                <button
                  onClick={() => setActiveTab('output')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'output' ? 'border-indigo-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Compiler / Errors
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === 'details' ? 'border-indigo-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Execution details
                </button>
              </div>

              {/* Submit / Run Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="px-3.5 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-extrabold uppercase text-zinc-300 rounded hover:text-white transition disabled:opacity-50"
                  title="Run code against sample test cases (Ctrl + Enter)"
                >
                  {isRunning ? 'Running...' : '▶ Run Code'}
                </button>
                <button
                  onClick={handleSubmitSolution}
                  disabled={isRunning || isSubmitting}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-[10px] font-extrabold uppercase text-zinc-900 rounded transition disabled:opacity-50"
                  title="Submit code for AI report grading (Ctrl + Shift + Enter)"
                >
                  {isSubmitting ? 'Submitting...' : '✓ Submit'}
                </button>
              </div>
            </div>

            {/* Tabbed view content */}
            <div className="flex-1 p-5 font-mono text-xs overflow-y-auto leading-relaxed text-zinc-400 select-text">
              
              {/* Submission processing loader */}
              {isSubmitting && activeTab === 'output' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800/80 border-t-white"></div>
                  <div className="text-[11px] text-zinc-300 font-bold tracking-wide animate-pulse">{statusMessage}</div>
                </div>
              )}

              {/* Run compilation loader */}
              {isRunning && activeTab === 'output' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800/80 border-t-white"></div>
                  <div className="text-[11px] text-zinc-400">Compiling sandbox code executions...</div>
                </div>
              )}

              {/* Sample Test cases Tab */}
              {activeTab === 'testcases' && (
                <div className="space-y-4 font-sans">
                  <div className="flex flex-wrap gap-2">
                    {sampleCases.map((tc, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSampleCase(idx)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          selectedSampleCase === idx
                            ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30'
                            : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {sampleCases[selectedSampleCase] && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Test Case Input:</span>
                        <pre className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 font-mono text-xs text-zinc-300 overflow-x-auto">
                          {sampleCases[selectedSampleCase].input}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Expected Output:</span>
                        <pre className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 font-mono text-xs text-zinc-300 overflow-x-auto">
                          {sampleCases[selectedSampleCase].expectedOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Console stdout Logs Tab */}
              {activeTab === 'console' && (
                <div>
                  {runResult?.stdout ? (
                    <pre className="p-4 bg-zinc-950 rounded-lg border border-zinc-900 text-zinc-300 overflow-x-auto leading-relaxed">{runResult.stdout}</pre>
                  ) : (
                    <div className="text-zinc-650 italic text-center pt-8">No standard output logs captured.</div>
                  )}
                </div>
              )}

              {/* Output Tab */}
              {activeTab === 'output' && !isRunning && !isSubmitting && (
                <div>
                  {error && (
                    <div className="text-red-500 whitespace-pre-wrap bg-red-950/10 border border-red-900/20 p-4 rounded-xl">
                      Execution Error details: {error}
                    </div>
                  )}
                  {runResult?.stderr ? (
                    <div className="space-y-2">
                      <span className="text-red-400 font-bold block uppercase text-[10px]">Standard Error details:</span>
                      <pre className="p-4 bg-red-950/10 border border-red-900/20 text-rose-300 rounded-lg overflow-x-auto leading-relaxed">{runResult.stderr}</pre>
                    </div>
                  ) : (
                    !error && (
                      <div className="text-zinc-650 italic text-center pt-8">Run your code to execute sandbox test runs.</div>
                    )
                  )}
                </div>
              )}

              {/* Execution Details Tab */}
              {activeTab === 'details' && (
                <div>
                  {runResult ? (
                    <div className="space-y-4 font-sans text-zinc-300">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-900">
                          <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Status</span>
                          <span className={`text-xs font-bold inline-block mt-1 px-2 py-0.5 rounded ${
                            runResult.status === 'ACCEPTED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {runResult.status}
                          </span>
                        </div>
                        <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-900">
                          <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Passed Cases</span>
                          <span className="text-sm font-bold block mt-1">
                            {runResult.passedTests} / {runResult.totalTests} Passed
                          </span>
                        </div>
                        <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-900">
                          <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Runtime</span>
                          <span className="text-sm font-bold block mt-1">
                            {runResult.executionTimeMs !== undefined ? `${runResult.executionTimeMs} ms` : 'N/A'}
                          </span>
                        </div>
                        <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-900">
                          <span className="text-[9px] uppercase font-bold text-zinc-550 block font-mono">Memory</span>
                          <span className="text-sm font-bold block mt-1">
                            {runResult.memoryUsedKb !== undefined ? `${runResult.memoryUsedKb} KB` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {runResult.status !== 'ACCEPTED' && (
                        <div className="p-4 bg-red-950/15 border border-red-900/30 rounded-xl text-xs font-mono text-red-400">
                          <strong>Execution failed.</strong> Please review compiler log reports under Standard Error.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-zinc-650 italic text-center pt-8">No runs completed in this workspace yet.</div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface VoiceSessionProps {
  interviewId: string;
  title: string;
  targetRole: string;
  totalQuestions: number;
  onFinish: () => void;
}

type VoiceState = 'AI_SPEAKING' | 'CANDIDATE_SPEAKING' | 'FINALIZING_ANSWER' | 'WAITING_FOR_AI' | 'SESSION_COMPLETE';

function VoiceSessionContainer({ interviewId, title, targetRole, totalQuestions, onFinish }: VoiceSessionProps) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [micState, setMicState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isModelActive, setIsModelActive] = useState(false);
  const [transcripts, setTranscripts] = useState<Array<{ sender: 'user' | 'model'; text: string }>>([]);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [completedTurns, setCompletedTurns] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>('WAITING_FOR_AI');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const speechRecognitionRef = useRef<unknown>(null);
  const modelResponseBufferRef = useRef<string>('');

  const voiceStateRef = useRef<VoiceState>('WAITING_FOR_AI');
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const initializationStartedRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isModelActiveRef = useRef(isModelActive);
  useEffect(() => {
    isModelActiveRef.current = isModelActive;
  }, [isModelActive]);

  // Start Gemini Audio Playback
  const playModelAudio = useCallback((base64: string) => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now;
    }
    console.log('[VoiceClient] Playing model audio');
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;

    activeSourcesRef.current.push(source);
  }, []);

  const stopModelPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

  // Glowing Circle Waveform rendering loop
  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current || !audioContextRef.current) return () => {};
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    canvas.width = canvas.offsetWidth || 176;
    canvas.height = canvas.offsetHeight || 176;

    const width = canvas.width;
    const height = canvas.height;
    
    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = isModelActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const time = Date.now() * 0.005;
      const points = 60;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 70;

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noise = Math.sin(angle * 8 + time) * (isModelActive ? 8 : 2);
        const r = baseRadius + noise;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isModelActive]);

  useEffect(() => {
    const cleanup = drawVisualizer();
    return () => {
      if (cleanup) cleanup();
    };
  }, [drawVisualizer]);

  // Initialize Speech Capture and WebSockets Bridge exactly ONCE
  useEffect(() => {
    if (initializationStartedRef.current) {
      console.log('[VoiceClient] Initialization already started. Skipping duplicate.');
      return;
    }
    initializationStartedRef.current = true;
    console.log('[VoiceClient] Voice initialization started ONCE');

    let micStream: MediaStream | null = null;

    const initVoiceSession = async () => {
      setErrorText(null);
      try {
        console.log('[VoiceClient] Initializing voice session. Querying getAccessToken...');
        const testRes = await fetchClient(`/api/v1/interviews/${interviewId}/session`);
        if (!testRes.ok) {
          console.log('[VoiceClient] Failed to refresh credentials via fetchClient');
          throw new Error('Failed to refresh credentials. Please log in.');
        }

        const token = getAccessToken();
        if (!token) {
          console.log('[VoiceClient] Token is empty in memory.');
          throw new Error('User session expired. Please log in.');
        }
        console.log('[VoiceClient] Access token retrieved');

        console.log('[VoiceClient] Requesting mic permission...');
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = micStream;
          setMicState('granted');
          console.log('[VoiceClient] Microphone permission granted');
        } catch {
          setMicState('denied');
          throw new Error('Microphone permission denied or unavailable.');
        }

        if (!isMountedRef.current) {
          console.log('[VoiceClient] Component unmounted before mic stream store.');
          return;
        }

        console.log('[VoiceClient] CHECKPOINT A: microphone stream stored');

        try {
          console.log('[VoiceClient] CHECKPOINT B: preparing WebSocket URL');
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          const wsBase = apiBaseUrl.replace(/^http/, 'ws');
          const wsBaseClean = wsBase.replace(/\/+$/, '');
          const wsUrl = `${wsBaseClean}/api/v1/interviews/voice?token=${encodeURIComponent(token)}&interviewId=${encodeURIComponent(interviewId)}`;
          console.log('[VoiceClient] CHECKPOINT C: WebSocket URL created');

          if (
            socketRef.current &&
            (socketRef.current.readyState === WebSocket.CONNECTING ||
             socketRef.current.readyState === WebSocket.OPEN)
          ) {
            console.log('[VoiceClient] WebSocket already connecting or open. Skipping duplicate creation.');
            return;
          }

          console.log('[VoiceClient] CHECKPOINT D: constructing WebSocket');
          console.log('[VoiceClient] Creating WebSocket:', wsUrl);
          const socket = new WebSocket(wsUrl);
          socketRef.current = socket;
          setWs(socket);
          console.log('[VoiceClient] WebSocket CONNECTING');

          socket.onopen = () => {
            console.log('[VoiceClient] WebSocket OPEN');
            setIsConnected(true);
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const context = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = context;

            const mediaSrc = context.createMediaStreamSource(micStream!);
            const processor = context.createScriptProcessor(2048, 1, 1);
            audioProcessorRef.current = processor;

            let processCount = 0;
            processor.onaudioprocess = (e) => {
              if (voiceStateRef.current !== 'CANDIDATE_SPEAKING' || isMutedRef.current || socket.readyState !== WebSocket.OPEN) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }

              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
              const bytesLen = pcm.buffer.byteLength;

              processCount++;
              if (processCount % 50 === 0) {
                console.log(`[VoiceClient] Captured audio chunk: bytes=${bytesLen}`);
              }

              socket.send(
                JSON.stringify({
                  event: 'realtimeInput',
                  data: {
                    mediaChunks: [{ mimeType: 'audio/pcm', data: base64 }],
                  },
                })
              );

              if (processCount % 50 === 0) {
                console.log(`[VoiceClient] Sent audio chunk to backend: bytes=${bytesLen}`);
              }
            };

            mediaSrc.connect(processor);
            processor.connect(context.destination);
          };

          socket.onmessage = (event) => {
            try {
              const raw = JSON.parse(event.data) as {
                event?: string;
                serverContent?: {
                  modelTurn?: {
                    parts?: Array<{
                      text?: string;
                      inlineData?: {
                        mimeType: string;
                        data: string;
                      };
                    }>;
                  };
                  turnComplete?: boolean;
                };
              };
              
              if (raw.event === 'ready') {
                console.log('[VoiceClient] WebSocket OPEN');
                return;
              }

              if (raw.serverContent) {
                const { modelTurn, turnComplete } = raw.serverContent;
                if (modelTurn && modelTurn.parts) {
                  setIsModelActive(true);
                  setVoiceState('AI_SPEAKING');
                  modelTurn.parts.forEach((p) => {
                    if (p.text) {
                      const textVal = p.text;
                      modelResponseBufferRef.current += textVal;
                      setTranscripts((prev) => {
                        const last = prev[prev.length - 1];
                        if (last && last.sender === 'model') {
                          return [...prev.slice(0, -1), { sender: 'model', text: last.text + textVal }];
                        }
                        return [...prev, { sender: 'model', text: textVal }];
                      });
                    }
                    if (p.inlineData && p.inlineData.data) {
                      const audioBase64 = p.inlineData.data;
                      const byteLength = atob(audioBase64).length;
                      console.log(`[VoiceClient] Model audio received: bytes=${byteLength}`);
                      console.log(`[VoiceClient] Queued model audio for playback`);
                      playModelAudio(audioBase64);
                    }
                  });
                }
                if (turnComplete) {
                  setIsModelActive(false);
                  setVoiceState('CANDIDATE_SPEAKING');
                }
              }
            } catch {
              // ignore
            }
          };

          socket.onerror = (errEvent) => {
            console.log('[VoiceClient] WebSocket ERROR:', errEvent);
            setErrorText('WebSocket server connection failure.');
          };

          socket.onclose = (event) => {
            console.log(`[VoiceClient] WebSocket CLOSED: code=${event.code} reason=${event.reason || 'none'}`);
            setIsConnected(false);
            if (event.code === 4001 || event.code === 4003) {
              setErrorText('Handshake authorization failed.');
            }
          };

          const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const rec = new (SpeechRecognition as new () => {
              continuous: boolean;
              interimResults: boolean;
              onspeechstart: () => void;
              onresult: (e: unknown) => void;
              start: () => void;
              stop: () => void;
            })();
            rec.continuous = true;
            rec.interimResults = true;

            rec.onspeechstart = () => {
              if (isModelActiveRef.current) {
                stopModelPlayback();
                setIsModelActive(false);
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(
                    JSON.stringify({
                      event: 'clientContent',
                      data: { turnComplete: false },
                    })
                  );
                }
              }
            };

            rec.onresult = (e: unknown) => {
              const ev = e as {
                resultIndex: number;
                results: Array<{
                  isFinal: boolean;
                  [key: number]: { transcript: string };
                }> & { length: number };
              };
              let chunk = '';
              for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                if (ev.results[i].isFinal) {
                  chunk += ev.results[i][0].transcript;
                }
              }
              if (chunk) {
                setCurrentSpeech((prev) => prev + ' ' + chunk);
              }
            };

            rec.start();
            speechRecognitionRef.current = rec;
          }
        } catch (postMicErr: unknown) {
          console.log('[VoiceClient] POST-MIC SETUP ERROR:', postMicErr);
          setErrorText('Failed to initialize WebSocket audio gateway.');
        }

      } catch (err: unknown) {
        setErrorText((err as Error).message || 'Failed to initiate Voice session.');
      }
    };

    initVoiceSession();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
      }
      const rec = speechRecognitionRef.current as { stop: () => void } | null;
      if (rec) {
        rec.stop();
      }
      activeSourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {
          // ignore
        }
      });
    };
  }, [interviewId, playModelAudio, stopModelPlayback]);

  // Submit Spoken Answer Turn
  const handleNextTurn = () => {
    if (voiceState !== 'CANDIDATE_SPEAKING' || !isConnected || !ws || currentSpeech.trim().length === 0) return;

    console.log('[VoiceClient] Send Answer clicked');
    const answer = currentSpeech.trim();
    console.log(`[VoiceClient] Final transcript: ${answer.length}`);

    setVoiceState('FINALIZING_ANSWER');

    const saveTurnPayload = {
      questionText: modelResponseBufferRef.current || 'How would you proceed?',
      answerText: answer,
      interviewId,
    };
    console.log('[VoiceClient] Emitting event: saveTurn');
    console.log('[VoiceClient] Turn-finalization payload shape:', Object.keys(saveTurnPayload).join(', '));
    ws.send(
      JSON.stringify({
        event: 'saveTurn',
        data: saveTurnPayload,
      })
    );

    const isFinalQuestion = completedTurns + 1 >= totalQuestions;
    const promptText = isFinalQuestion
      ? `Candidate's response: "${answer}". This was the final question. Please wrap up the interview and thank the candidate.`
      : `Candidate's response: "${answer}". Please evaluate this answer and ask the next interview question.`;

    const clientContentPayload = {
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: promptText,
            },
          ],
        },
      ],
      turnComplete: true,
    };

    console.log('[VoiceClient] Emitting event: clientContent');
    console.log('[VoiceClient] Turn-finalization payload shape:', Object.keys(clientContentPayload).join(', '));
    ws.send(
      JSON.stringify({
        event: 'clientContent',
        data: clientContentPayload,
      })
    );

    setTranscripts((prev) => [...prev, { sender: 'user', text: answer }]);
    setCurrentSpeech('');
    modelResponseBufferRef.current = '';
    setCompletedTurns((prev) => prev + 1);

    setVoiceState('WAITING_FOR_AI');

    if (completedTurns + 1 >= totalQuestions) {
      setVoiceState('SESSION_COMPLETE');
      handleEndVoiceSession();
    }
  };

  const handleEndVoiceSession = async () => {
    try {
      await fetchClient(`/api/v1/interviews/${interviewId}/complete`, {
        method: 'POST',
      });
      onFinish();
    } catch {
      onFinish();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-8">
        <div>
          <h1 className="text-sm font-bold text-white truncate max-w-xs">{title}</h1>
          <p className="text-[10px] text-zinc-550 font-semibold">{targetRole}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
            Turn {completedTurns} of {totalQuestions}
          </span>
          <button onClick={handleEndVoiceSession} className="text-xs font-bold text-red-500 hover:text-red-400 transition">
            End Session
          </button>
        </div>
      </header>

      {/* Main visual interface */}
      <main className="flex-1 max-w-lg w-full mx-auto px-6 flex flex-col justify-center items-center space-y-8 py-10">
        {errorText ? (
          <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-2xl text-center space-y-4 max-w-sm">
            <span className="text-2xl">⚠️</span>
            <h4 className="text-sm font-bold text-white">Voice Connection Error</h4>
            <p className="text-xs text-zinc-455 leading-relaxed">{errorText}</p>
            <button onClick={() => window.location.reload()} className="w-full py-2 bg-white text-zinc-900 text-xs font-bold rounded-lg hover:bg-zinc-200 transition">
              Refresh & Retry
            </button>
          </div>
        ) : (
          <>
            {/* Visualizer Circle */}
            <div className="relative w-44 h-44 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-full opacity-40 pointer-events-none" />
              {/* Outer Pulsing Glow */}
              <div
                className={`absolute inset-0 rounded-full bg-indigo-500/10 transition-all duration-700 ${
                  isModelActive ? 'scale-110 blur-xl opacity-100' : 'scale-95 blur-md opacity-25'
                }`}
              ></div>

              {/* Pulsing indicator */}
              <div
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border transition-all duration-300 z-10 ${
                  isModelActive
                    ? 'bg-zinc-950 border-indigo-500/30 text-indigo-400 scale-105'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <span className="text-2xl mb-1">{isMuted ? '🔇' : '🎙️'}</span>
                <span className="text-[8px] font-extrabold uppercase tracking-widest text-zinc-550">
                  {isModelActive ? 'Speaking' : 'Listening'}
                </span>
              </div>
            </div>

            {/* Conversation log feed */}
            <div className="w-full space-y-2 max-w-md w-full mx-auto">
              <div className="flex justify-between items-center text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
                <span>Conversation Log</span>
                <span>{micState === 'granted' ? '🎤 Mic Ready' : '🔇 Mic Muted'}</span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-900/70 p-4 rounded-xl h-44 overflow-y-auto text-xs space-y-3 text-left">
                {transcripts.map((t, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className={`font-bold uppercase tracking-wide text-[9px] block ${t.sender === 'user' ? 'text-indigo-400' : 'text-zinc-400'}`}>
                      {t.sender === 'user' ? 'Candidate' : 'Interviewer'}
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{t.text}</p>
                  </div>
                ))}
                {currentSpeech.trim() && (
                  <div className="space-y-1 animate-pulse">
                    <span className="font-bold uppercase tracking-wide text-[9px] block text-indigo-400">
                      Candidate (Speaking...)
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{currentSpeech}</p>
                  </div>
                )}
                {transcripts.length === 0 && !currentSpeech.trim() && (
                  <div className="h-full flex items-center justify-center text-zinc-600 italic">
                    Establish proxy handshake to initiate conversation...
                  </div>
                )}
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => setIsMuted((m) => !m)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition text-sm ${
                  isMuted
                    ? 'bg-red-950/20 border-red-900/30 text-red-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>

              <button
                onClick={handleNextTurn}
                disabled={currentSpeech.trim().length === 0 || !isConnected}
                className="px-6 py-2.5 bg-white text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-200 transition disabled:opacity-40"
              >
                Send Answer →
              </button>
            </div>
          </>
        )}
      </main>

      {/* Transcription log footer */}
      <footer className="max-w-md w-full mx-auto px-6 pb-6 text-center">
        <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
          Secure Proxy Handshake Status: {isConnected ? 'ACTIVE' : 'DISCONNECTED'}
        </div>
      </footer>
    </div>
  );
}
