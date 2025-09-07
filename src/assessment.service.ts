import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QUESTIONS, Question } from './questions';

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

@Injectable()
export class AssessmentService {
  private restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  private anonKey = process.env.SUPABASE_ANON_KEY?.trim();

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
    throw new InternalServerErrorException(
      'Supabase keys missing for assessments',
    );
  }

  getQuestionSet(): Omit<Question, 'answerIndex' | 'answerText'>[] {
    return QUESTIONS.map((q) =>
      q.type === 'mcq'
        ? ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
          } as any)
        : ({ id: q.id, type: q.type, prompt: q.prompt } as any),
    );
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
      throw new InternalServerErrorException(
        `assessments insert failed: ${res.status} ${await res.text()}`,
      );
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
    // compute score
    let correctCount = 0;
    const toSave: Omit<ResponseRow, 'id'>[] = responses.map((r) => {
      const q = QUESTIONS.find((qq) => qq.id === r.question_id);
      let correct = false;
      let storedAnswer: string | null = r.answer ?? null;
      if (q) {
        if (q.type === 'mcq') {
          const idx = Number.isFinite(Number(r.answer))
            ? parseInt(String(r.answer), 10)
            : NaN;
          // Determine correctness strictly by index matching
          correct = String(q.answerIndex) === String(r.answer);
          // Store the option text instead of the raw index for readability
          if (!Number.isNaN(idx)) {
            if (idx >= 0 && idx < q.options.length)
              storedAnswer = q.options[idx];
            else storedAnswer = null; // e.g. "Don't Know" appended in UI or invalid index
          }
        } else {
          const ans = (r.answer ?? '').trim();
          correct = ans.toLowerCase() === q.answerText.trim().toLowerCase();
          storedAnswer = ans || null;
        }
      }
      if (correct) correctCount++;
      return {
        assessment_id: assessmentId,
        q_index: r.q_index,
        question_id: r.question_id,
        answer_text: storedAnswer,
        correct,
      } as any;
    });
    const passed = correctCount >= 18; // 72%
    const score = Math.round((correctCount / QUESTIONS.length) * 100);

    // save responses
    const rUrl = `${this.restUrl}/assessment_responses`;
    const rRes = await fetch(rUrl, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify(toSave),
    });
    if (!rRes.ok)
      throw new InternalServerErrorException(
        `responses insert failed: ${rRes.status} ${await rRes.text()}`,
      );

    // update assessment
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
      throw new InternalServerErrorException(
        `assessment update failed: ${aRes.status} ${await aRes.text()}`,
      );
    const [updated] = (await aRes.json()) as AssessmentRow[];
    
    // Update user profile to mark assessment as completed (first-time assessment tracking)
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
      // Don't fail the assessment if profile update fails
      console.warn('Failed to update profile assessment completion:', error);
    }
    
    return {
      score,
      passed,
      total: QUESTIONS.length,
      correct: correctCount,
      assessment: updated,
    };
  }

  async latest(userId: string, userToken?: string) {
    const url = `${this.restUrl}/assessments?user_id=eq.${userId}&select=id,user_id,started_at,completed_at,score,passed&order=started_at.desc&limit=1`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (!res.ok)
      throw new InternalServerErrorException(
        `assessments select failed: ${res.status} ${await res.text()}`,
      );
    const rows = (await res.json()) as AssessmentRow[];
    return rows[0] ?? null;
  }
}
