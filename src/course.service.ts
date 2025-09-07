import { Injectable, InternalServerErrorException } from '@nestjs/common';

type UUID = string;

export type CourseRow = {
  id: UUID;
  title: string;
  description?: string | null;
  created_by: UUID;
  created_at: string;
  updated_at: string;
};
export type SubjectRow = {
  id: UUID;
  title: string;
  course_id: UUID;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type ModuleRow = {
  id: UUID;
  title: string;
  subject_id: UUID;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type SectionRow = {
  id: UUID;
  title: string;
  module_id: UUID;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type LectureRow = {
  id: UUID;
  title: string;
  content: string | null;
  section_id: UUID;
  created_at: string;
  updated_at: string;
};
export type PracticeRow = {
  id: UUID;
  title: string;
  content: string | null;
  section_id: UUID;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type QuizRow = {
  id: UUID;
  title: string;
  section_id: UUID;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type QuizQuestionRow = {
  id: UUID;
  quiz_id: UUID;
  type: string;
  text: string;
  order_index?: number | null;
  created_at: string;
  updated_at: string;
};
export type QuizOptionRow = {
  id: UUID;
  question_id: UUID;
  text: string;
  correct: boolean;
};

@Injectable()
export class CourseService {
  private restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  private anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  private headers(userToken?: string) {
    const sk = this.serviceKey;
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt)
      return {
        apikey: sk,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      };
    if (this.anonKey && userToken)
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      };
    throw new InternalServerErrorException(
      'Supabase keys missing for course service',
    );
  }

  private async insert<T>(
    table: string,
    rows: any[],
    userToken?: string,
  ): Promise<T[]> {
    const res = await fetch(`${this.restUrl}/${table}`, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `${table} insert failed: ${res.status} ${await res.text()}`,
      );
    return (await res.json()) as T[];
  }

  private async patchById<T>(
    table: string,
    id: UUID,
    patch: any,
    userToken?: string,
  ): Promise<T> {
    const res = await fetch(`${this.restUrl}/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `${table} update failed: ${res.status} ${await res.text()}`,
      );
    const [row] = (await res.json()) as T[];
    return row;
  }

  private async getNextOrderIndex(
    table: string,
    parentColumn: string,
    parentId: UUID,
    userToken?: string,
  ): Promise<number> {
    const url = `${this.restUrl}/${table}?${parentColumn}=eq.${parentId}&select=order_index&order=order_index.desc.nullslast&limit=1`;
    const res = await fetch(url, { headers: this.headers(userToken), cache: 'no-store' });
    if (!res.ok)
      throw new InternalServerErrorException(
        `${table} select max(order_index) failed: ${res.status} ${await res.text()}`,
      );
    const rows = (await res.json()) as { order_index: number | null }[];
    const top = rows[0]?.order_index;
    return typeof top === 'number' && Number.isFinite(top) ? top + 1 : 0;
  }

  private async deleteById(
    table: string,
    id: UUID,
    userToken?: string,
  ): Promise<void> {
    const res = await fetch(`${this.restUrl}/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: this.headers(userToken),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `${table} delete failed: ${res.status} ${await res.text()}`,
      );
  }

  async createCourse(
    userId: UUID,
    data: { title: string; description?: string | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const [row] = await this.insert<CourseRow>(
      'courses',
      [
        {
          title: data.title,
          description: data.description ?? null,
          created_by: userId,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async listCourses(userToken?: string): Promise<any[]> {
    const courses = await this._getBasicCourses(userToken);
    return Promise.all(courses.map((c) => this.courseFull(c.id, userToken)));
  }

  private async _getBasicCourses(userToken?: string): Promise<CourseRow[]> {
    const url = `${this.restUrl}/courses?select=id,title,description,created_by,created_at,updated_at&order=created_at.desc`;
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `courses select failed: ${res.status} ${await res.text()}`,
      );
    return (await res.json()) as CourseRow[];
  }

  async addSubject(
    courseId: UUID,
    data: { title: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const orderIndex =
      typeof data.order === 'number'
        ? data.order
        : await this.getNextOrderIndex('subjects', 'course_id', courseId, userToken);
    const [row] = await this.insert<SubjectRow>(
      'subjects',
      [
        {
          title: data.title,
          course_id: courseId,
          order_index: orderIndex,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async addModule(
    subjectId: UUID,
    data: { title: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const orderIndex =
      typeof data.order === 'number'
        ? data.order
        : await this.getNextOrderIndex('modules', 'subject_id', subjectId, userToken);
    const [row] = await this.insert<ModuleRow>(
      'modules',
      [
        {
          title: data.title,
          subject_id: subjectId,
          order_index: orderIndex,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async addSection(
    moduleId: UUID,
    data: { title: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const orderIndex =
      typeof data.order === 'number'
        ? data.order
        : await this.getNextOrderIndex('sections', 'module_id', moduleId, userToken);
    const [row] = await this.insert<SectionRow>(
      'sections',
      [
        {
          title: data.title,
          module_id: moduleId,
          order_index: orderIndex,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async upsertLecture(
    sectionId: UUID,
    data: { title: string; content: string },
    userToken?: string,
  ) {
    // Check if exists
    const url = `${this.restUrl}/lectures?section_id=eq.${sectionId}&select=id&limit=1`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (!res.ok)
      throw new InternalServerErrorException(
        `lectures select failed: ${res.status} ${await res.text()}`,
      );
    const rows = (await res.json()) as { id: UUID }[];
    const now = new Date().toISOString();
    if (rows[0]) {
      return this.patchById<LectureRow>(
        'lectures',
        rows[0].id,
        { title: data.title, content: data.content, updated_at: now },
        userToken,
      );
    }
    const [row] = await this.insert<LectureRow>(
      'lectures',
      [
        {
          title: data.title,
          content: data.content,
          section_id: sectionId,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async addPractice(
    sectionId: UUID,
    data: { title: string; content: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const orderIndex =
      typeof data.order === 'number'
        ? data.order
        : await this.getNextOrderIndex(
            'practice_exercises',
            'section_id',
            sectionId,
            userToken,
          );
    const [row] = await this.insert<PracticeRow>(
      'practice_exercises',
      [
        {
          title: data.title,
          content: data.content,
          section_id: sectionId,
          order_index: orderIndex,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    return row;
  }

  async addQuiz(
    sectionId: UUID,
    data: {
      title: string;
      order?: number | null;
      questions?: {
        type: string;
        text: string;
        options?: { text: string; correct?: boolean }[];
      }[];
    },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    // If a quiz already exists for this section, update it instead (upsert behavior)
    const qRes = await fetch(
      `${this.restUrl}/quizzes?section_id=eq.${sectionId}&select=id&limit=1`,
      { headers: this.headers(userToken) },
    );
    if (!qRes.ok)
      throw new InternalServerErrorException(
        `quizzes select failed: ${qRes.status} ${await qRes.text()}`,
      );
    const existing = (await qRes.json()) as { id: UUID }[];
    let quiz: QuizRow;
    if (existing[0]) {
      quiz = await this.patchById<QuizRow>(
        'quizzes',
        existing[0].id,
        {
          title: data.title,
          ...(data.order !== undefined ? { order_index: data.order } : {}),
          updated_at: now,
        },
        userToken,
      );
    } else {
      const orderIndex =
        typeof data.order === 'number'
          ? data.order
          : await this.getNextOrderIndex('quizzes', 'section_id', sectionId, userToken);
      const [q] = await this.insert<QuizRow>(
        'quizzes',
        [
          {
            title: data.title,
            section_id: sectionId,
            order_index: orderIndex,
            created_at: now,
            updated_at: now,
          },
        ],
        userToken,
      );
      quiz = q;
    }

    if (Array.isArray(data.questions) && data.questions.length > 0) {
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        const [qq] = await this.insert<QuizQuestionRow>(
          'quiz_questions',
          [
            {
              quiz_id: quiz.id,
              type: q.type || 'mcq',
              text: q.text,
              order_index: i,
              created_at: now,
              updated_at: now,
            },
          ],
          userToken,
        );
        const opts = (q.options || []).map((o, j) => ({
          question_id: qq.id,
          text: o.text,
          correct: !!o.correct,
        }));
        if (opts.length)
          await this.insert<QuizOptionRow>('quiz_options', opts, userToken);
      }
    }
    return quiz;
  }

  // Quiz Questions CRUD
  async addQuestion(
    quizId: UUID,
    data: { type?: string; text: string; order?: number | null; options?: { text: string; correct?: boolean }[] },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    const orderIndex =
      typeof data.order === 'number'
        ? data.order
        : await this.getNextOrderIndex('quiz_questions', 'quiz_id', quizId, userToken);
    const [question] = await this.insert<QuizQuestionRow>(
      'quiz_questions',
      [
        {
          quiz_id: quizId,
          type: data.type || 'mcq',
          text: data.text,
          order_index: orderIndex,
          created_at: now,
          updated_at: now,
        },
      ],
      userToken,
    );
    if (Array.isArray(data.options) && data.options.length) {
      const opts = data.options.map((o) => ({
        question_id: question.id,
        text: o.text,
        correct: !!o.correct,
      }));
      await this.insert<QuizOptionRow>('quiz_options', opts, userToken);
    }
    return question;
  }

  async updateQuestion(
    id: UUID,
    data: { type?: string; text?: string; order?: number | null },
    userToken?: string,
  ) {
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.type !== undefined) patch.type = data.type;
    if (data.text !== undefined) patch.text = data.text;
    if (data.order !== undefined) patch.order_index = data.order;
    return this.patchById<QuizQuestionRow>('quiz_questions', id, patch, userToken);
  }

  async deleteQuestion(id: UUID, userToken?: string) {
    // Cascade deletes options via FK
    return this.deleteById('quiz_questions', id, userToken);
  }

  // Quiz Options CRUD
  async addOption(
    questionId: UUID,
    data: { text: string; correct?: boolean },
    userToken?: string,
  ) {
    const [row] = await this.insert<QuizOptionRow>(
      'quiz_options',
      [
        {
          question_id: questionId,
          text: data.text,
          correct: !!data.correct,
        },
      ],
      userToken,
    );
    return row;
  }

  async updateOption(
    id: UUID,
    data: { text?: string; correct?: boolean },
    userToken?: string,
  ) {
    const patch: any = {};
    if (data.text !== undefined) patch.text = data.text;
    if (data.correct !== undefined) patch.correct = !!data.correct;
    return this.patchById<QuizOptionRow>('quiz_options', id, patch, userToken);
  }

  async deleteOption(id: UUID, userToken?: string) {
    return this.deleteById('quiz_options', id, userToken);
  }

  async courseFull(courseId: UUID, userToken?: string) {
    // Fetch course
    const cRes = await fetch(
      `${this.restUrl}/courses?id=eq.${courseId}&limit=1`,
      { headers: this.headers(userToken), cache: 'no-store' },
    );
    if (!cRes.ok)
      throw new InternalServerErrorException(
        `courses select failed: ${cRes.status} ${await cRes.text()}`,
      );
    const courses = (await cRes.json()) as CourseRow[];
    const course = courses[0];
    if (!course) return null;

    // Subjects
    const sRes = await fetch(
      `${this.restUrl}/subjects?course_id=eq.${courseId}&order=order_index.asc.nullsfirst`,
      { headers: this.headers(userToken) },
    );
    const subjects = sRes.ok ? ((await sRes.json()) as SubjectRow[]) : [];
    const subjectIds = subjects.map((s) => s.id);

    // Modules
    let modules: ModuleRow[] = [];
    if (subjectIds.length) {
      const mRes = await fetch(
        `${this.restUrl}/modules?subject_id=in.(${subjectIds.join(',')})&order=order_index.asc.nullsfirst`,
        { headers: this.headers(userToken) },
      );
      modules = mRes.ok ? ((await mRes.json()) as ModuleRow[]) : [];
    }
    const moduleIds = modules.map((m) => m.id);

    // Sections
    let sections: SectionRow[] = [];
    if (moduleIds.length) {
      const secRes = await fetch(
        `${this.restUrl}/sections?module_id=in.(${moduleIds.join(',')})&order=order_index.asc.nullsfirst`,
        { headers: this.headers(userToken) },
      );
      sections = secRes.ok ? ((await secRes.json()) as SectionRow[]) : [];
    }
    const sectionIds = sections.map((s) => s.id);

    // Lectures
    let lectures: LectureRow[] = [];
    if (sectionIds.length) {
      const lRes = await fetch(
        `${this.restUrl}/lectures?section_id=in.(${sectionIds.join(',')})`,
        { headers: this.headers(userToken) },
      );
      lectures = lRes.ok ? ((await lRes.json()) as LectureRow[]) : [];
    }

    // Practices
    let practices: PracticeRow[] = [];
    if (sectionIds.length) {
      const pRes = await fetch(
        `${this.restUrl}/practice_exercises?section_id=in.(${sectionIds.join(',')})&order=order_index.asc.nullsfirst`,
        { headers: this.headers(userToken) },
      );
      practices = pRes.ok ? ((await pRes.json()) as PracticeRow[]) : [];
    }

    // Quizzes
    let quizzes: QuizRow[] = [];
    if (sectionIds.length) {
      const qRes = await fetch(
        `${this.restUrl}/quizzes?section_id=in.(${sectionIds.join(',')})`,
        { headers: this.headers(userToken) },
      );
      quizzes = qRes.ok ? ((await qRes.json()) as QuizRow[]) : [];
    }
    const quizIds = quizzes.map((q) => q.id);

    // Questions
    let questions: QuizQuestionRow[] = [];
    if (quizIds.length) {
      const qqRes = await fetch(
        `${this.restUrl}/quiz_questions?quiz_id=in.(${quizIds.join(',')})&order=order_index.asc.nullsfirst`,
        { headers: this.headers(userToken) },
      );
      questions = qqRes.ok ? ((await qqRes.json()) as QuizQuestionRow[]) : [];
    }
    const qIds = questions.map((q) => q.id);

    // Options
    let options: QuizOptionRow[] = [];
    if (qIds.length) {
      const oRes = await fetch(
        `${this.restUrl}/quiz_options?question_id=in.(${qIds.join(',')})`,
        { headers: this.headers(userToken) },
      );
      options = oRes.ok ? ((await oRes.json()) as QuizOptionRow[]) : [];
    }

    // Build hierarchy
    const sectionMap = Object.fromEntries(
      sections.map((s) => [
        s.id,
        {
          ...s,
          lecture: null as any,
          practices: [] as PracticeRow[],
          quiz: null as any,
        },
      ]),
    );
    lectures.forEach((l) => {
      const s = sectionMap[l.section_id];
      if (s) s.lecture = l;
    });
    practices.forEach((p) => {
      const s = sectionMap[p.section_id];
      if (s) s.practices.push(p);
    });
    const quizMap = Object.fromEntries(
      quizzes.map((q) => [q.id, { ...q, questions: [] as any[] }]),
    );
    const sectionQuizMap: Record<string, UUID> = {};
    quizzes.forEach((q) => {
      sectionQuizMap[q.section_id] = q.id;
    });
    questions.forEach((qq) => {
      const q = quizMap[qq.quiz_id];
      if (q) q.questions.push({ ...qq, options: [] as QuizOptionRow[] });
    });
    options.forEach((op) => {
      for (const q of Object.values(quizMap) as any[]) {
        const found = q.questions.find((qq: any) => qq.id === op.question_id);
        if (found) {
          found.options.push(op);
          break;
        }
      }
    });
    // Attach quiz objects to sections
    Object.keys(sectionMap).forEach((sid) => {
      const qid = sectionQuizMap[sid];
      if (qid) (sectionMap as any)[sid].quiz = quizMap[qid] || null;
    });

    const modulesBySubject: Record<string, any[]> = {};
    modules.forEach((m) => {
      (modulesBySubject[m.subject_id] ||= []).push({
        ...m,
        sections: [] as any[],
      });
    });
    const moduleObjMap: Record<string, any> = {};
    Object.values(modulesBySubject)
      .flat()
      .forEach((mo: any) => {
        moduleObjMap[mo.id] = mo;
      });
    Object.values(sectionMap).forEach((sec: any) => {
      const mo = moduleObjMap[sec.module_id];
      if (mo) mo.sections.push(sec);
    });
    const subjectsOut = subjects.map((s) => ({
      ...s,
      modules: modulesBySubject[s.id] || [],
    }));

    return { ...course, subjects: subjectsOut };
  }

  // Updates
  async updateCourse(
    id: UUID,
    data: {
      title?: string;
      description?: string | null;
      status?: string;
      difficulty?: string;
      category?: string | null;
      duration?: number | null;
      enrolled_count?: number | null;
    },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<CourseRow & any>(
      'courses',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
        ...(data.enrolled_count !== undefined ? { enrolled_count: data.enrolled_count } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  async updateSubject(
    id: UUID,
    data: { title?: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<SubjectRow>(
      'subjects',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.order !== undefined ? { order_index: data.order } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  async updateModule(
    id: UUID,
    data: { title?: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<ModuleRow>(
      'modules',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.order !== undefined ? { order_index: data.order } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  async updateSection(
    id: UUID,
    data: { title?: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<SectionRow>(
      'sections',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.order !== undefined ? { order_index: data.order } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  async updatePractice(
    id: UUID,
    data: { title?: string; content?: string | null; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<PracticeRow>(
      'practice_exercises',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.order !== undefined ? { order_index: data.order } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  async updateQuiz(
    id: UUID,
    data: { title?: string; order?: number | null },
    userToken?: string,
  ) {
    const now = new Date().toISOString();
    return this.patchById<QuizRow>(
      'quizzes',
      id,
      {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.order !== undefined ? { order_index: data.order } : {}),
        updated_at: now,
      },
      userToken,
    );
  }

  // Deletes
  async deleteCourse(id: UUID, userToken?: string) {
    return this.deleteById('courses', id, userToken);
  }
  async deleteSubject(id: UUID, userToken?: string) {
    return this.deleteById('subjects', id, userToken);
  }
  async deleteModule(id: UUID, userToken?: string) {
    return this.deleteById('modules', id, userToken);
  }
  async deleteSection(id: UUID, userToken?: string) {
    return this.deleteById('sections', id, userToken);
  }
  async deletePractice(id: UUID, userToken?: string) {
    return this.deleteById('practice_exercises', id, userToken);
  }
  async deleteQuiz(id: UUID, userToken?: string) {
    return this.deleteById('quizzes', id, userToken);
  }
}
