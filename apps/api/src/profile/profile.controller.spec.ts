import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ExperienceLevel } from '@repo/db';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('ProfileController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;

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
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create a test user and login to get JWT
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'profiletest@example.com',
        password: 'securePassword123',
        fullName: 'Original Name',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'profiletest@example.com',
        password: 'securePassword123',
      });

    token = loginRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    userId = meRes.body.id;
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/v1/profile/me', () => {
    it('should return profile information for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userId);
      expect(res.body.fullName).toBe('Original Name');
    });

    it('should block unauthorized requests without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/profile/me')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/profile/me', () => {
    it('should successfully update valid profile fields', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Updated Name',
          headline: 'Full Stack Engineer',
          bio: 'Writing code every day.',
          experienceLevel: ExperienceLevel.SENIOR,
          targetRoles: ['Frontend Developer', 'Backend Architect'],
        })
        .expect(200);

      expect(res.body.fullName).toBe('Updated Name');
      expect(res.body.headline).toBe('Full Stack Engineer');
      expect(res.body.bio).toBe('Writing code every day.');
      expect(res.body.experienceLevel).toBe(ExperienceLevel.SENIOR);
      expect(res.body.targetRoles).toEqual(['Frontend Developer', 'Backend Architect']);
    });

    it('should reject invalid values with 400 Bad Request', async () => {
      // Invalid enum experience level
      await request(app.getHttpServer())
        .patch('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          experienceLevel: 'INVALID_ENUM_VALUE',
        })
        .expect(400);

      // Target roles not an array
      await request(app.getHttpServer())
        .patch('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          targetRoles: 'NotAnArray',
        })
        .expect(400);
    });

    it('should not allow updating role through profile endpoints', async () => {
      // Sending role in payload
      await request(app.getHttpServer())
        .patch('/api/v1/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'ADMIN',
        })
        .expect(200); // Controller whitelist ignores unmapped properties like role

      // Verify that user role remains CANDIDATE in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user?.role).toBe('CANDIDATE');
    });
  });
});
