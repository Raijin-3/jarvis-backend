import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class QuizService {
  private restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();

  private headers() {
    const sk = this.serviceKey;
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt) {
      return {
        apikey: sk,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      };
    }
    throw new InternalServerErrorException(
      'Supabase service key missing for quizzes',
    );
  }

  async createQuiz(title: string, section_id: string) {
    const url = `${this.restUrl}/quizzes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify([{ title, section_id }]),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Quiz insert failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async updateQuiz(id: string, title: string, section_id: string) {
    const url = `${this.restUrl}/quizzes?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ title, section_id }),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Quiz update failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async deleteQuiz(id: string) {
    const url = `${this.restUrl}/quizzes?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Quiz delete failed: ${res.status} ${await res.text()}`,
      );
    return { success: true };
  }

  async getQuiz(id: string) {
    const url = `${this.restUrl}/quizzes?id=eq.${id}&select=*,quiz_questions(*)`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Quiz fetch failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async getQuizzesBySection(sectionId: string) {
    const url = `${this.restUrl}/quizzes?section_id=eq.${sectionId}&select=*,quiz_questions(*)`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Quizzes by section fetch failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async createQuestion(
    quizId: string,
    type: string,
    text: string,
    order_index: number,
    content: string,
  ) {
    const url = `${this.restUrl}/quiz_questions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify([
        { quiz_id: quizId, type, text, order_index, content },
      ]),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Question insert failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async updateQuestion(
    id: string,
    type: string,
    text: string,
    order_index: number,
    content: string,
  ) {
    const url = `${this.restUrl}/quiz_questions?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ type, text, order_index, content }),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Question update failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async deleteQuestion(id: string) {
    const url = `${this.restUrl}/quiz_questions?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Question delete failed: ${res.status} ${await res.text()}`,
      );
    return { success: true };
  }

  async getQuestionsByQuiz(quizId: string) {
    const url = `${this.restUrl}/quiz_questions?quiz_id=eq.${quizId}&select=*,quiz_options(*)`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Questions by quiz fetch failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }

  async createOption(questionId: string, text: string, correct: boolean) {
    const url = `${this.restUrl}/quiz_options`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify([{ question_id: questionId, text, correct }]),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Option insert failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async updateOption(id: string, text: string, correct: boolean) {
    const url = `${this.restUrl}/quiz_options?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify({ text, correct }),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Option update failed: ${res.status} ${await res.text()}`,
      );
    const [row] = await res.json();
    return row;
  }

  async deleteOption(id: string) {
    const url = `${this.restUrl}/quiz_options?id=eq.${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Option delete failed: ${res.status} ${await res.text()}`,
      );
    return { success: true };
  }

  async getOptionsByQuestion(questionId: string) {
    const url = `${this.restUrl}/quiz_options?question_id=eq.${questionId}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok)
      throw new InternalServerErrorException(
        `Options by question fetch failed: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }
}
