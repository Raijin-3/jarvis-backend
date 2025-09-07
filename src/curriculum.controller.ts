import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';
import { CourseService } from './course.service';

@Controller('v1')
export class CurriculumController {
  constructor(private readonly courses: CourseService) {}

  // List all courses as curriculum tracks
  @UseGuards(SupabaseGuard)
  @Get('curriculum')
  async getCurriculum(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    const all: any[] = await this.courses.listCourses(token);
    // Only include published courses for student-facing curriculum
    const published = all.filter((c: any) => (c?.status || 'draft') === 'published');
    const tracks = published.map((c: any) => {
      const subjects = Array.isArray(c.subjects) ? c.subjects : [];
      const modules = subjects.map((s: any) => {
        const items: string[] = [];
        if (Array.isArray(s.modules) && s.modules.length) {
          for (const m of s.modules.slice(0, 3)) items.push(m.title);
          if (items.length === 0) {
            const secs = (s.modules[0]?.sections || []).slice(0, 3);
            for (const sec of secs) items.push(sec.title);
          }
        }
        return { slug: s.id, title: s.title, items };
      });
      return {
        slug: c.id,
        title: c.title,
        level: c.difficulty === 'advanced' ? 'Advanced' : c.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
        description: c.description || '',
        modules,
      };
    });
    return { tracks };
  }

  // Course details mapped to curriculum structure
  @UseGuards(SupabaseGuard)
  @Get('curriculum/:slug')
  async getTrack(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
    const slug = (req.params.slug || '').toString();
    const c: any = await this.courses.courseFull(slug, token);

    if (!c || Object.keys(c).length === 0) return { slug, title: slug, level: 'Beginner', description: '', modules: [] };

    const modules = ([] as any[]).concat(
      ...((c.subjects || []).map((s: any) =>
        (s.modules || []).map((m: any) => ({
          slug: m.id,
          title: m.title,
          subjectId: m.subject_id,
          sections: (m.sections || []).map((sec: any) => ({
            id: sec.id,
            title: sec.title,
            overview: sec.lecture?.content || `${sec.practices?.length || 0} practice(s)${sec.quiz ? ' • quiz' : ''}`,
            lecture: sec.lecture ? { type: 'text', title: sec.lecture.title, content: sec.lecture.content } : undefined,
            quizzes: sec.quiz
              ? [
                  {
                    id: sec.quiz.id,
                    title: sec.quiz.title,
                    type: 'mcq',
                    questions: Array.isArray((sec.quiz as any).questions) ? (sec.quiz as any).questions.length : undefined,
                  },
                ]
              : [],
            exercises: Array.isArray(sec.practices) ? sec.practices.map((p: any) => ({ id: p.id, title: p.title, type: 'sql' })) : [],
          })),
        }))
      ))
    );

    // Include subjects summary for UI
    const subjects = (c.subjects || []).map((s: any) => {
      const mods = (s.modules || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        sectionCount: Array.isArray(m.sections) ? m.sections.length : 0,
      }));
      const moduleCount = mods.length;
      const sectionCount = (s.modules || []).reduce((sum: number, m: any) => sum + ((m.sections || []).length || 0), 0);
      return { id: s.id, title: s.title, moduleCount, sectionCount, modules: mods };
    });

    return {
      slug: c.id,
      title: c.title,
      level: c.difficulty === 'advanced' ? 'Advanced' : c.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
      description: c.description || '',
      modules,
      subjects,
    };
  }
}

