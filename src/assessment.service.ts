import { Injectable, InternalServerErrorException } from '@nestjs/common';

type AssessmentRow = {
  id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  passed: boolean | null;
};

type ResponseRow = {
  id: string;
  assessment_id: string;
  q_index: number;
  question_id: string;
  answer_text: string | null;
  correct: boolean;
};

type QuestionType = 'mcq' | 'text';

interface DbQuestionRow {
  id: string;
  question_type: string;
  question_text: string;
  question_image_url?: string | null;
  points_value?: number | null;
  time_limit_seconds?: number | null;
  is_active?: boolean | null;
}

interface DbOptionRow {
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index?: number | null;
}

interface DbTextAnswerRow {
  question_id: string;
  correct_answer: string;
  case_sensitive: boolean;
  exact_match: boolean;
  alternate_answers?: string[] | null;
  keywords?: string[] | null;
}

type RunnerQuestion =
  | { id: string; type: 'mcq'; prompt: string; options: string[]; imageUrl: string | null; rawType: string; timeLimit: number | null }
  | { id: string; type: 'text'; prompt: string; imageUrl: string | null; rawType: string; timeLimit: number | null };

type FullQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  points: number;
  timeLimit: number | null;
  options: DbOptionRow[];
  textAnswer: DbTextAnswerRow | null;
  rawType: string;
};

@Injectable()
export class AssessmentService {
  private restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  private anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  private readonly SUPPORTED_TYPES: string[] = ['mcq', 'image_mcq', 'text', 'image_text', 'short_text', 'fill_blank'];
  private readonly DEFAULT_LIMIT = 25;
  private readonly PASSING_SCORE = 72;

