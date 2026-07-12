-- CreateEnum
CREATE TYPE "InterviewCompany" AS ENUM ('GENERIC', 'AMAZON', 'GOOGLE', 'MICROSOFT', 'FLIPKART', 'ADOBE', 'ATLASSIAN', 'UBER', 'GOLDMAN_SACHS', 'SALESFORCE');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "company" "InterviewCompany" NOT NULL DEFAULT 'GENERIC';
