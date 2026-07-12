import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { RunCodeDto } from './dto/run-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/interviews')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateInterviewDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user.id);
  }

  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('mode') mode?: string,
    @Query('difficulty') difficulty?: string,
    @Query('status') status?: string,
    @Query('company') company?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    return this.service.getHistory(req.user.id, {
      page: pageNum,
      limit: limitNum,
      search,
      mode,
      difficulty,
      status,
      company,
    });
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateInterviewDto) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }

  @Patch(':id/status')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(req.user.id, id, dto.status);
  }

  // --- PHASE 6 INTERVIEW RUNTIME SESSION ENDPOINTS ---

  @Post(':id/start')
  async startInterview(@Request() req: any, @Param('id') id: string) {
    return this.service.startInterview(req.user.id, id);
  }

  @Get(':id/session')
  async getSession(@Request() req: any, @Param('id') id: string) {
    return this.service.getInterviewSession(req.user.id, id);
  }

  @Post(':id/answer')
  async submitAnswer(@Request() req: any, @Param('id') id: string, @Body() dto: SubmitAnswerDto) {
    return this.service.submitAnswer(req.user.id, id, dto.questionId, dto.answerText);
  }

  @Post(':id/next-question')
  async getNextQuestion(@Request() req: any, @Param('id') id: string) {
    return this.service.retryNextQuestion(req.user.id, id);
  }

  @Post(':id/complete')
  async completeInterview(@Request() req: any, @Param('id') id: string) {
    // Transition status directly to COMPLETED
    return this.service.updateStatus(req.user.id, id, 'COMPLETED');
  }

  // --- PHASE 7 AI EVALUATION REPORT ENDPOINTS ---

  @Post(':id/report/generate')
  async generateReport(@Request() req: any, @Param('id') id: string) {
    return this.service.generateReport(req.user.id, id);
  }

  @Get(':id/report')
  async getReport(@Request() req: any, @Param('id') id: string) {
    return this.service.getReport(req.user.id, id);
  }

  @Get(':id/replay')
  async getReplay(@Request() req: any, @Param('id') id: string) {
    return this.service.getReplayData(req.user.id, id);
  }

  // --- PHASE 11B CODING RUNTIME ENDPOINTS ---

  @Post(':id/run')
  async runCode(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RunCodeDto,
  ) {
    return this.service.runCode(req.user.id, id, dto);
  }

  @Post(':id/submit')
  async submitCode(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RunCodeDto,
  ) {
    return this.service.submitCode(req.user.id, id, dto);
  }
}
