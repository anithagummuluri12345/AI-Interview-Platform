import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const completedInterviews = await this.prisma.interview.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        report: true,
      },
    });

    const totalCompleted = completedInterviews.length;
    const evaluatedInterviews = completedInterviews.filter((i) => i.report !== null);
    const totalEvaluated = evaluatedInterviews.length;

    let avgScore: number | null = null;
    let bestScore: number | null = null;
    let passRate: number | null = null;
    let textAvgScore: number | null = null;
    let voiceAvgScore: number | null = null;

    if (totalEvaluated > 0) {
      const sumScore = evaluatedInterviews.reduce((acc, curr) => acc + curr.report!.overallScore, 0);
      avgScore = parseFloat((sumScore / totalEvaluated).toFixed(1));

      bestScore = Math.max(...evaluatedInterviews.map((i) => i.report!.overallScore));

      const passCount = evaluatedInterviews.filter((i) => i.report!.overallScore >= 50).length;
      passRate = Math.round((passCount / totalEvaluated) * 100);

      const textInterviews = evaluatedInterviews.filter((i) => i.mode === 'TEXT');
      if (textInterviews.length > 0) {
        const textSum = textInterviews.reduce((acc, curr) => acc + curr.report!.overallScore, 0);
        textAvgScore = parseFloat((textSum / textInterviews.length).toFixed(1));
      }

      const voiceInterviews = evaluatedInterviews.filter((i) => i.mode === 'VOICE');
      if (voiceInterviews.length > 0) {
        const voiceSum = voiceInterviews.reduce((acc, curr) => acc + curr.report!.overallScore, 0);
        voiceAvgScore = parseFloat((voiceSum / voiceInterviews.length).toFixed(1));
      }
    }

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        answer: {
          question: {
            round: {
              interview: {
                userId,
                status: 'COMPLETED',
              },
            },
          },
        },
      },
      select: {
        technicalAccuracy: true,
        clarity: true,
        completeness: true,
      },
    });

    let avgTechnical: number | null = null;
    let avgClarity: number | null = null;
    let avgCompleteness: number | null = null;

    if (evaluations.length > 0) {
      const techSum = evaluations.reduce((acc, curr) => acc + curr.technicalAccuracy, 0);
      const claritySum = evaluations.reduce((acc, curr) => acc + curr.clarity, 0);
      const completenessSum = evaluations.reduce((acc, curr) => acc + curr.completeness, 0);

      avgTechnical = parseFloat((techSum / evaluations.length).toFixed(1));
      avgClarity = parseFloat((claritySum / evaluations.length).toFixed(1));
      avgCompleteness = parseFloat((completenessSum / evaluations.length).toFixed(1));
    }

    // Company-specific metrics
    let mostPracticedCompany = 'N/A';
    let bestPerformingCompany = 'N/A';
    let weakestCompany = 'N/A';
    const avgScorePerCompany: Record<string, number> = {};
    const companyWiseProgress: Record<string, number> = {};

    if (completedInterviews.length > 0) {
      // 1. Progress count per company
      const companyCompletions: Record<string, number> = {};
      for (const i of completedInterviews) {
        companyCompletions[i.company] = (companyCompletions[i.company] || 0) + 1;
      }
      Object.assign(companyWiseProgress, companyCompletions);

      // Most practiced company
      let maxCount = 0;
      for (const [comp, count] of Object.entries(companyCompletions)) {
        if (count > maxCount) {
          maxCount = count;
          mostPracticedCompany = comp;
        }
      }

      // 2. Average score per company (evaluated interviews)
      const companyScores: Record<string, { sum: number; count: number }> = {};
      for (const i of evaluatedInterviews) {
        const comp = i.company;
        if (!companyScores[comp]) {
          companyScores[comp] = { sum: 0, count: 0 };
        }
        companyScores[comp].sum += i.report!.overallScore;
        companyScores[comp].count += 1;
      }

      let maxAvg = -1;
      let minAvg = 999;
      for (const [comp, data] of Object.entries(companyScores)) {
        const avg = parseFloat((data.sum / data.count).toFixed(1));
        avgScorePerCompany[comp] = avg;

        if (avg > maxAvg) {
          maxAvg = avg;
          bestPerformingCompany = comp;
        }
        if (avg < minAvg) {
          minAvg = avg;
          weakestCompany = comp;
        }
      }
    }

    return {
      totalCompleted,
      totalEvaluated,
      avgScore,
      bestScore,
      passRate,
      textAvgScore,
      voiceAvgScore,
      avgTechnical,
      avgClarity,
      avgCompleteness,
      mostPracticedCompany,
      bestPerformingCompany,
      weakestCompany,
      avgScorePerCompany,
      companyWiseProgress,
    };
  }

  async getTrends(userId: string) {
    const completedInterviews = await this.prisma.interview.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      include: {
        report: true,
      },
    });

    return completedInterviews
      .filter((i) => i.report !== null)
      .map((i) => ({
        interviewId: i.id,
        title: i.title,
        mode: i.mode,
        overallScore: i.report!.overallScore,
        technicalScore: i.report!.technicalScore,
        communicationScore: i.report!.communicationScore,
        problemSolvingScore: i.report!.problemSolvingScore,
        completedAt: i.completedAt || i.createdAt,
      }));
  }

  async getSkillGaps(userId: string) {
    const reports = await this.prisma.interviewReport.findMany({
      where: {
        interview: {
          userId,
          status: 'COMPLETED',
        },
      },
      select: {
        strengths: true,
        weaknesses: true,
        improvementPlan: true,
      },
    });

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        answer: {
          question: {
            round: {
              interview: {
                userId,
                status: 'COMPLETED',
              },
            },
          },
        },
      },
      select: {
        missingConcepts: true,
        recommendedAction: true,
      },
    });

    const aggregateStrings = (items: (string[] | string | undefined | null)[]) => {
      const counts = new Map<string, { label: string; count: number }>();
      for (const item of items) {
        if (!item) continue;
        const strings = Array.isArray(item) ? item : [item];
        for (const str of strings) {
          if (!str || typeof str !== 'string') continue;
          const clean = str.trim().replace(/\s+/g, ' ');
          if (!clean) continue;
          const key = clean.toLowerCase();
          const existing = counts.get(key);
          if (existing) {
            existing.count++;
          } else {
            counts.set(key, { label: clean, count: 1 });
          }
        }
      }
      return Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };

    const weakAreas = aggregateStrings(reports.map((r) => r.weaknesses));
    const strongAreas = aggregateStrings(reports.map((r) => r.strengths));
    const missingConcepts = aggregateStrings(evaluations.map((e) => e.missingConcepts));

    const focusSources = [
      ...reports.map((r) => r.improvementPlan),
      ...evaluations.map((e) => e.recommendedAction),
    ];
    const focusAreas = aggregateStrings(focusSources);

    return {
      weakAreas,
      strongAreas,
      missingConcepts,
      focusAreas,
    };
  }
}
