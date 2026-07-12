-- AlterEnum
ALTER TYPE "ProgrammingLanguage" ADD VALUE 'C';

-- AlterTable
ALTER TABLE "CodingProblem" ADD COLUMN     "companyStyle" TEXT,
ADD COLUMN     "expectedTimeMins" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "hints" TEXT[],
ADD COLUMN     "requiredConcepts" TEXT[],
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "CodingSubmission" ADD COLUMN     "aiReview" JSONB,
ADD COLUMN     "compilationError" TEXT,
ADD COLUMN     "failedTests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "runtimeError" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "codingProblemId" UUID;

-- CreateTable
CREATE TABLE "CodingTestCase" (
    "id" UUID NOT NULL,
    "codingProblemId" UUID NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,

    CONSTRAINT "CodingTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodingTestCase_codingProblemId_idx" ON "CodingTestCase"("codingProblemId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_codingProblemId_fkey" FOREIGN KEY ("codingProblemId") REFERENCES "CodingProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingTestCase" ADD CONSTRAINT "CodingTestCase_codingProblemId_fkey" FOREIGN KEY ("codingProblemId") REFERENCES "CodingProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
