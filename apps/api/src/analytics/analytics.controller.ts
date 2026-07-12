import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('summary')
  async getSummary(@Request() req: any) {
    return this.service.getSummary(req.user.id);
  }

  @Get('trends')
  async getTrends(@Request() req: any) {
    return this.service.getTrends(req.user.id);
  }

  @Get('skill-gaps')
  async getSkillGaps(@Request() req: any) {
    return this.service.getSkillGaps(req.user.id);
  }
}
