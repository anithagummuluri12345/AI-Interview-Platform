import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Verify profile exists
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        fullName: dto.fullName !== undefined ? dto.fullName : undefined,
        headline: dto.headline !== undefined ? dto.headline : undefined,
        bio: dto.bio !== undefined ? dto.bio : undefined,
        experienceLevel: dto.experienceLevel !== undefined ? dto.experienceLevel : undefined,
        targetRoles: dto.targetRoles !== undefined ? dto.targetRoles : undefined,
      },
    });
  }
}
