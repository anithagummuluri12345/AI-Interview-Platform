/*
  Warnings:

  - Added the required column `duration` to the `Interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `experienceLevel` to the `Interview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'BEHAVIORAL', 'HR', 'MIXED');

-- CreateEnum
CREATE TYPE "InterviewExperienceLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InterviewStatus" ADD VALUE 'READY';
ALTER TYPE "InterviewStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "experienceLevel" "InterviewExperienceLevel" NOT NULL,
ADD COLUMN     "jobDescription" TEXT,
ADD COLUMN     "resumeId" UUID,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "type" "InterviewType" NOT NULL,
ALTER COLUMN "difficulty" SET DEFAULT 'MEDIUM',
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
