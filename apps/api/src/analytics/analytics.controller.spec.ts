import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { InterviewStatus } from '@repo/db';

describe('AnalyticsController & History (Integration - Phase 10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateAToken: string;
  let candidateBToken: string;
  let candidateAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean tables
    await prisma.evaluation.deleteMany();
    await prisma.interviewReport.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create Candidate A
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'canda@example.com', password: 'securePassword123', fullName: 'Candidate A' });

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'canda@example.com', password: 'securePassword123' });
    candidateAToken = loginResA.body.accessToken;
    candidateAId = loginResA.body.user.id;

    // Create Candidate B
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'candb@example.com', password: 'securePassword123', fullName: 'Candidate B' });

    const loginResB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'candb@example.com', password: 'securePassword123' });
    candidateBToken = loginResB.body.accessToken;
  });

  afterAll(async () => {
    await prisma.evaluation.deleteMany();
    await prisma.interviewReport.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('should return default null/0 response when there is zero completed history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(res.body.totalCompleted).toBe(0);
      expect(res.body.totalEvaluated).toBe(0);
      expect(res.body.avgScore).toBeNull();
      expect(res.body.bestScore).toBeNull();
      expect(res.body.passRate).toBeNull();
      expect(res.body.textAvgScore).toBeNull();
      expect(res.body.voiceAvgScore).toBeNull();
      expect(res.body.avgTechnical).toBeNull();
    });

    it('should calculate summary properly excluding draft/ready/in_progress and handling completed but not evaluated', async () => {
      // 1. Completed & Evaluated (score 80)
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'React developer',
          targetRole: 'React Developer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: {
              overallScore: 80,
              technicalScore: 82,
              communicationScore: 78,
              strengths: ['react', 'components'],
              weaknesses: ['caching'],
            },
          },
        },
      });

      // 2. Completed but NOT Evaluated (no report row)
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'NodeJS developer',
          targetRole: 'Node Developer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['NodeJS'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
        },
      });

      // 3. Draft (should be excluded completely)
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Python developer',
          targetRole: 'Python Developer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['Python'],
          duration: 30,
          status: InterviewStatus.DRAFT,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      // totalCompleted should be 2 (int1 and node interview)
      expect(res.body.totalCompleted).toBe(2);
      // totalEvaluated should be 1 (only int1 has report)
      expect(res.body.totalEvaluated).toBe(1);
      // Average score is calculated ONLY from evaluated (80 / 1 = 80)
      expect(res.body.avgScore).toBe(80);
      expect(res.body.bestScore).toBe(80);
      expect(res.body.passRate).toBe(100); // 1 passed out of 1 evaluated
    });

    it('should calculate pass rates and average technical/clarity scores accurately across mixed modes', async () => {
      // Create evaluated TEXT interview
      const txt = await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Frontend text',
          targetRole: 'Frontend',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: { overallScore: 85 },
          },
        },
      });

      // Create evaluated VOICE interview (score 45 - fail)
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Frontend voice',
          targetRole: 'Frontend',
          type: 'TECHNICAL',
          mode: 'VOICE',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: { overallScore: 45 },
          },
        },
      });

      // Add evaluation answers for technical Accuracy details
      const round = await prisma.interviewRound.create({
        data: {
          interviewId: txt.id,
          sequence: 1,
          type: 'TECHNICAL',
        },
      });

      const question = await prisma.question.create({
        data: {
          interviewRoundId: round.id,
          sequence: 1,
          topic: 'React',
          difficulty: 'MEDIUM',
          questionText: 'Explain hooks',
        },
      });

      const answer = await prisma.answer.create({
        data: {
          questionId: question.id,
          answerText: 'Hooks let you use state...',
          responseDurationSeconds: 15,
        },
      });

      await prisma.evaluation.create({
        data: {
          answerId: answer.id,
          technicalAccuracy: 8,
          clarity: 9,
          completeness: 7,
          feedback: 'Nice explanation',
          recommendedAction: 'Keep practicing',
          evaluatorVersion: 'v1',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(res.body.totalCompleted).toBe(2);
      expect(res.body.totalEvaluated).toBe(2);
      expect(res.body.avgScore).toBe(65); // (85 + 45) / 2 = 65
      expect(res.body.bestScore).toBe(85);
      expect(res.body.passRate).toBe(50); // 1 pass (85) and 1 fail (45)
      expect(res.body.textAvgScore).toBe(85);
      expect(res.body.voiceAvgScore).toBe(45);

      // Evaluator dimensions
      expect(res.body.avgTechnical).toBe(8.0);
      expect(res.body.avgClarity).toBe(9.0);
      expect(res.body.avgCompleteness).toBe(7.0);
    });

    it('should isolate candidate data and verify Candidate B gets no details of Candidate A', async () => {
      // Create Candidate A interview report
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Candidate A only',
          targetRole: 'Frontend',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: { overallScore: 90 },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/summary')
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(200);

      // Candidate B should have 0 completed since Candidate A's report must remain private
      expect(res.body.totalCompleted).toBe(0);
      expect(res.body.avgScore).toBeNull();
    });
  });

  describe('GET /api/v1/analytics/skill-gaps', () => {
    it('should properly collapse repeated whitespace and group skills case-insensitively', async () => {
      // Seeding reports with duplicate skills with extra space/casing differences
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Interview 1',
          targetRole: 'Frontend',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: {
              overallScore: 80,
              strengths: ['  ReactJS  ', 'Redux'],
              weaknesses: ['  caching ', 'caching'],
              improvementPlan: ['Read caching guide'],
            },
          },
        },
      });

      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Interview 2',
          targetRole: 'Frontend',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          status: InterviewStatus.COMPLETED,
          report: {
            create: {
              overallScore: 75,
              strengths: ['reactjs', 'Redux Toolkit'],
              weaknesses: ['Caching'],
              improvementPlan: ['read caching guide'],
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/skill-gaps')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      // Strengths: "ReactJS" (2 counts) and "Redux" / "Redux Toolkit"
      const reactjs = res.body.strongAreas.find((s: any) => s.label.toLowerCase() === 'reactjs');
      expect(reactjs).toBeDefined();
      expect(reactjs.count).toBe(2);
      expect(reactjs.label.trim()).toBe('ReactJS'); // normalized whitespace preserved display label

      // Weaknesses: "caching" (3 counts total since caching appears twice in report 1 and once in report 2)
      const caching = res.body.weakAreas.find((w: any) => w.label.toLowerCase() === 'caching');
      expect(caching).toBeDefined();
      expect(caching.count).toBe(3);
    });
  });

  describe('GET /api/v1/interviews/history', () => {
    it('should paginate history properly and apply filtering', async () => {
      // Seed 12 completed interviews for Candidate A
      for (let i = 1; i <= 12; i++) {
        await prisma.interview.create({
          data: {
            userId: candidateAId,
            title: `Practice run ${i}`,
            targetRole: i % 2 === 0 ? 'Backend Engineer' : 'Frontend Engineer',
            type: 'TECHNICAL',
            mode: i % 3 === 0 ? 'VOICE' : 'TEXT',
            difficulty: i % 4 === 0 ? 'HARD' : 'MEDIUM',
            experienceLevel: 'MID',
            duration: 30,
            status: InterviewStatus.COMPLETED,
          },
        });
      }

      // Default pagination (page 1, limit 10)
      const res = await request(app.getHttpServer())
        .get('/api/v1/interviews/history')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(res.body.items.length).toBe(10);
      expect(res.body.total).toBe(12);
      expect(res.body.totalPages).toBe(2);

      // Custom page 2
      const resPage2 = await request(app.getHttpServer())
        .get('/api/v1/interviews/history?page=2&limit=10')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);
      expect(resPage2.body.items.length).toBe(2);

      // Filtering by mode VOICE
      const resVoice = await request(app.getHttpServer())
        .get('/api/v1/interviews/history?mode=VOICE')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);
      // index divisible by 3: 3, 6, 9, 12 -> total 4
      expect(resVoice.body.total).toBe(4);

      // Filter by search Backend
      const resSearch = await request(app.getHttpServer())
        .get('/api/v1/interviews/history?search=Backend')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);
      // index divisible by 2: 2, 4, 6, 8, 10, 12 -> total 6
      expect(resSearch.body.total).toBe(6);
    });
  });
});
