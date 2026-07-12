-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY_LEVEL', 'MID_LEVEL', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "ResumeParsingStatus" AS ENUM ('PENDING', 'PARSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InterviewDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InterviewRoundType" AS ENUM ('RESUME', 'TECHNICAL', 'BEHAVIORAL', 'CODING', 'CS_FUNDAMENTALS');

-- CreateEnum
CREATE TYPE "InterviewRoundStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('AI_GENERATED', 'PREDEFINED');

-- CreateEnum
CREATE TYPE "CodingDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ProgrammingLanguage" AS ENUM ('JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'GO', 'JAVA', 'CPP');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'COMPILATION_ERROR', 'RUNTIME_ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullName" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "experienceLevel" "ExperienceLevel",
    "targetRoles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "parsingStatus" "ResumeParsingStatus" NOT NULL DEFAULT 'PENDING',
    "rawText" TEXT,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "difficulty" "InterviewDifficulty" NOT NULL,
    "mode" "InterviewMode" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "type" "InterviewRoundType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "InterviewRoundStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "interviewRoundId" UUID NOT NULL,
    "parentQuestionId" UUID,
    "source" "QuestionSource" NOT NULL DEFAULT 'AI_GENERATED',
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "expectedConcepts" TEXT[],
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "answerText" TEXT NOT NULL,
    "transcript" TEXT,
    "responseDurationSeconds" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" UUID NOT NULL,
    "answerId" UUID NOT NULL,
    "technicalAccuracy" INTEGER NOT NULL,
    "completeness" INTEGER NOT NULL,
    "clarity" INTEGER NOT NULL,
    "coveredConcepts" TEXT[],
    "missingConcepts" TEXT[],
    "strengths" TEXT[],
    "feedback" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewReport" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "technicalScore" INTEGER,
    "problemSolvingScore" INTEGER,
    "communicationScore" INTEGER,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "improvementPlan" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingProblem" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "CodingDifficulty" NOT NULL,
    "constraints" TEXT[],
    "examples" JSONB NOT NULL,
    "starterCode" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingSubmission" (
    "id" UUID NOT NULL,
    "interviewRoundId" UUID NOT NULL,
    "codingProblemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" "ProgrammingLanguage" NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "passedTests" INTEGER NOT NULL,
    "totalTests" INTEGER NOT NULL,
    "executionTimeMs" INTEGER,
    "memoryUsedKb" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "Resume_userId_idx" ON "Resume"("userId");

-- CreateIndex
CREATE INDEX "Interview_userId_createdAt_idx" ON "Interview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRound_interviewId_sequence_key" ON "InterviewRound"("interviewId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Question_interviewRoundId_sequence_key" ON "Question"("interviewRoundId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionId_key" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_answerId_key" ON "Evaluation"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewReport_interviewId_key" ON "InterviewReport"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "CodingProblem_slug_key" ON "CodingProblem"("slug");

-- CreateIndex
CREATE INDEX "CodingSubmission_userId_submittedAt_idx" ON "CodingSubmission"("userId", "submittedAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewReport" ADD CONSTRAINT "InterviewReport_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_codingProblemId_fkey" FOREIGN KEY ("codingProblemId") REFERENCES "CodingProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
