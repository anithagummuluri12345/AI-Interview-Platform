'use client';

import React, { useState, useEffect } from 'react';
import { fetchClient } from '../lib/api.client';

export interface ResumeItem {
  id: string;
  originalFileName: string;
  fileSize: number;
  parsingStatus: string;
  structuredData?: {
    skills?: string[];
    experienceYears?: number;
  };
}

export interface InterviewFormData {
  title: string;
  targetRole: string;
  companyName: string;
  company?: string;
  experienceLevel: string;
  type: string;
  mode: string;
  duration: number;
  skills: string[];
  jobDescription: string;
  resumeId?: string;
  status?: string;
}

interface InterviewFormProps {
  initialData?: InterviewFormData;
  onSubmit: (data: InterviewFormData, asReady: boolean) => Promise<void>;
  isLoading: boolean;
  titleText: string;
}

export function InterviewForm({ initialData, onSubmit, isLoading, titleText }: InterviewFormProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(initialData?.title || '');
  const [targetRole, setTargetRole] = useState(initialData?.targetRole || '');
  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [company, setCompany] = useState(initialData?.company || 'GENERIC');
  const [experienceLevel, setExperienceLevel] = useState(initialData?.experienceLevel || 'ENTRY');
  const [type, setType] = useState(initialData?.type || 'TECHNICAL');
  const [mode, setMode] = useState(initialData?.mode || 'TEXT');
  const [duration, setDuration] = useState(initialData?.duration || 30);
  const [skillsInput, setSkillsInput] = useState(initialData?.skills?.join(', ') || '');
  const [jobDescription, setJobDescription] = useState(initialData?.jobDescription || '');
  const [error, setError] = useState<string | null>(null);

  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | undefined>(initialData?.resumeId);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    async function fetchResumes() {
      setIsLoadingResumes(true);
      try {
        const res = await fetchClient('/api/v1/resumes');
        if (res.ok) {
          const data = await res.json();
          setResumes(data);
        }
      } catch (err) {
        console.error('Failed to fetch resumes:', err);
      } finally {
        setIsLoadingResumes(false);
      }
    }
    fetchResumes();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5 MB limit.');
      return;
    }
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (file.type !== 'application/pdf' && ext !== '.pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetchClient('/api/v1/resumes/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload and parse resume.');
      }

      setResumes((prev) => [data, ...prev]);
      setResumeId(data.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during file upload.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteResume = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resume? Historical interviews will keep their references, but it will be removed from your active library.')) {
      return;
    }
    setUploadError(null);
    try {
      const res = await fetchClient(`/api/v1/resumes/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setResumes((prev) => prev.filter((r) => r.id !== id));
        if (resumeId === id) {
          setResumeId(undefined);
        }
        setUploadError(null);
      } else {
        const data = await res.json();
        setUploadError(data.message || 'Could not delete resume.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while deleting.';
      setUploadError(msg);
    }
  };

  const getSkillsArray = () => {
    return skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const validateStep = (currentStep: number) => {
    setError(null);
    if (currentStep === 1) {
      if (!title.trim()) return 'Interview title is required.';
      if (!targetRole.trim()) return 'Target job role is required.';
    }
    if (currentStep === 2) {
      if (![15, 30, 45, 60].includes(Number(duration))) {
        return 'Please select a duration of 15, 30, 45, or 60 minutes.';
      }
    }
    if (currentStep === 4) { // Skills and Context step
      const skills = getSkillsArray();
      if (skills.length === 0) {
        return 'Please enter at least one skill.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmitAction = async (asReady: boolean) => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    try {
      const finalSkills = getSkillsArray();
      await onSubmit(
        {
          title,
          targetRole,
          companyName,
          company,
          experienceLevel,
          type,
          mode,
          duration: Number(duration),
          skills: finalSkills,
          jobDescription,
          resumeId,
        },
        asReady
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred during submission.');
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
      <div className="border-b border-zinc-150 dark:border-zinc-850 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{titleText}</h2>
        <div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <span>Step {step} of 6</span>
          <div className="flex gap-1 h-1.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`flex-1 transition-all duration-300 ${
                  s <= step ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg text-sm text-red-800 dark:text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Interview Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm font-medium"
              placeholder="e.g. Senior Backend Engineer Prep"
              required
            />
          </div>

          <div>
            <label htmlFor="targetRole" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Target Job Role
            </label>
            <input
              id="targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
              placeholder="e.g. Node.js Developer"
              required
            />
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Company Name <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
              placeholder="e.g. Google, Stripe"
            />
          </div>

          <div>
            <label htmlFor="experienceLevel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Target Experience Level
            </label>
            <select
              id="experienceLevel"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100"
            >
              <option value="ENTRY">Entry Level</option>
              <option value="JUNIOR">Junior Level</option>
              <option value="MID">Mid Level</option>
              <option value="SENIOR">Senior Level</option>
              <option value="LEAD">Lead / Architect</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Configuration */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Interview Type</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: 'TECHNICAL', label: 'Technical', desc: 'Interactive Q&A & technical concepts' },
                { val: 'CODING', label: 'Coding', desc: 'Real-time sandbox coding challenges' },
                { val: 'BEHAVIORAL', label: 'Behavioral', desc: 'STAR format situational questions' },
                { val: 'HR', label: 'HR Screen', desc: 'Culture fit & general evaluations' },
                { val: 'MIXED', label: 'Mixed Mode', desc: 'Comprehensive core assessments' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setType(item.val)}
                  className={`flex flex-col text-left p-4 rounded-xl border text-sm transition ${
                    type === item.val
                      ? 'border-zinc-950 dark:border-zinc-50 bg-zinc-50 dark:bg-zinc-850 ring-1 ring-zinc-900 dark:ring-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                  }`}
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                  <span className="mt-1 text-xs text-zinc-500 leading-tight">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Interview Mode</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: 'TEXT', label: 'Interactive Text', desc: 'Type answers inside full editor terminal' },
                { val: 'VOICE', label: 'AI Voice Guidance', desc: 'Audio simulations with verbal responses' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setMode(item.val)}
                  className={`flex flex-col text-left p-4 rounded-xl border text-sm transition ${
                    mode === item.val
                      ? 'border-zinc-950 dark:border-zinc-50 bg-zinc-50 dark:bg-zinc-850 ring-1 ring-zinc-900 dark:ring-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                  }`}
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                  <span className="mt-1 text-xs text-zinc-500 leading-tight">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duration</span>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDuration(t)}
                  className={`py-3 rounded-lg border text-sm font-semibold transition ${
                    duration === t
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                  }`}
                >
                  {t} Mins
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Company Selection */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-sans">Company Specific Simulation</h3>
            <p className="max-w-md mx-auto text-sm text-zinc-500 dark:text-zinc-400 font-sans">
              Choose a specific target company context. The AI interviewer will automatically adapt round formats, technical focus topics, and evaluation rubrics.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
            {[
              { val: 'GENERIC', label: '⚙️ Generic Company', desc: 'Standard mock assessment style' },
              { val: 'GOOGLE', label: '🔴 Google', desc: 'Algorithmic complexity, optimization focus' },
              { val: 'AMAZON', label: '📦 Amazon', desc: 'Leadership principles (STAR), medium/hard DSA' },
              { val: 'MICROSOFT', label: '💻 Microsoft', desc: 'Object-oriented programming, Cloud architectures' },
              { val: 'FLIPKART', label: '🛒 Flipkart', desc: 'High concurrency backend scalability challenges' },
              { val: 'ADOBE', label: '🎨 Adobe', desc: 'Core JavaScript/TypeScript frontend engineering' },
              { val: 'ATLASSIAN', label: '🌍 Atlassian', desc: 'Distributed systems, collaborative APIs, values' },
              { val: 'UBER', label: '🚗 Uber', desc: 'Low latency index, concurrency, geometry indexing' },
              { val: 'GOLDMAN_SACHS', label: '🏦 Goldman Sachs', desc: 'Core Java, databases, probability, multithreading' },
              { val: 'SALESFORCE', label: '☁️ Salesforce', desc: 'Enterprise SaaS design, multitenancy patterns' }
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setCompany(item.val)}
                className={`flex flex-col text-left p-4 rounded-xl border text-sm transition ${
                  company === item.val
                    ? 'border-zinc-950 dark:border-zinc-50 bg-zinc-50 dark:bg-zinc-850 ring-1 ring-zinc-900 dark:ring-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</span>
                <span className="mt-1 text-xs text-zinc-500 leading-tight">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Skills and Context */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="skills" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Skills & Technology Stack <span className="text-zinc-400 font-normal">(comma-separated)</span>
            </label>
            <input
              id="skills"
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
              placeholder="React, Node.js, System Design, AWS"
              required
            />
          </div>

          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Job Description / Context <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="jobDescription"
              rows={5}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 px-3 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none sm:text-sm"
              placeholder="Paste the target job description here to align the AI interviewer's questions..."
            />
          </div>
        </div>
      )}

      {/* Step 5: Resume */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-sans">Upload Resume / CV</h3>
            <p className="max-w-md mx-auto text-sm text-zinc-500 dark:text-zinc-400 font-sans">
              Tailor the interview questions based on your resume achievements and technical work history.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 transition-colors text-center ${
              isDragging
                ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-850'
                : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-850'
            }`}
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="space-y-2 pointer-events-none">
              <div className="mx-auto w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-xl">
                {isUploading ? '⌛' : '📤'}
              </div>
              <div className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">
                {isUploading ? 'Uploading and parsing resume...' : 'Drag and drop your resume here, or click to browse'}
              </div>
              <div className="text-xs text-zinc-450">
                PDF only. Maximum size 5 MB.
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {uploadError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-4 text-xs font-semibold flex items-start gap-2.5">
              <span>⚠️</span>
              <div className="flex-1">{uploadError}</div>
            </div>
          )}

          {/* List of Previously Uploaded Resumes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Your Resumes</h4>
            {isLoadingResumes ? (
              <div className="text-center py-6 text-sm text-zinc-400">Loading your resumes...</div>
            ) : resumes.length === 0 ? (
              <div className="text-center py-8 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-400 bg-zinc-50/30 dark:bg-zinc-900/10">
                No resumes uploaded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {resumes.map((resume) => {
                  const isSelected = resumeId === resume.id;
                  const skills = resume.structuredData?.skills || [];
                  const experienceYears = resume.structuredData?.experienceYears || 0;

                  return (
                    <div
                      key={resume.id}
                      onClick={() => setResumeId(isSelected ? undefined : resume.id)}
                      className={`group relative flex items-start justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'border-zinc-950 dark:border-zinc-50 bg-zinc-50 dark:bg-zinc-850'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl mt-0.5 pointer-events-none">📄</span>
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-100 truncate pr-6">
                            {resume.originalFileName}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-450">
                            {experienceYears > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-150 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-semibold">
                                {experienceYears} {experienceYears === 1 ? 'year' : 'years'} exp
                              </span>
                            )}
                            {skills.slice(0, 4).map((skill: string) => (
                              <span
                                key={skill}
                                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleDeleteResume(resume.id, e)}
                          className="text-zinc-400 hover:text-red-500 dark:hover:text-red-450 p-1.5 rounded-lg transition-colors"
                          title="Delete Resume"
                        >
                          🗑️
                        </button>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-zinc-950 bg-zinc-950 dark:border-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-900'
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}
                        >
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <div className="space-y-6">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-850 rounded-xl p-5 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Title</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250">{title}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Target Role</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250">{targetRole}</span>
              </div>
              {companyName && (
                <div>
                  <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Target Company</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-250">{companyName}</span>
                </div>
              )}
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Profile Simulation</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250 capitalize">{company.toLowerCase()}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Experience Level</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250 capitalize">{experienceLevel.toLowerCase()}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type & Mode</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250 capitalize">
                  {type.toLowerCase()} • {mode.toLowerCase()}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Duration</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-250">{duration} minutes</span>
              </div>
            </div>

            {resumeId && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Attached Resume</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-250 flex items-center gap-1.5 mt-1">
                    📄 {resumes.find(r => r.id === resumeId)?.originalFileName || 'Selected Resume'}
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Target Skills</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {getSkillsArray().map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-md"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {jobDescription && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Job Description Context</span>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">{jobDescription}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {step === 6 ? (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleSubmitAction(false)}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleSubmitAction(true)}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 shadow-md animate-pulse"
              >
                {isLoading ? 'Creating...' : 'Create & Ready'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
