import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@repo/db';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    // Clear db tables in reverse dependency order for isolation
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('Registration', () => {
    it('should register a candidate successfully and return safe user fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'CANDIDATE@example.com', // test email normalization
          password: 'securePassword123',
          fullName: 'Test Candidate',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('candidate@example.com'); // normalized
      expect(res.body.role).toBe(UserRole.CANDIDATE);
      expect(res.body).not.toHaveProperty('passwordHash'); // safe serialization
      expect(res.body.profile.fullName).toBe('Test Candidate');
    });

    it('should reject duplicate registrations', async () => {
      // Register first user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'securePassword123',
        })
        .expect(201);

      // Register duplicate
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'differentPassword123',
        })
        .expect(409); // Conflict
    });

    it('should reject weak or invalid inputs', async () => {
      // Weak password
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'weak',
        })
        .expect(400);

      // Invalid email
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'validPassword123',
        })
        .expect(400);
    });
  });

  describe('Login & Serialization', () => {
    beforeEach(async () => {
      // Setup candidate user for login tests
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'login@example.com',
          password: 'loginPassword123',
        });
    });

    it('should login successfully and return access and refresh tokens without passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'loginPassword123',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash'); // Safe serialization
    });

    it('should reject invalid credentials with generic message', async () => {
      // Wrong password
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongPassword',
        })
        .expect(401);
      expect(res1.body.message).toBe('Invalid credentials');

      // Non-existent email
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'loginPassword123',
        })
        .expect(401);
      expect(res2.body.message).toBe('Invalid credentials');
    });
  });

  describe('Protected Routes & Authorization', () => {
    let candidateToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // 1. Create and login Candidate
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'candidate@example.com',
          password: 'candidatePassword123',
        });
      const loginCand = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'candidate@example.com',
          password: 'candidatePassword123',
        });
      candidateToken = loginCand.body.accessToken;

      // 2. Create and login Admin (directly via db to bypass register role restrictions)
      const adminPasswordHash = await bcrypt.hash('adminPassword123', 10);
      await prisma.user.create({
        data: {
          email: 'admin@example.com',
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
        },
      });
      const loginAdmin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'adminPassword123',
        });
      adminToken = loginAdmin.body.accessToken;
    });

    it('should block protected routes without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('should allow protected route with valid token and serialize output safely', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(res.body.email).toBe('candidate@example.com');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should enforce role authorization and restrict access appropriately', async () => {
      // Candidate accessing admin-only should fail
      await request(app.getHttpServer())
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      // Admin accessing admin-only should pass
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res1.body.message).toBe('admin access granted');

      // Admin accessing candidate-only should fail
      await request(app.getHttpServer())
        .get('/api/v1/auth/candidate-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      // Candidate accessing candidate-only should pass
      const res2 = await request(app.getHttpServer())
        .get('/api/v1/auth/candidate-only')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);
      expect(res2.body.message).toBe('candidate access granted');
    });
  });

  describe('Token Rotation & Revocation & Logout', () => {
    let rToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'session@example.com',
          password: 'sessionPassword123',
        });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'session@example.com',
          password: 'sessionPassword123',
        });
      rToken = login.body.refreshToken;
    });

    it('should rotate refresh token and reject the old rotated token', async () => {
      // 1. Rotate refresh token once
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      const newRToken = res.body.refreshToken;

      // 2. Reuse old rotated token; should fail due to rotation reuse check
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rToken })
        .expect(401);

      // 3. Reused token should trigger user-wide session revocation; new token should now also fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRToken })
        .expect(401);
    });

    it('should logout and revoke the token session safely', async () => {
      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: rToken })
        .expect(200);

      // Refreshing with logged out token should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rToken })
        .expect(401);

      // Repeated logout requests must be safe (200 Success)
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: rToken })
        .expect(200);
    });
  });
});
