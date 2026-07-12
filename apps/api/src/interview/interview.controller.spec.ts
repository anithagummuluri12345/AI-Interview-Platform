import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { InterviewType, InterviewMode, InterviewExperienceLevel, InterviewStatus, InterviewRoundType, InterviewRoundStatus } from '@repo/db';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { validateGeneratedQuestion, validateGeneratedReport } from './interview.service';

describe('InterviewController (Integration & Phase 6 Session Engine)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateAToken: string;
  let candidateBToken: string;
  let candidateAId: string;

  const mockAiProvider = {
    generateStructured: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('AiProvider')
      .useValue(mockAiProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    // Clean tables
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.resume.deleteMany();
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
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.resume.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('Core Setup CRUD', () => {
    it('should create a DRAFT interview successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Senior Frontend Dev Interview',
          targetRole: 'Senior Frontend Engineer',
          companyName: 'Acme Corp',
          type: InterviewType.TECHNICAL,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.SENIOR,
          skills: ['React', 'TypeScript'],
          jobDescription: 'Looking for a senior frontend dev...',
          duration: 30,
          status: InterviewStatus.DRAFT,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(InterviewStatus.DRAFT);
    });

    it('should reject invalid initial status values', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Active Session',
          targetRole: 'Software Engineer',
          type: InterviewType.TECHNICAL,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['NodeJS'],
          duration: 45,
          status: InterviewStatus.IN_PROGRESS,
        })
        .expect(400);
    });
  });

  describe('PHASE 6 Session Engine Flow', () => {
    let textInterviewId: string;
    let voiceInterviewId: string;

    beforeEach(async () => {
      // Create a READY text interview
      const textInterview = await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Tech Test',
          targetRole: 'React Developer',
          type: InterviewType.TECHNICAL,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['React'],
          duration: 15, // Limit = 3 questions
          status: InterviewStatus.READY,
        },
      });
      textInterviewId = textInterview.id;

      // Create a READY voice interview
      const voiceInterview = await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Voice Test',
          targetRole: 'Manager',
          type: InterviewType.BEHAVIORAL,
          mode: InterviewMode.VOICE,
          experienceLevel: InterviewExperienceLevel.LEAD,
          skills: ['Leadership'],
          duration: 30,
          status: InterviewStatus.READY,
        },
      });
      voiceInterviewId = voiceInterview.id;
    });

    it('should successfully start a READY text interview and generate the first question', async () => {
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'Introduction',
        difficulty: 'EASY',
        questionText: 'Tell me about yourself.',
        expectedConcepts: ['experience', 'education'],
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      expect(res.body.sequence).toBe(1);
      expect(res.body.questionText).toBe('Tell me about yourself.');

      // Check status transitioned to IN_PROGRESS
      const updated = await prisma.interview.findUnique({ where: { id: textInterviewId } });
      expect(updated?.status).toBe(InterviewStatus.IN_PROGRESS);
      expect(updated?.startedAt).toBeDefined();
    });

    it('should reuse the existing first question on start retry without calling AI', async () => {
      // Manually seed first question
      const round = await prisma.interviewRound.create({
        data: {
          interviewId: textInterviewId,
          sequence: 1,
          type: InterviewRoundType.TECHNICAL,
          status: InterviewRoundStatus.IN_PROGRESS,
        },
      });
      await prisma.question.create({
        data: {
          interviewRoundId: round.id,
          sequence: 1,
          topic: 'Intro',
          difficulty: 'EASY',
          questionText: 'Seeded Question 1?',
          expectedConcepts: [],
        },
      });

      // Call start
      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      expect(res.body.questionText).toBe('Seeded Question 1?');
      expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
    });

    it('should leave status as READY if AI provider fails during start', async () => {
      mockAiProvider.generateStructured.mockRejectedValueOnce(new Error('Gemini offline'));

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(500);

      const check = await prisma.interview.findUnique({ where: { id: textInterviewId } });
      expect(check?.status).toBe(InterviewStatus.READY);
      expect(check?.startedAt).toBeNull();
    });

    it('should return read-only session data on GET and create no database records', async () => {
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'Intro',
        difficulty: 'EASY',
        questionText: 'Q1?',
        expectedConcepts: [],
      });

      // Start interview
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      const beforeCount = await prisma.question.count();

      const sessionRes = await request(app.getHttpServer())
        .get(`/api/v1/interviews/${textInterviewId}/session`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(sessionRes.body.totalQuestions).toBe(3); // 15 mins mapped to 3 questions
      expect(sessionRes.body.currentQuestion.questionText).toBe('Q1?');

      const afterCount = await prisma.question.count();
      expect(beforeCount).toBe(afterCount); // Read-only: no new questions generated on GET
    });

    it('should reject answering VOICE interviews server-side but allow starting (status transition)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${voiceInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${voiceInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: '00000000-0000-0000-0000-000000000000', answerText: 'Hello' })
        .expect(400);
    });

    it('should submit answers and return the next question', async () => {
      // 1. Start interview
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'Intro',
        difficulty: 'EASY',
        questionText: 'Q1?',
        expectedConcepts: [],
      });
      const startRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);
      const q1Id = startRes.body.id;

      // 2. Submit answer
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'React Core',
        difficulty: 'MEDIUM',
        questionText: 'What are React hooks?',
        expectedConcepts: ['useState', 'useEffect'],
      });

      const ansRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          questionId: q1Id,
          answerText: 'I like components.',
        })
        .expect(201);

      expect(ansRes.body.answer.answerText).toBe('I like components.');
      expect(ansRes.body.nextQuestion.questionText).toBe('What are React hooks?');
      expect(ansRes.body.limitReached).toBe(false);
    });

    it('should handle duplicate answer submissions idempotently and prevent duplicate next questions', async () => {
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'Intro',
        difficulty: 'EASY',
        questionText: 'Q1?',
        expectedConcepts: [],
      });
      const startRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);
      const q1Id = startRes.body.id;

      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'React Core',
        difficulty: 'MEDIUM',
        questionText: 'What is state?',
        expectedConcepts: [],
      });

      // Submit first time
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: q1Id, answerText: 'State holds components values' });

      // Submit second time concurrently/immediately after
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: q1Id, answerText: 'State holds components values' })
        .expect(201);

      // Verify no duplicate answers or questions created
      const answersCount = await prisma.answer.count({ where: { questionId: q1Id } });
      expect(answersCount).toBe(1);

      const nextQuestions = await prisma.question.findMany({ where: { sequence: 2 } });
      expect(nextQuestions.length).toBe(1);
    });

    it('should recover safely if AI fails after answer is saved, using the retry-generation endpoint', async () => {
      // 1. Start
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'Intro',
        difficulty: 'EASY',
        questionText: 'Q1?',
        expectedConcepts: [],
      });
      const startRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);
      const q1Id = startRes.body.id;

      // 2. Submit answer, mock AI failure
      mockAiProvider.generateStructured.mockRejectedValueOnce(new Error('AI Rate limit exceeded'));

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: q1Id, answerText: 'My response.' })
        .expect(500);

      // Check that the answer is indeed saved in database
      const answer = await prisma.answer.findUnique({ where: { questionId: q1Id } });
      expect(answer).not.toBeNull();

      // Check no next question exists
      const q2Check = await prisma.question.findFirst({ where: { round: { interviewId: textInterviewId }, sequence: 2 } });
      expect(q2Check).toBeNull();

      // 3. Retry question generation
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        topic: 'JavaScript',
        difficulty: 'MEDIUM',
        questionText: 'What is a closure?',
        expectedConcepts: [],
      });

      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/next-question`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      expect(retryRes.body.sequence).toBe(2);
      expect(retryRes.body.questionText).toBe('What is a closure?');
    });

    it('should restrict Candidates from accessing another Candidate\'s session', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(403);
    });

    it('should reject AI generated output matching invalid schema formats', async () => {
      // Start
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      // Seeding a question round
      const round = await prisma.interviewRound.findFirst({ where: { interviewId: textInterviewId } });
      const q1 = await prisma.question.findFirst({ where: { interviewRoundId: round?.id } });

      // Mock returns invalid payload (topic missing)
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        difficulty: 'EASY',
        questionText: 'Who are you?',
        expectedConcepts: [],
      });

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: q1?.id, answerText: 'Candidate answer' })
        .expect(400); // 400 Bad Request from validator
    });

    it('should enforce the limit on duration, trigger completion-ready status and stop question generation', async () => {
      // Set status to IN_PROGRESS so answer submission is permitted
      await prisma.interview.update({
        where: { id: textInterviewId },
        data: { status: InterviewStatus.IN_PROGRESS },
      });

      // Seeding round and 3 questions
      const round = await prisma.interviewRound.create({
        data: {
          interviewId: textInterviewId,
          sequence: 1,
          type: InterviewRoundType.TECHNICAL,
          status: InterviewRoundStatus.IN_PROGRESS,
        },
      });

      const q1 = await prisma.question.create({
        data: { interviewRoundId: round.id, sequence: 1, topic: 'A', difficulty: 'EASY', questionText: 'Q1?', expectedConcepts: [] },
      });
      const q2 = await prisma.question.create({
        data: { interviewRoundId: round.id, sequence: 2, topic: 'B', difficulty: 'MEDIUM', questionText: 'Q2?', expectedConcepts: [] },
      });
      const q3 = await prisma.question.create({
        data: { interviewRoundId: round.id, sequence: 3, topic: 'C', difficulty: 'HARD', questionText: 'Q3?', expectedConcepts: [] },
      });

      // Answer Q1 & Q2
      await prisma.answer.create({ data: { questionId: q1.id, answerText: 'Ans1', responseDurationSeconds: 0 } });
      await prisma.answer.create({ data: { questionId: q2.id, answerText: 'Ans2', responseDurationSeconds: 0 } });

      // Now submit Q3 (the 3rd question, matching the duration 15 min limit)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${textInterviewId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ questionId: q3.id, answerText: 'Ans3' })
        .expect(201);

      expect(res.body.limitReached).toBe(true);
      expect(res.body.nextQuestion).toBeNull(); // No 4th question generated
    });
  });

  describe('validateGeneratedQuestion difficulty normalization and strict checks', () => {
    it('should pass on exactly "EASY", "MEDIUM", "HARD"', () => {
      const q1 = { topic: 'React', difficulty: 'EASY', questionText: 'Q text', expectedConcepts: [] };
      const q2 = { topic: 'React', difficulty: 'MEDIUM', questionText: 'Q text', expectedConcepts: [] };
      const q3 = { topic: 'React', difficulty: 'HARD', questionText: 'Q text', expectedConcepts: [] };

      expect(() => validateGeneratedQuestion(q1)).not.toThrow();
      expect(() => validateGeneratedQuestion(q2)).not.toThrow();
      expect(() => validateGeneratedQuestion(q3)).not.toThrow();
    });

    it('should normalize and pass on "easy", " Medium ", "HARD"', () => {
      const q1 = { topic: 'React', difficulty: 'easy', questionText: 'Q text', expectedConcepts: [] };
      const q2 = { topic: 'React', difficulty: ' Medium ', questionText: 'Q text', expectedConcepts: [] };
      const q3 = { topic: 'React', difficulty: 'HARD', questionText: 'Q text', expectedConcepts: [] };

      validateGeneratedQuestion(q1);
      validateGeneratedQuestion(q2);
      validateGeneratedQuestion(q3);

      expect(q1.difficulty).toBe('EASY');
      expect(q2.difficulty).toBe('MEDIUM');
      expect(q3.difficulty).toBe('HARD');
    });

    it('should throw BadRequestException on invalid difficulty values', () => {
      const q1 = { topic: 'React', difficulty: 'VERY HARD', questionText: 'Q text', expectedConcepts: [] };
      const q2 = { topic: 'React', difficulty: '', questionText: 'Q text', expectedConcepts: [] };
      const q3 = { topic: 'React', difficulty: null, questionText: 'Q text', expectedConcepts: [] };

      expect(() => validateGeneratedQuestion(q1)).toThrow();
      expect(() => validateGeneratedQuestion(q2)).toThrow();
      expect(() => validateGeneratedQuestion(q3)).toThrow();
    });
  });

  describe('validateGeneratedReport utility function tests', () => {
    it('should pass on valid evaluation payload matching schema', () => {
      const payload = {
        overallScore: 85,
        technicalScore: 8,
        problemSolvingScore: 9,
        communicationScore: 8,
        strengths: ['coding speed'],
        weaknesses: ['css variables'],
        improvementPlan: ['learn animations'],
        summary: 'Excellent effort.',
        evaluations: [
          {
            questionId: 'q-1',
            technicalAccuracy: 8,
            completeness: 8,
            clarity: 9,
            coveredConcepts: ['state'],
            missingConcepts: [],
            strengths: ['good description'],
            feedback: 'Detailed answer.',
            recommendedAction: 'Keep it up.',
          },
        ],
      };

      expect(() => validateGeneratedReport(payload, ['q-1'])).not.toThrow();
    });

    it('should throw on out of bounds scores', () => {
      const payload = {
        overallScore: 105, // out of bounds
        technicalScore: 8,
        problemSolvingScore: 9,
        communicationScore: 8,
        strengths: ['coding speed'],
        weaknesses: ['css variables'],
        improvementPlan: ['learn animations'],
        summary: 'Excellent effort.',
        evaluations: [],
      };

      expect(() => validateGeneratedReport(payload, [])).toThrow();
    });

    it('should throw on incomplete question coverage', () => {
      const payload = {
        overallScore: 85,
        technicalScore: 8,
        problemSolvingScore: 9,
        communicationScore: 8,
        strengths: ['coding speed'],
        weaknesses: ['css variables'],
        improvementPlan: ['learn animations'],
        summary: 'Excellent effort.',
        evaluations: [
          {
            questionId: 'q-1',
            technicalAccuracy: 8,
            completeness: 8,
            clarity: 9,
            coveredConcepts: ['state'],
            missingConcepts: [],
            strengths: ['good description'],
            feedback: 'Detailed answer.',
            recommendedAction: 'Keep it up.',
          },
        ],
      };

      // expected questions are ['q-1', 'q-2'], but we only returned ['q-1']
      expect(() => validateGeneratedReport(payload, ['q-1', 'q-2'])).toThrow();
    });
  });

  describe('PHASE 7 Report Endpoints', () => {
    let completedInterviewId: string;
    let incompleteInterviewId: string;
    let q1Id: string;

    beforeEach(async () => {
      // Completed interview
      const completed = await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Finished Interview',
          targetRole: 'Dev',
          type: InterviewType.TECHNICAL,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JS'],
          duration: 15,
          status: InterviewStatus.COMPLETED,
        },
      });
      completedInterviewId = completed.id;

      // Incomplete interview
      const incomplete = await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'In Progress Interview',
          targetRole: 'Dev',
          type: InterviewType.TECHNICAL,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JS'],
          duration: 15,
          status: InterviewStatus.IN_PROGRESS,
        },
      });
      incompleteInterviewId = incomplete.id;

      // Seed questions/answers for completed interview
      const round = await prisma.interviewRound.create({
        data: {
          interviewId: completedInterviewId,
          sequence: 1,
          type: InterviewRoundType.TECHNICAL,
          status: InterviewRoundStatus.IN_PROGRESS,
        },
      });

      const q1 = await prisma.question.create({
        data: {
          interviewRoundId: round.id,
          sequence: 1,
          topic: 'Intro',
          difficulty: 'EASY',
          questionText: 'Explain hooks.',
          expectedConcepts: ['useState'],
        },
      });
      q1Id = q1.id;

      await prisma.answer.create({
        data: {
          questionId: q1.id,
          answerText: 'Hooks let you use state.',
          responseDurationSeconds: 0,
        },
      });
    });

    it('should successfully generate an AI report for a completed text interview', async () => {
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        overallScore: 80,
        technicalScore: 8,
        problemSolvingScore: 8,
        communicationScore: 8,
        strengths: ['good explanations'],
        weaknesses: ['none'],
        improvementPlan: ['continue practicing'],
        summary: 'Solid performance.',
        evaluations: [
          {
            questionId: q1Id,
            technicalAccuracy: 8,
            completeness: 8,
            clarity: 8,
            coveredConcepts: ['useState'],
            missingConcepts: [],
            strengths: ['accurate description'],
            feedback: 'Great response.',
            recommendedAction: 'Explain useEffect next time.',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${completedInterviewId}/report/generate`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      expect(res.body.overallScore).toBe(80);
      expect(res.body.summary).toBe('Solid performance.');

      // Check database entries
      const report = await prisma.interviewReport.findUnique({
        where: { interviewId: completedInterviewId },
      });
      expect(report).toBeDefined();

      const evaluation = await prisma.evaluation.findFirst({
        where: { answer: { questionId: q1Id } },
      });
      expect(evaluation?.technicalAccuracy).toBe(8);
    });

    it('should retrieve an existing report successfully', async () => {
      // Seed report
      await prisma.interviewReport.create({
        data: {
          interviewId: completedInterviewId,
          overallScore: 90,
          technicalScore: 9,
          problemSolvingScore: 9,
          communicationScore: 9,
          strengths: ['fast'],
          weaknesses: ['style'],
          improvementPlan: ['practice css'],
          summary: 'Superb.',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/interviews/${completedInterviewId}/report`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(res.body.report.overallScore).toBe(90);
      expect(res.body.report.summary).toBe('Superb.');
      expect(res.body.questions.length).toBe(1);
    });

    it('should reject report generation for non-completed interviews', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${incompleteInterviewId}/report/generate`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(400); // 400 Bad Request
    });

    it('should prevent Candidate B from generating or viewing Candidate A\'s report', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${completedInterviewId}/report/generate`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/interviews/${completedInterviewId}/report`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(403);
    });

    it('should return existing report on duplicate generate requests without creating duplicates', async () => {
      // Seed report
      const initialReport = await prisma.interviewReport.create({
        data: {
          interviewId: completedInterviewId,
          overallScore: 75,
          summary: 'Initial.',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${completedInterviewId}/report/generate`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(201);

      expect(res.body.id).toBe(initialReport.id);
      const reportsCount = await prisma.interviewReport.count({ where: { interviewId: completedInterviewId } });
      expect(reportsCount).toBe(1);
    });

    it('should reject malformed AI structured output safely', async () => {
      // Mock returns invalid payload (overallScore missing)
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        technicalScore: 8,
        strengths: [],
        weaknesses: [],
        improvementPlan: [],
        summary: 'Failed.',
        evaluations: [],
      });

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${completedInterviewId}/report/generate`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(400); // Bad Request from validator
    });

    describe('Completed Interview Replay Endpoint (Phase 13)', () => {
      it('should return successfully completed interview replay payload for authorized candidate', async () => {
        // Ensure report and questions are seeded
        await prisma.interviewReport.deleteMany({ where: { interviewId: completedInterviewId } });
        await prisma.interviewReport.create({
          data: {
            interviewId: completedInterviewId,
            overallScore: 82,
            technicalScore: 8,
            problemSolvingScore: 9,
            communicationScore: 8,
            strengths: ['Problem-solving skills'],
            weaknesses: ['Edge cases'],
            improvementPlan: ['Practice recursion'],
            summary: 'Overall strong performance.',
          },
        });

        const res = await request(app.getHttpServer())
          .get(`/api/v1/interviews/${completedInterviewId}/replay`)
          .set('Authorization', `Bearer ${candidateAToken}`)
          .expect(200);

        expect(res.body.interview).toBeDefined();
        expect(res.body.report).toBeDefined();
        expect(res.body.timeline).toBeDefined();
        expect(res.body.statistics).toBeDefined();
        expect(res.body.aiCoaching).toBeDefined();
        expect(res.body.statistics.overallScore).toBe(82);
        expect(res.body.statistics.passFail).toBe('PASS');
      });

      it('should prevent Candidate B from replaying Candidate A\'s completed session', async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/interviews/${completedInterviewId}/replay`)
          .set('Authorization', `Bearer ${candidateBToken}`)
          .expect(403);
      });

      it('should reject replay requests for interviews that are not completed yet', async () => {
        // Draft / In Progress interview
        const unfinished = await prisma.interview.create({
          data: {
            userId: candidateAId,
            title: 'Unfinished Practice',
            targetRole: 'Junior dev',
            type: InterviewType.TECHNICAL,
            mode: InterviewMode.TEXT,
            experienceLevel: InterviewExperienceLevel.ENTRY,
            skills: ['JS'],
            duration: 30,
            status: InterviewStatus.DRAFT,
          },
        });

        await request(app.getHttpServer())
          .get(`/api/v1/interviews/${unfinished.id}/replay`)
          .set('Authorization', `Bearer ${candidateAToken}`)
          .expect(400); // 400 Bad Request
      });
    });
  });
});
