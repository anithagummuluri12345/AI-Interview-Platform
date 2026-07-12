import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { ResumeParsingStatus } from '@repo/db';

jest.mock('pdf-parse', () => {
  const mockFunc = jest.fn().mockImplementation((buffer: Buffer) => {
    const content = buffer ? buffer.toString() : '';
    if (content === 'CORRUPT_PDF') {
      throw new Error('Invalid PDF structure');
    }
    if (content === 'EMPTY_PDF') {
      return Promise.resolve({ text: '' });
    }
    return Promise.resolve({ text: 'React NestJS PostgreSQL Developer' });
  });

  return {
    __esModule: true,
    default: mockFunc,
  };
});

describe('ResumesController (Integration & Phase 9 Resume Parsing)', () => {
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

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfMock = require('pdf-parse');
    pdfMock.default.mockImplementation((buffer: Buffer) => {
      const content = buffer ? buffer.toString() : '';
      if (content === 'CORRUPT_PDF') {
        throw new Error('Invalid PDF structure');
      }
      if (content === 'EMPTY_PDF') {
        return Promise.resolve({ text: '' });
      }
      return Promise.resolve({ text: 'React NestJS PostgreSQL Developer' });
    });

    // Clean tables in correct order
    await prisma.evaluation.deleteMany();
    await prisma.interviewReport.deleteMany();
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
    await prisma.evaluation.deleteMany();
    await prisma.interviewReport.deleteMany();
    await prisma.answer.deleteMany();
    await prisma.question.deleteMany();
    await prisma.interviewRound.deleteMany();
    await prisma.interview.deleteMany();
    await prisma.resume.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /api/v1/resumes/upload', () => {
    it('should successfully upload and parse a valid PDF file', async () => {
      // Mock Gemini structured extraction
      mockAiProvider.generateStructured.mockResolvedValueOnce({
        skills: ['React', 'NestJS', 'PostgreSQL'],
        experienceYears: 2,
        education: [
          { institution: 'MIT', degree: 'BS', field: 'CS', graduationYear: '2024' }
        ],
        projects: [
          { name: 'App X', description: 'Web app', technologies: ['React'] }
        ],
        experience: [
          { company: 'Corp Y', role: 'Intern', duration: '3 months', technologies: ['NestJS'] }
        ]
      });

      const pdfBuffer = Buffer.from('VALID_PDF');

      const res = await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', pdfBuffer, 'resume.pdf')
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.originalFileName).toBe('resume.pdf');
      expect(res.body.parsingStatus).toBe(ResumeParsingStatus.COMPLETED);
      expect(res.body.structuredData.skills).toContain('React');
      expect(res.body.structuredData.experienceYears).toBe(2);

      // Verify DB row
      const dbResume = await prisma.resume.findUnique({ where: { id: res.body.id } });
      expect(dbResume).toBeDefined();
      expect(dbResume?.parsingStatus).toBe(ResumeParsingStatus.COMPLETED);
    });

    it('should reject file upload exceeding size limit (5 MB)', async () => {
      // 6 MB buffer
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024);

      await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', hugeBuffer, 'large_resume.pdf')
        .expect(413); // Multer / NestJS payload size limit rejection (413 Payload Too Large)
    });

    it('should reject file with invalid MIME type', async () => {
      const txtBuffer = Buffer.from('Some plain text that is not a PDF');

      const res = await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', txtBuffer, 'resume.txt')
        .expect(400);

      expect(res.body.message).toContain('Only PDF files are supported');
    });

    it('should reject file when extension and MIME type mismatch', async () => {
      const txtBuffer = Buffer.from('Renamed text file');

      await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', txtBuffer, { filename: 'resume.pdf', contentType: 'text/plain' })
        .expect(400);
    });

    it('should reject unauthorized access without JWT token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .attach('file', Buffer.from('abc'), 'resume.pdf')
        .expect(401);
    });

    it('should reject scanned/image-only PDFs (no readable text)', async () => {
      const emptyPdfBuffer = Buffer.from('EMPTY_PDF');

      const res = await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', emptyPdfBuffer, 'empty.pdf')
        .expect(400);

      expect(res.body.message).toBe('No readable text could be extracted from this PDF.');
    });

    it('should use tolerant defaults if Gemini returns empty structured schema', async () => {
      // Return empty/null parameters from Gemini
      mockAiProvider.generateStructured.mockResolvedValueOnce({});

      const pdfBuffer = Buffer.from('VALID_PDF');

      const res = await request(app.getHttpServer())
        .post('/api/v1/resumes/upload')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('file', pdfBuffer, 'resume.pdf')
        .expect(201);

      expect(res.body.structuredData.skills).toEqual([]);
      expect(res.body.structuredData.experienceYears).toBe(0);
      expect(res.body.structuredData.education).toEqual([]);
      expect(res.body.structuredData.projects).toEqual([]);
      expect(res.body.structuredData.experience).toEqual([]);
    });
  });

  describe('GET & DELETE /api/v1/resumes', () => {
    let resumeId: string;

    beforeEach(async () => {
      // Seed a resume owned by Candidate A
      const resume = await prisma.resume.create({
        data: {
          userId: candidateAId,
          originalFileName: 'resumeA.pdf',
          storageKey: 'keyA.pdf',
          mimeType: 'application/pdf',
          fileSize: 12345,
          parsingStatus: ResumeParsingStatus.COMPLETED,
          rawText: 'Candidate A CV text content',
          structuredData: { skills: ['React'] },
        },
      });
      resumeId = resume.id;
    });

    it('should retrieve list of resumes for Candidate A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/resumes')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].originalFileName).toBe('resumeA.pdf');
    });

    it('should reject retrieval of Candidate A\'s resume by Candidate B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(403);
    });

    it('should reject delete of Candidate A\'s resume by Candidate B', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .expect(403);
    });

    it('should archive instead of hard delete a resume if it is referenced by an existing interview', async () => {
      // Link resume to a new interview
      await prisma.interview.create({
        data: {
          userId: candidateAId,
          title: 'Senior Prep Session',
          targetRole: 'Architect',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'SENIOR',
          skills: ['React'],
          duration: 30,
          resumeId: resumeId,
        },
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      // Verify DB row still exists but has isArchived=true
      const dbResume = await prisma.resume.findUnique({ where: { id: resumeId } });
      expect(dbResume).toBeDefined();
      expect(dbResume?.isArchived).toBe(true);

      // Verify it is excluded from GET list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/resumes')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);
      expect(listRes.body.find((r: any) => r.id === resumeId)).toBeUndefined();
    });

    it('should successfully delete resume when not referenced', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .expect(200);

      const dbCheck = await prisma.resume.findUnique({ where: { id: resumeId } });
      expect(dbCheck).toBeNull();
    });
  });

  describe('Interview Creation with Resume', () => {
    let resumeId: string;

    beforeEach(async () => {
      const resume = await prisma.resume.create({
        data: {
          userId: candidateAId,
          originalFileName: 'resumeA.pdf',
          storageKey: 'keyA.pdf',
          mimeType: 'application/pdf',
          fileSize: 12345,
          parsingStatus: ResumeParsingStatus.COMPLETED,
          rawText: 'Candidate A CV text content',
          structuredData: { skills: ['React'] },
        },
      });
      resumeId = resume.id;
    });

    it('should allow interview creation without a resume', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Intro Interview',
          targetRole: 'Software Engineer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'JUNIOR',
          skills: ['JS'],
          duration: 30,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.resumeId).toBeNull();
    });

    it('should allow interview creation with owned resume', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'Resume Interview',
          targetRole: 'React Developer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          resumeId: resumeId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.resumeId).toBe(resumeId);
    });

    it('should reject interview creation using another user\'s resume', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateBToken}`) // Candidate B tries to use Candidate A's resume
        .send({
          title: 'Hack Interview',
          targetRole: 'Hacker',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['Scythe'],
          duration: 30,
          resumeId: resumeId,
        })
        .expect(403); // ForbiddenException from validateResumeOwnership
    });

    it('should reject interview creation using an archived resume', async () => {
      // Archive the resume first
      await prisma.resume.update({
        where: { id: resumeId },
        data: { isArchived: true },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          title: 'New Resume Interview',
          targetRole: 'React Developer',
          type: 'TECHNICAL',
          mode: 'TEXT',
          experienceLevel: 'MID',
          skills: ['React'],
          duration: 30,
          resumeId: resumeId,
        })
        .expect(400);

      expect(res.body.message).toContain('Selected resume has been deleted or archived');
    });
  });
});