  private headers(userToken?: string) {
    const sk = this.serviceKey;
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt) {
      return {
        apikey: sk,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      };
    }
    if (this.anonKey && userToken) {
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      };
    }
    throw new InternalServerErrorException('Supabase keys missing for assessments');
  }

  private formatInFilter(values: string[]): string {
    return values
      .filter((value) => typeof value === 'string' && value.length > 0)
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(',');
  }


  private sanitizeQuestionType(value: string | null | undefined): QuestionType | null {
    if (!value) return null;
    if (value === 'mcq' || value === 'image_mcq') return 'mcq';
    if (value === 'text' || value === 'image_text' || value === 'short_text' || value === 'fill_blank') {
      return 'text';
    }
    return null;
  }

  private async fetchQuestions(userToken?: string, ids?: string[]): Promise<FullQuestion[]> {
    let query = 'assessment_questions?select=id,question_type,question_text,question_image_url,points_value,time_limit_seconds,is_active';
    if (ids && ids.length > 0) {
      query += `&id=in.(${this.formatInFilter(ids)})`;
    } else {
      const typeFilter = this.formatInFilter(this.SUPPORTED_TYPES);
      query += `&or=(is_active.is.null,is_active.eq.true)&question_type=in.(${typeFilter})&order=created_at.desc&limit=${this.DEFAULT_LIMIT}`;
    }

    const res = await fetch(`${this.restUrl}/${query}`, { headers: this.headers(userToken) });
    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`Failed to fetch assessment questions: ${res.status} ${body}`);
    }
    const rows = (await res.json()) as DbQuestionRow[];

    const mapped = rows
      .map((row) => {
        const type = this.sanitizeQuestionType(row.question_type);
        if (!type) return null;
        if (!ids && row.is_active === false) return null;
        return { row, type };
      })
      .filter((entry): entry is { row: DbQuestionRow; type: QuestionType } => Boolean(entry));

    if (mapped.length === 0) return [];

    const mcqIds = mapped.filter(({ type }) => type === 'mcq').map(({ row }) => row.id);
    const textIds = mapped.filter(({ type }) => type === 'text').map(({ row }) => row.id);

    const [optionsMap, textAnswerMap] = await Promise.all([
      this.fetchOptions(mcqIds, userToken),
      this.fetchTextAnswers(textIds, userToken),
    ]);

    return mapped.map(({ row, type }) => ({
      id: row.id,
      type,
      prompt: row.question_text,
      imageUrl: row.question_image_url ?? null,
      points: typeof row.points_value === 'number' && !Number.isNaN(row.points_value) ? row.points_value : 1,
      timeLimit:
        typeof row.time_limit_seconds === 'number' && !Number.isNaN(row.time_limit_seconds)
          ? row.time_limit_seconds
          : null,
      options: optionsMap.get(row.id) ?? [],
      textAnswer: textAnswerMap.get(row.id) ?? null,
      rawType: row.question_type,
    }));
  }

  private async fetchOptions(questionIds: string[], userToken?: string) {
    const map = new Map<string, DbOptionRow[]>();
    if (!questionIds.length) return map;

    const url = `${this.restUrl}/assessment_question_options?select=question_id,option_text,is_correct,order_index&question_id=in.(${this.formatInFilter(
      questionIds,
    )})&order=order_index.asc`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`Failed to fetch assessment question options: ${res.status} ${body}`);
    }
    const rows = (await res.json()) as DbOptionRow[];
    for (const row of rows) {
      const current = map.get(row.question_id) ?? [];
      current.push(row);
      map.set(row.question_id, current);
    }
    for (const [key, value] of map.entries()) {
      value.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      map.set(key, value);
    }
    return map;
  }

  private async fetchTextAnswers(questionIds: string[], userToken?: string) {
    const map = new Map<string, DbTextAnswerRow>();
    if (!questionIds.length) return map;

    const url = `${this.restUrl}/assessment_text_answers?select=question_id,correct_answer,case_sensitive,exact_match,alternate_answers,keywords&question_id=in.(${this.formatInFilter(
      questionIds,
    )})`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`Failed to fetch assessment text answers: ${res.status} ${body}`);
    }
    const rows = (await res.json()) as DbTextAnswerRow[];
    for (const row of rows) {
      map.set(row.question_id, row);
    }
    return map;
  }

  private evaluateTextAnswer(answer: string | null | undefined, spec: DbTextAnswerRow | null): boolean {
    if (!spec) return false;
    const submitted = (answer ?? '').trim();
    if (!submitted) return false;

    const correctAnswer = (spec.correct_answer ?? '').trim();
    if (!correctAnswer) return false;

    if (spec.exact_match) {
      if (spec.case_sensitive) return submitted === correctAnswer;
      return submitted.toLowerCase() === correctAnswer.toLowerCase();
    }

    const normalize = (value: string) => (spec.case_sensitive ? value : value.toLowerCase());
    const answerToCheck = normalize(submitted);
    const correctToCheck = normalize(correctAnswer);

    if (answerToCheck.includes(correctToCheck)) {
      return true;
    }

    const alternates = Array.isArray(spec.alternate_answers) ? spec.alternate_answers : [];
    if (alternates.some((alt) => answerToCheck.includes(normalize(alt)))) {
      return true;
    }

    const keywords = Array.isArray(spec.keywords) ? spec.keywords : [];
    if (!keywords.length) {
      return false;
    }
    const keywordMatches = keywords.filter((keyword) => answerToCheck.includes(normalize(keyword)));
    return keywordMatches.length >= Math.ceil(keywords.length / 2);
  }

  async getQuestionSet(userToken?: string): Promise<RunnerQuestion[]> {
    const questions = await this.fetchQuestions(userToken);
    return questions.map((question) => {
      if (question.type === 'mcq') {
        return {
          id: question.id,
          type: 'mcq',
          prompt: question.prompt,
          options: question.options.map((opt) => opt.option_text),
          imageUrl: question.imageUrl,
          rawType: question.rawType,
          timeLimit: question.timeLimit,
        } as RunnerQuestion;
      }
      return {
        id: question.id,
        type: 'text',
        prompt: question.prompt,
        imageUrl: question.imageUrl,
        rawType: question.rawType,
        timeLimit: question.timeLimit,
      } as RunnerQuestion;
    });
  }

  async start(userId: string, userToken?: string) {
    const url = `${this.restUrl}/assessments`;
    const now = new Date().toISOString();
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify([{ user_id: userId, started_at: now }]),
    });
    if (!res.ok)
      throw new InternalServerErrorException(`assessments insert failed: ${res.status} ${await res.text()}`);
    const [row] = (await res.json()) as AssessmentRow[];
    return row;
  }

  async finish(
    userId: string,
    assessmentId: string,
    responses: {
      q_index: number;
      question_id: string;
      answer: string | null;
    }[],
    userToken?: string,
  ) {
    const questionIds = Array.from(new Set(responses.map((response) => response.question_id).filter(Boolean)));
    const questions = await this.fetchQuestions(userToken, questionIds);
    const questionMap = new Map(questions.map((question) => [question.id, question]));

    let correctCount = 0;
    const toSave: Omit<ResponseRow, 'id'>[] = responses.map((response) => {
      const question = questionMap.get(response.question_id);
      let correct = false;
      let storedAnswer: string | null = response.answer ?? null;

      if (question) {
        if (question.type === 'mcq') {
          const idx = Number.isFinite(Number(response.answer))
            ? parseInt(String(response.answer), 10)
            : NaN;
          const option = Number.isNaN(idx) ? undefined : question.options[idx];
          storedAnswer = option ? option.option_text : null;
          correct = Boolean(option?.is_correct);
        } else if (question.type === 'text') {
          const submitted = (response.answer ?? '').trim();
          storedAnswer = submitted || null;
          correct = this.evaluateTextAnswer(submitted, question.textAnswer);
        }
      }

      if (correct) correctCount++;

      return {
        assessment_id: assessmentId,
        q_index: response.q_index,
        question_id: response.question_id,
        answer_text: storedAnswer,
        correct,
      };
    });

    const totalQuestions = responses.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= this.PASSING_SCORE;

    const rUrl = `${this.restUrl}/assessment_responses`;
    const rRes = await fetch(rUrl, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify(toSave),
    });
    if (!rRes.ok)
      throw new InternalServerErrorException(`responses insert failed: ${rRes.status} ${await rRes.text()}`);

    const aUrl = `${this.restUrl}/assessments?id=eq.${assessmentId}`;
    const aRes = await fetch(aUrl, {
      method: 'PATCH',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        score,
        passed,
      }),
    });
    if (!aRes.ok)
      throw new InternalServerErrorException(`assessment update failed: ${aRes.status} ${await aRes.text()}`);
    const [updated] = (await aRes.json()) as AssessmentRow[];

    try {
      const profileUrl = `${this.restUrl}/profiles?id=eq.${userId}`;
      await fetch(profileUrl, {
        method: 'PATCH',
        headers: { ...this.headers(userToken) },
        body: JSON.stringify({
          assessment_completed_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn('Failed to update profile assessment completion:', error);
    }

    return {
      score,
      passed,
      total: totalQuestions,
      correct: correctCount,
      assessment: updated,
    };
  }

  async latest(userId: string, userToken?: string) {
    const url = `${this.restUrl}/assessments?user_id=eq.${userId}&select=id,user_id,started_at,completed_at,score,passed&order=started_at.desc&limit=1`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (!res.ok)
      throw new InternalServerErrorException(`assessments select failed: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as AssessmentRow[];
    return rows[0] ?? null;
  }
}
