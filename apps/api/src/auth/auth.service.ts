import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@repo/db';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Hash helper
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Generate tokens helper
  private async generateTokens(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };
    const accessSecret = this.configService.get<string>('jwt.accessSecret') || 'super-secret-access-key';
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') || '15m';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn as any,
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);

    // Default 7 days expiration
    const refreshExpiresDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresDays);

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // Register Candidate user
  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check existing
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        profile: {
          create: {
            fullName: dto.fullName || null,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Strip passwordHash from return
    const safeUser = { ...user } as any;
    delete safeUser.passwordHash;
    return safeUser;
  }

  // Login User
  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  // Refresh Token Session (Rotation & Reuse Detection)
  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid token');
    }

    if (session.isRevoked || session.expiresAt < new Date()) {
      if (session.isRevoked) {
        // Token reuse detected! Revoke all active sessions for this user for security
        await this.prisma.refreshSession.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Rotate: Revoke the current token
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // Issue a new token pair
    return this.generateTokens(session.user.id, session.user.email, session.user.role);
  }

  // Logout (Revocation)
  async logout(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (session) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
    }

    return { success: true };
  }

  // Get current user profile
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const safeUser = { ...user } as any;
    delete safeUser.passwordHash;
    return safeUser;
  }
}
