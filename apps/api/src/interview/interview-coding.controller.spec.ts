import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { InterviewType, InterviewMode, InterviewExperienceLevel, InterviewStatus, InterviewRoundType, InterviewRoundStatus, ProgrammingLanguage } from '@repo/db';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('Interview Coding Runtime (Integration - Phase 11B)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateAToken: string;
  let candidateBToken: string;
  let candidateAId: string;

  const mockGeneratedCodingProblem = {
    title: 'Squares of Sorted Array',
    slug: 'squares-sorted-array',
    description: 'Given sorted inputs, return sorted squares',
    constraints: ['O(N) time'],
    examples: [
      { input: '3\n9', output: '9', explanation: '3 squared' }
    ],
    starterCode: {
      JAVASCRIPT: 'const fs = require("fs"); const input = fs.readFileSync(0, "utf-8").trim(); console.log(parseInt(input, 10) * parseInt(input, 10));',
      TYPESCRIPT: '// ts',
      PYTHON: '# py',
      JAVA: '// java',
      CPP: '// cpp',
      C: '// c'
    },
    difficulty: 'EASY',
    expectedTimeMins: 15,
    tags: ['array'],
    requiredConcepts: ['sorting'],
    hints: ['Just square each element'],
    sampleTestCases: [
      { input: '3', expectedOutput: '9', explanation: '3 squared' }
    ],
    hiddenTestCases: [
      { input: '3', expectedOutput: '9' },
      { input: '5', expectedOutput: '25' }
    ]
  };

  const mockGeneratedCodingReview = {
    score: 92,
    technicalAccuracy: 10,
    codeQuality: 9,
    readability: 9,
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    strengths: ['Correct execution', 'Optimal space'],
    weaknesses: ['None'],
    improvements: ['Clean up formatting'],
    summary: 'Perfect solution.'
  };

  const mockAiProvider = {
    generateStructured: jest.fn().mockImplementation((prompt: string, schema: any) => {
      if (schema.properties.starterCode) {
        return Promise.resolve(mockGeneratedCodingProblem);
      }
      return Promise.resolve(mockGeneratedCodingReview);
    }),
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
    jest.clearAllMocks();

    // Clean tables in correct order
    await prisma.evaluation.deleteMany();
    await prisma.codingSubmission.deleteMany();
    await prisma.codingTestCase.deleteMany();
    await prisma.codingProblem.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interviewReport.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.resume.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Register Candidate A
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'canda@example.com', password: 'securePassword123', fullName: 'Candidate A' });

    const loginResA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'canda@example.com', password: 'securePassword123' });
    candidateAToken = loginResA.body.accessToken;
    candidateAId = loginResA.body.user.id;

    // Register Candidate B
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
    await prisma.codingSubmission.deleteMany();
    await prisma.codingTestCase.deleteMany();
    await prisma.codingProblem.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interviewReport.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.resume.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('Coding Interview Lifecycle', () => {
    it('should generate coding question on start and execute Run Code against sample test cases', async () => {
      // 1. Create coding category interview
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Algorithm Interview',
          targetRole: 'Software Engineer',
          type: InterviewType.CODING,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JavaScript'],
          duration: 30,
          status: InterviewStatus.READY,
        });

      expect(createRes.status).toBe(201);
      const interviewId = createRes.body.id;

      // 2. Start Interview -> Generates CodingProblem dynamically and links it
      const startRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      expect(startRes.status).toBe(201);
      expect(startRes.body.codingProblemId).toBeDefined();
      expect(startRes.body.codingProblem.title).toBe('Squares of Sorted Array');

      // Verify DB entries exist
      const problem = await prisma.codingProblem.findUnique({
        where: { id: startRes.body.codingProblemId },
        include: { testCases: true }
      });
      expect(problem).toBeDefined();
      expect(problem?.testCases.length).toBe(3); // 1 sample + 2 hidden

      // 3. POST /api/v1/interviews/:id/run with correct source code (Accepted status)
      const runRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/run`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: mockGeneratedCodingProblem.starterCode.JAVASCRIPT,
        });

      expect(runRes.status).toBe(201);
      expect(runRes.body.status).toBe('ACCEPTED');
      expect(runRes.body.passedTests).toBe(1);
      expect(runRes.body.totalTests).toBe(1);

      // Verify no submission records were created during run
      const subCount = await prisma.codingSubmission.count();
      expect(subCount).toBe(0);
    });

    it('should reject execution requests if interview is not in progress or unauthorized', async () => {
      // Create draft interview
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Algorithms',
          targetRole: 'SE',
          type: InterviewType.CODING,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JS'],
          duration: 30,
          status: InterviewStatus.DRAFT,
        });
      const interviewId = createRes.body.id;

      // Reject run if status DRAFT (not in progress)
      const runDraftRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/run`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: 'console.log();',
        });
      expect(runDraftRes.status).toBe(400);

      // Patch status to READY before starting
      await request(app.getHttpServer())
        .patch(`/api/v1/interviews/${interviewId}/status`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ status: InterviewStatus.READY });

      // Start interview (makes it IN_PROGRESS)
      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      // Reject cross-user access
      const runCrossRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/run`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: 'console.log();',
        });
      expect(runCrossRes.status).toBe(403);
    });

    it('should submit code, run hidden tests, trigger AI review, and persist completed report results', async () => {
      // 1. Setup started coding interview
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Submit Test',
          targetRole: 'SE',
          type: InterviewType.CODING,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JS'],
          duration: 30,
          status: InterviewStatus.READY,
        });
      const interviewId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      // 2. Submit solution
      const submitRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/submit`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: mockGeneratedCodingProblem.starterCode.JAVASCRIPT,
        });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.submission).toBeDefined();
      expect(submitRes.body.submission.passedTests).toBe(2); // 2 hidden test cases
      expect(submitRes.body.submission.totalTests).toBe(2);
      expect(submitRes.body.review.score).toBe(92);

      // 3. Verify interview is completed and report is persisted
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: { report: true }
      });
      expect(interview?.status).toBe(InterviewStatus.COMPLETED);
      expect(interview?.report).toBeDefined();
      expect(interview?.report?.overallScore).toBe(92);

      // 4. Reject submitting a second time
      const submitAgainRes = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/submit`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: 'console.log(1);',
        });
      expect(submitAgainRes.status).toBe(400);
    });

    it('should validate inputs, rejecting invalid languages and empty codes', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Validation test',
          targetRole: 'SE',
          type: InterviewType.CODING,
          mode: InterviewMode.TEXT,
          experienceLevel: InterviewExperienceLevel.MID,
          skills: ['JS'],
          duration: 30,
          status: InterviewStatus.READY,
        });
      const interviewId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/start`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      // Reject empty sourceCode
      const runEmpty = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/run`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: ProgrammingLanguage.JAVASCRIPT,
          sourceCode: '',
        });
      expect(runEmpty.status).toBe(400);

      // Reject invalid language
      const runInvalidLang = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/run`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          language: 'RUST',
          sourceCode: 'let x = 5;',
        });
      expect(runInvalidLang.status).toBe(400);
    });
  });
});
