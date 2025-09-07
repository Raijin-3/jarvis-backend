import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';
import { ProfilesService } from './profiles.service';
import { CourseService } from './course.service';

function assertString(v: any, name: string) {
  if (typeof v !== 'string' || v.trim() === '')
    throw new Error(`${name} is required`);
  return v.trim();
}

@Controller('v1')
export class CourseController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly courses: CourseService,
  ) {}

  private async ensureAdmin(req: any): Promise<string> {
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const profile = await this.profiles.ensureProfile(req.user.id, token);
    if ((profile.role || '').toLowerCase() !== 'admin')
      throw new ForbiddenException('Admin access required');
    return token || '';
  }

  // List courses
  @UseGuards(SupabaseGuard)
  @Get('courses')
  async list(@Req() req: any) {
    await this.ensureAdmin(req);
    return await this.courses.listCourses(
      (req.headers.authorization as string | undefined)?.replace(
        /^Bearer\s+/i,
        '',
      ),
    );
  }

  // Create course
  @UseGuards(SupabaseGuard)
  @Post('courses')
  async createCourse(@Req() req: any, @Body() body: any) {
    const token = await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const description =
      typeof body?.description === 'string' ? body.description : null;
    return await this.courses.createCourse(
      req.user.id,
      { title, description },
      token,
    );
  }

  // Update course
  @UseGuards(SupabaseGuard)
  @Put('courses/:id')
  async updateCourse(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const description =
      typeof body?.description === 'string'
        ? body.description
        : body?.description === null
          ? null
          : undefined;
    const status = typeof body?.status === 'string' ? body.status : undefined;
    const difficulty = typeof body?.difficulty === 'string' ? body.difficulty : undefined;
    const category =
      typeof body?.category === 'string' ? body.category : body?.category === null ? null : undefined;
    const duration =
      typeof body?.duration === 'number' ? body.duration : body?.duration === null ? null : undefined;
    const enrolled_count =
      typeof body?.enrolled_count === 'number'
        ? body.enrolled_count
        : body?.enrolled_count === null
          ? null
          : undefined;
    return await this.courses.updateCourse(
      id,
      { title, description, status, difficulty, category, duration, enrolled_count },
      token,
    );
  }

  // Delete course
  @UseGuards(SupabaseGuard)
  @Delete('courses/:id')
  async deleteCourse(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteCourse(id, token);
    return { ok: true };
  }

  // Add subject
  @UseGuards(SupabaseGuard)
  @Post('courses/:courseId/subjects')
  async addSubject(
    @Req() req: any,
    @Param('courseId') courseId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const order = typeof body?.order === 'number' ? body.order : null;
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    return await this.courses.addSubject(courseId, { title, order }, token);
  }

  // Add module
  @UseGuards(SupabaseGuard)
  @Post('subjects/:subjectId/modules')
  async addModule(
    @Req() req: any,
    @Param('subjectId') subjectId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const order = typeof body?.order === 'number' ? body.order : null;
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    return await this.courses.addModule(subjectId, { title, order }, token);
  }

  // Update subject
  @UseGuards(SupabaseGuard)
  @Put('subjects/:id')
  async updateSubject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updateSubject(id, { title, order }, token);
  }

  // Delete subject
  @UseGuards(SupabaseGuard)
  @Delete('subjects/:id')
  async deleteSubject(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteSubject(id, token);
    return { ok: true };
  }

  // Add section
  @UseGuards(SupabaseGuard)
  @Post('modules/:moduleId/sections')
  async addSection(
    @Req() req: any,
    @Param('moduleId') moduleId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const order = typeof body?.order === 'number' ? body.order : null;
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    return await this.courses.addSection(moduleId, { title, order }, token);
  }

  // Update module
  @UseGuards(SupabaseGuard)
  @Put('modules/:id')
  async updateModule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updateModule(id, { title, order }, token);
  }

  // Delete module
  @UseGuards(SupabaseGuard)
  @Delete('modules/:id')
  async deleteModule(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteModule(id, token);
    return { ok: true };
  }

  // Update section
  @UseGuards(SupabaseGuard)
  @Put('sections/:id')
  async updateSection(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updateSection(id, { title, order }, token);
  }

  // Delete section
  @UseGuards(SupabaseGuard)
  @Delete('sections/:id')
  async deleteSection(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteSection(id, token);
    return { ok: true };
  }

  // Upsert lecture
  @UseGuards(SupabaseGuard)
  @Post('sections/:sectionId/lecture')
  async upsertLecture(
    @Req() req: any,
    @Param('sectionId') sectionId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const content = assertString(body?.content ?? '', 'content');
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    return await this.courses.upsertLecture(
      sectionId,
      { title, content },
      token,
    );
  }

  // Add practice exercise
  @UseGuards(SupabaseGuard)
  @Post('sections/:sectionId/practice-exercises')
  async addPractice(
    @Req() req: any,
    @Param('sectionId') sectionId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    try {
      const title = assertString(body?.title, 'title');
      const content = assertString(body?.content ?? '', 'content');
      const order = typeof body?.order === 'number' ? body.order : null;
      const token = (req.headers.authorization as string | undefined)?.replace(
        /^Bearer\s+/i,
        '',
      );

      return await this.courses.addPractice(
        sectionId,
        { title, content, order },
        token,
      );
    } catch (e) {
      console.error('❌ addPractice failed', { sectionId, body, error: e });
      throw e; // Nest will log stack trace
    }
  }

  // Update practice
  @UseGuards(SupabaseGuard)
  @Put('practice-exercises/:id')
  async updatePractice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const content =
      typeof body?.content === 'string'
        ? body.content
        : body?.content === null
          ? null
          : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updatePractice(
      id,
      { title, content, order },
      token,
    );
  }

  // Delete practice
  @UseGuards(SupabaseGuard)
  @Delete('practice-exercises/:id')
  async deletePractice(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deletePractice(id, token);
    return { ok: true };
  }

  // Add quiz
  @UseGuards(SupabaseGuard)
  @Post('sections/:sectionId/quiz')
  async addQuiz(
    @Req() req: any,
    @Param('sectionId') sectionId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const title = assertString(body?.title, 'title');
    const order = typeof body?.order === 'number' ? body.order : null;
    const questions = Array.isArray(body?.questions) ? body.questions : [];
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    return await this.courses.addQuiz(
      sectionId,
      { title, order, questions },
      token,
    );
  }

  // Update quiz (metadata only)
  @UseGuards(SupabaseGuard)
  @Put('quizzes/:id')
  async updateQuiz(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updateQuiz(id, { title, order }, token);
  }

  // Delete quiz
  @UseGuards(SupabaseGuard)
  @Delete('quizzes/:id')
  async deleteQuiz(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteQuiz(id, token);
    return { ok: true };
  }

  // ==== Quiz Questions CRUD ====
  @UseGuards(SupabaseGuard)
  @Post('quizzes/:quizId/questions')
  async addQuestion(
    @Req() req: any,
    @Param('quizId') quizId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const text = assertString(body?.text, 'text');
    const type = typeof body?.type === 'string' ? body.type : 'mcq';
    const order = typeof body?.order === 'number' ? body.order : null;
    const options = Array.isArray(body?.options) ? body.options : [];
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return await this.courses.addQuestion(quizId, { text, type, order, options }, token);
  }

  @UseGuards(SupabaseGuard)
  @Put('questions/:id')
  async updateQuestion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const type = typeof body?.type === 'string' ? body.type : undefined;
    const text = typeof body?.text === 'string' ? body.text : undefined;
    const order = typeof body?.order === 'number' ? body.order : undefined;
    return await this.courses.updateQuestion(id, { type, text, order }, token);
  }

  @UseGuards(SupabaseGuard)
  @Delete('questions/:id')
  async deleteQuestion(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteQuestion(id, token);
    return { ok: true };
  }

  // ==== Quiz Options CRUD ====
  @UseGuards(SupabaseGuard)
  @Post('questions/:questionId/options')
  async addOption(
    @Req() req: any,
    @Param('questionId') questionId: string,
    @Body() body: any,
  ) {
    await this.ensureAdmin(req);
    const text = assertString(body?.text, 'text');
    const correct = !!body?.correct;
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    return await this.courses.addOption(questionId, { text, correct }, token);
  }

  @UseGuards(SupabaseGuard)
  @Put('options/:id')
  async updateOption(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const token = await this.ensureAdmin(req);
    const text = typeof body?.text === 'string' ? body.text : undefined;
    const correct = typeof body?.correct === 'boolean' ? body.correct : undefined;
    return await this.courses.updateOption(id, { text, correct }, token);
  }

  @UseGuards(SupabaseGuard)
  @Delete('options/:id')
  async deleteOption(@Req() req: any, @Param('id') id: string) {
    const token = await this.ensureAdmin(req);
    await this.courses.deleteOption(id, token);
    return { ok: true };
  }

  // Full hierarchy
  @UseGuards(SupabaseGuard)
  @Get('courses/:id/full')
  async full(@Req() req: any, @Param('id') id: string) {
    await this.ensureAdmin(req);
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const data = await this.courses.courseFull(id, token);
    return data ?? {};
  }
}
