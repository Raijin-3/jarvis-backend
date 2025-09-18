import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';
import { AssessmentService } from './assessment.service';

@Controller('v1/assessments')
export class AssessmentController {
  constructor(private readonly svc: AssessmentService) {}

  @UseGuards(SupabaseGuard)
  @Post('start')
  async start(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const row = await this.svc.start(req.user.id, token);
    const questions = await this.svc.getQuestionSet(token);
    return { assessment_id: row.id, questions };
  }

  @UseGuards(SupabaseGuard)
  @Post('finish')
  async finish(
    @Req() req: any,
    @Body()
    body: {
      assessment_id: string;
      responses: {
        q_index: number;
        question_id: string;
        answer: string | null;
      }[];
    },
  ) {
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const summary = await this.svc.finish(
      req.user.id,
      body.assessment_id,
      body.responses || [],
      token,
    );
    return summary;
  }

  @UseGuards(SupabaseGuard)
  @Get('latest')
  async latest(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const row = await this.svc.latest(req.user.id, token);
    return { latest: row };
  }
}


