import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, dto);
  }
}
