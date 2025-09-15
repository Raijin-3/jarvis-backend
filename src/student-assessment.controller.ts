import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  Put,
  Query,
  Req, 
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';
import { StudentAssessmentService } from './student-assessment.service';

export interface StartAssessmentDto {
  template_id: string;
}

export interface SubmitResponseDto {
  session_token: string;
  question_id: string;
  selected_option_id?: string; // for MCQ questions
  text_answer?: string; // for text questions
  time_spent_seconds: number;
}

export interface FinishAssessmentDto {
  session_token: string;
}

@Controller('v1/student/assessments')
@UseGuards(SupabaseGuard)
export class StudentAssessmentController {
  constructor(private readonly studentAssessmentService: StudentAssessmentService) {}

  // ========== Assessment Discovery ==========

  @Get('available')
  async getAvailableAssessments(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getAvailableAssessments(req.user.id, token);
  }

  @Get('templates/:id')
  async getAssessmentTemplate(
    @Param('id') templateId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getAssessmentTemplate(templateId, req.user.id, token);
  }

  @Get('templates/:id/preview')
  async previewAssessment(
    @Param('id') templateId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.previewAssessment(templateId, token);
  }

  // ========== Assessment Session Management ==========

  @Post('start')
  async startAssessment(
    @Body() startAssessmentDto: StartAssessmentDto,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    
    // Check if student can start this assessment
    await this.validateStudentCanStartAssessment(startAssessmentDto.template_id, req.user.id, token);
    
    return this.studentAssessmentService.startAssessment(
      startAssessmentDto.template_id,
      req.user.id,
      token
    );
  }

  @Get('session/:token')
  async getAssessmentSession(
    @Param('token') sessionToken: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getAssessmentSession(sessionToken, req.user.id, token);
  }

  @Get('session/:token/question/:questionId')
  async getQuestionForSession(
    @Param('token') sessionToken: string,
    @Param('questionId') questionId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getQuestionForSession(
      sessionToken,
      questionId,
      req.user.id,
      token
    );
  }

  @Post('response')
  async submitResponse(
    @Body() submitResponseDto: SubmitResponseDto,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    
    // Validate response data
    this.validateResponseData(submitResponseDto);
    
    return this.studentAssessmentService.submitResponse(
      submitResponseDto,
      req.user.id,
      token
    );
  }

  @Put('session/:token/pause')
  async pauseAssessment(
    @Param('token') sessionToken: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.pauseAssessment(sessionToken, req.user.id, token);
  }

  @Put('session/:token/resume')
  async resumeAssessment(
    @Param('token') sessionToken: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.resumeAssessment(sessionToken, req.user.id, token);
  }

  @Post('finish')
  async finishAssessment(
    @Body() finishAssessmentDto: FinishAssessmentDto,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.finishAssessment(
      finishAssessmentDto.session_token,
      req.user.id,
      token
    );
  }

  // ========== Assessment History ==========

  @Get('history')
  async getAssessmentHistory(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('template_id') template_id?: string
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getAssessmentHistory(
      req.user.id,
      { page, limit, status, template_id },
      token
    );
  }

  @Get('results/:sessionId')
  async getAssessmentResults(
    @Param('sessionId') sessionId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getAssessmentResults(sessionId, req.user.id, token);
  }

  @Get('results/:sessionId/detailed')
  async getDetailedResults(
    @Param('sessionId') sessionId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getDetailedResults(sessionId, req.user.id, token);
  }

  // ========== Progress Tracking ==========

  @Get('progress/overview')
  async getProgressOverview(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getProgressOverview(req.user.id, token);
  }

  @Get('progress/category/:categoryId')
  async getCategoryProgress(
    @Param('categoryId') categoryId: string,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getCategoryProgress(categoryId, req.user.id, token);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Req() req: any,
    @Query('category_id') categoryId?: string,
    @Query('time_period') timePeriod: string = 'all_time',
    @Query('limit') limit: number = 10
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getLeaderboard(
      req.user.id,
      { categoryId, timePeriod, limit },
      token
    );
  }

  // ========== Analytics for Students ==========

  @Get('analytics/performance')
  async getPerformanceAnalytics(
    @Query('days') days: number = 30,
    @Req() req: any
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getPerformanceAnalytics(req.user.id, days, token);
  }

  @Get('analytics/strengths-weaknesses')
  async getStrengthsAndWeaknesses(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return this.studentAssessmentService.getStrengthsAndWeaknesses(req.user.id, token);
  }

  // ========== Validation Methods ==========

  private async validateStudentCanStartAssessment(
    templateId: string,
    studentId: string,
    userToken?: string
  ): Promise<void> {
    // Check if template exists and is active
    const template = await this.studentAssessmentService.getAssessmentTemplate(
      templateId,
      studentId,
      userToken
    );

    if (!template.is_active) {
      throw new ForbiddenException('This assessment is not currently available');
    }

    // Check if student has an active session for this template
    const activeSessions = await this.studentAssessmentService.getActiveSessionsForTemplate(
      templateId,
      studentId,
      userToken
    );

    if (activeSessions.length > 0) {
      throw new BadRequestException('You already have an active session for this assessment');
    }

    // Check attempt limits
    if (template.max_attempts) {
      const attemptCount = await this.studentAssessmentService.getAttemptCount(
        templateId,
        studentId,
        userToken
      );

      if (attemptCount >= template.max_attempts) {
        throw new ForbiddenException(
          `You have reached the maximum number of attempts (${template.max_attempts}) for this assessment`
        );
      }
    }
  }

  private validateResponseData(responseDto: SubmitResponseDto): void {
    if (!responseDto.session_token?.trim()) {
      throw new BadRequestException('Session token is required');
    }

    if (!responseDto.question_id?.trim()) {
      throw new BadRequestException('Question ID is required');
    }

    if (!responseDto.selected_option_id && !responseDto.text_answer) {
      throw new BadRequestException('Either selected_option_id or text_answer is required');
    }

    if (responseDto.selected_option_id && responseDto.text_answer) {
      throw new BadRequestException('Cannot provide both selected_option_id and text_answer');
    }

    if (responseDto.time_spent_seconds < 0) {
      throw new BadRequestException('Time spent cannot be negative');
    }
  }
}