import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { SubmitResponseDto } from './student-assessment.controller';

interface HistoryFilters {
  page: number;
  limit: number;
  status?: string;
  template_id?: string;
}

interface LeaderboardFilters {
  categoryId?: string;
  timePeriod: string;
  limit: number;
}

@Injectable()
export class StudentAssessmentService {
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
    throw new InternalServerErrorException('Supabase keys missing for student assessments');
  }

  // ========== Assessment Discovery ==========

  async getAvailableAssessments(studentId: string, userToken?: string) {
    const url = `${this.restUrl}/assessment_templates?is_active=eq.true&is_public=eq.true&select=*,assessment_categories(display_name)&order=created_at.desc`;
    const res = await fetch(url, { headers: this.headers(userToken) });

    if (!res.ok) {
      throw new InternalServerErrorException(`Failed to fetch available assessments: ${res.status}`);
    }

    const templates = await res.json();

    // Get student's attempt counts for each template
    const templateIds = templates.map(t => t.id);
    if (templateIds.length === 0) return templates;

    const attemptsUrl = `${this.restUrl}/student_assessment_sessions?student_id=eq.${studentId}&template_id=in.(${templateIds.join(',')})&select=template_id,attempt_number,status,passed`;
    const attemptsRes = await fetch(attemptsUrl, { headers: this.headers(userToken) });
    const attempts = attemptsRes.ok ? await attemptsRes.json() : [];

    // Enhance templates with attempt information
    return templates.map(template => {
      const templateAttempts = attempts.filter(a => a.template_id === template.id);
      const maxAttempt = Math.max(...templateAttempts.map(a => a.attempt_number), 0);
      const lastAttempt = templateAttempts.find(a => a.attempt_number === maxAttempt);
      const passedAttempts = templateAttempts.filter(a => a.status === 'completed' && a.passed);

      return {
        ...template,
        student_info: {
          total_attempts: templateAttempts.length,
          max_attempts_reached: template.max_attempts && templateAttempts.length >= template.max_attempts,
          best_score: Math.max(...templateAttempts.map(a => a.percentage_score || 0), 0),
          has_passed: passedAttempts.length > 0,
          last_attempt_status: lastAttempt?.status || null,
          last_attempt_passed: lastAttempt?.passed || false,
          can_retake: !template.max_attempts || templateAttempts.length < template.max_attempts
        }
      };
    });
  }

  async getAssessmentTemplate(templateId: string, studentId: string, userToken?: string) {
    const url = `${this.restUrl}/assessment_templates?id=eq.${templateId}&select=*,assessment_categories(display_name)`;
    const res = await fetch(url, { headers: this.headers(userToken) });

    if (!res.ok) {
      throw new InternalServerErrorException(`Failed to fetch assessment template: ${res.status}`);
    }

    const [template] = await res.json();
    if (!template) {
      throw new NotFoundException(`Assessment template with id ${templateId} not found`);
    }

    if (!template.is_active || !template.is_public) {
      throw new ForbiddenException('This assessment is not available');
    }

    return template;
  }

  async previewAssessment(templateId: string, userToken?: string) {
    const template = await this.getAssessmentTemplate(templateId, '', userToken);
    
    // Get question count by difficulty
    const questionsUrl = `${this.restUrl}/assessment_template_questions?template_id=eq.${templateId}&select=assessment_questions(difficulty_level,question_type,points_value)`;
    const questionsRes = await fetch(questionsUrl, { headers: this.headers(userToken) });
    
    if (!questionsRes.ok) {
      throw new InternalServerErrorException('Failed to fetch template questions');
    }

    const templateQuestions = await questionsRes.json();
    const questions = templateQuestions.map(tq => tq.assessment_questions);

    const preview = {
      ...template,
      question_breakdown: {
        total: questions.length,
        by_difficulty: {
          easy: questions.filter(q => q.difficulty_level === 'easy').length,
          medium: questions.filter(q => q.difficulty_level === 'medium').length,
          hard: questions.filter(q => q.difficulty_level === 'hard').length
        },
        by_type: {
          mcq: questions.filter(q => q.question_type === 'mcq').length,
          text: questions.filter(q => ['text', 'short_text', 'fill_blank'].includes(q.question_type)).length,
          image_mcq: questions.filter(q => q.question_type === 'image_mcq').length,
          image_text: questions.filter(q => q.question_type === 'image_text').length
        },
        total_points: questions.reduce((sum, q) => sum + (q.points_value || 1), 0)
      }
    };

    return preview;
  }

  // ========== Assessment Session Management ==========

  async startAssessment(templateId: string, studentId: string, userToken?: string) {
    const template = await this.getAssessmentTemplate(templateId, studentId, userToken);
    
    // Get current attempt number
    const attemptsUrl = `${this.restUrl}/student_assessment_sessions?student_id=eq.${studentId}&template_id=eq.${templateId}&select=attempt_number&order=attempt_number.desc&limit=1`;
    const attemptsRes = await fetch(attemptsUrl, { headers: this.headers(userToken) });
    const attempts = await attemptsRes.json();
    const nextAttemptNumber = attempts.length > 0 ? attempts[0].attempt_number + 1 : 1;

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + template.time_limit_minutes);

    // Create session
    const sessionToken = uuidv4();
    const sessionPayload = {
      student_id: studentId,
      template_id: templateId,
      session_token: sessionToken,
      attempt_number: nextAttemptNumber,
      expires_at: expiresAt.toISOString(),
      started_at: new Date().toISOString()
    };

    const sessionUrl = `${this.restUrl}/student_assessment_sessions`;
    const sessionRes = await fetch(sessionUrl, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify([sessionPayload])
    });

    if (!sessionRes.ok) {
      throw new InternalServerErrorException(`Failed to start assessment: ${sessionRes.status} ${await sessionRes.text()}`);
    }

    const [session] = await sessionRes.json();

    // Get questions for this assessment (with randomization if enabled)
    const questions = await this.getQuestionsForSession(templateId, template.randomize_questions, userToken);

    return {
      session_token: sessionToken,
      session_id: session.id,
      template: template,
      expires_at: expiresAt.toISOString(),
      questions: questions.map((q, index) => ({
        id: q.id,
        question_number: index + 1,
        question_type: q.question_type,
        question_text: q.question_text,
        question_image_url: q.question_image_url,
        difficulty_level: q.difficulty_level,
        points_value: q.points_value,
        time_limit_seconds: q.time_limit_seconds,
        options: this.prepareQuestionOptions(q.options, template.randomize_options)
      })),
      total_questions: questions.length,
      attempt_number: nextAttemptNumber
    };
  }

  async getAssessmentSession(sessionToken: string, studentId: string, userToken?: string) {
    const sessionUrl = `${this.restUrl}/student_assessment_sessions?session_token=eq.${sessionToken}&student_id=eq.${studentId}&select=*,assessment_templates(*)`;
    const sessionRes = await fetch(sessionUrl, { headers: this.headers(userToken) });

    if (!sessionRes.ok) {
      throw new InternalServerErrorException('Failed to fetch assessment session');
    }

    const [session] = await sessionRes.json();
    if (!session) {
      throw new NotFoundException('Assessment session not found');
    }

    if (session.status === 'expired' || (session.expires_at && new Date() > new Date(session.expires_at))) {
      // Auto-expire if needed
      if (session.status !== 'expired') {
        await this.expireSession(session.id, userToken);
      }
      throw new ForbiddenException('Assessment session has expired');
    }

    // Get responses for this session
    const responsesUrl = `${this.restUrl}/student_assessment_responses?session_id=eq.${session.id}&select=question_id,selected_option_id,text_answer,is_correct,points_earned`;
    const responsesRes = await fetch(responsesUrl, { headers: this.headers(userToken) });
    const responses = await responsesRes.json();

    return {
      ...session,
      responses: responses,
      time_remaining: Math.max(0, Math.floor((new Date(session.expires_at).getTime() - new Date().getTime()) / 1000)),
      is_expired: new Date() > new Date(session.expires_at)
    };
  }

  async getQuestionForSession(sessionToken: string, questionId: string, studentId: string, userToken?: string) {
    // Verify session ownership and validity
    const session = await this.getAssessmentSession(sessionToken, studentId, userToken);
    
    // Get the specific question with options
    const questionUrl = `${this.restUrl}/assessment_questions?id=eq.${questionId}&select=*`;
    const optionsUrl = `${this.restUrl}/assessment_question_options?question_id=eq.${questionId}&select=*&order=order_index.asc`;
    
    const [questionRes, optionsRes] = await Promise.all([
      fetch(questionUrl, { headers: this.headers(userToken) }),
      fetch(optionsUrl, { headers: this.headers(userToken) })
    ]);

    if (!questionRes.ok) {
      throw new InternalServerErrorException('Failed to fetch question');
    }

    const [question] = await questionRes.json();
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const options = await optionsRes.json();

    // Check if student has already answered this question
    const responseUrl = `${this.restUrl}/student_assessment_responses?session_id=eq.${session.id}&question_id=eq.${questionId}&select=*`;
    const responseRes = await fetch(responseUrl, { headers: this.headers(userToken) });
    const existingResponse = await responseRes.json();

    return {
      ...question,
      options: this.prepareQuestionOptions(options, session.assessment_templates.randomize_options),
      existing_response: existingResponse[0] || null,
      session_info: {
        time_remaining: Math.max(0, Math.floor((new Date(session.expires_at).getTime() - new Date().getTime()) / 1000)),
        questions_answered: session.responses.length,
        total_questions: session.total_questions
      }
    };
  }

  async submitResponse(responseDto: SubmitResponseDto, studentId: string, userToken?: string) {
    // Get session to validate
    const session = await this.getAssessmentSession(responseDto.session_token, studentId, userToken);
    
    if (session.status !== 'in_progress') {
      throw new BadRequestException('Cannot submit response for non-active session');
    }

    // Get question details for validation and scoring
    const questionUrl = `${this.restUrl}/assessment_questions?id=eq.${responseDto.question_id}&select=*`;
    const questionRes = await fetch(questionUrl, { headers: this.headers(userToken) });
    const [question] = await questionRes.json();

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Validate and score the response
    const { isCorrect, pointsEarned } = await this.validateAndScoreResponse(
      question,
      responseDto,
      userToken
    );

    // Save the response
    const responsePayload = {
      session_id: session.id,
      question_id: responseDto.question_id,
      selected_option_id: responseDto.selected_option_id || null,
      text_answer: responseDto.text_answer || null,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      time_spent_seconds: responseDto.time_spent_seconds,
      answered_at: new Date().toISOString()
    };

    const saveUrl = `${this.restUrl}/student_assessment_responses`;
    const saveRes = await fetch(saveUrl, {
      method: 'POST',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify([responsePayload])
    });

    if (!saveRes.ok) {
      // Check if response already exists (duplicate submission)
      if (saveRes.status === 409) {
        throw new BadRequestException('Response already submitted for this question');
      }
      throw new InternalServerErrorException(`Failed to save response: ${saveRes.status}`);
    }

    const [savedResponse] = await saveRes.json();

    return {
      response_id: savedResponse.id,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      explanation: question.explanation || null,
      session_progress: {
        questions_answered: session.responses.length + 1,
        total_questions: session.total_questions,
        time_remaining: Math.max(0, Math.floor((new Date(session.expires_at).getTime() - new Date().getTime()) / 1000))
      }
    };
  }

  async pauseAssessment(sessionToken: string, studentId: string, userToken?: string) {
    const session = await this.getAssessmentSession(sessionToken, studentId, userToken);
    
    // Update session metadata to track pause time
    const pauseTime = new Date().toISOString();
    const metadata = {
      ...session.metadata,
      paused_at: pauseTime,
      pause_count: (session.metadata?.pause_count || 0) + 1
    };

    const updateUrl = `${this.restUrl}/student_assessment_sessions?id=eq.${session.id}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: this.headers(userToken),
      body: JSON.stringify({ metadata })
    });

    return { success: true, paused_at: pauseTime };
  }

  async resumeAssessment(sessionToken: string, studentId: string, userToken?: string) {
    const session = await this.getAssessmentSession(sessionToken, studentId, userToken);
    
    // Update session metadata to track resume time
    const resumeTime = new Date().toISOString();
    const metadata = {
      ...session.metadata,
      resumed_at: resumeTime
    };

    const updateUrl = `${this.restUrl}/student_assessment_sessions?id=eq.${session.id}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: this.headers(userToken),
      body: JSON.stringify({ metadata })
    });

    return { success: true, resumed_at: resumeTime };
  }

  async finishAssessment(sessionToken: string, studentId: string, userToken?: string) {
    const session = await this.getAssessmentSession(sessionToken, studentId, userToken);
    
    if (session.status !== 'in_progress') {
      throw new BadRequestException('Cannot finish non-active session');
    }

    // Calculate final results
    await this.calculateSessionResults(session.id, userToken);

    // Get updated session with results
    const updatedSession = await this.getAssessmentSession(sessionToken, studentId, userToken);

    return {
      session_id: session.id,
      total_score: updatedSession.total_score,
      percentage_score: updatedSession.percentage_score,
      total_questions: updatedSession.total_questions,
      correct_answers: updatedSession.correct_answers,
      passed: updatedSession.passed,
      time_spent_seconds: updatedSession.time_spent_seconds,
      attempt_number: updatedSession.attempt_number,
      can_retake: updatedSession.assessment_templates.allow_retakes && 
        (!updatedSession.assessment_templates.max_attempts || 
         updatedSession.attempt_number < updatedSession.assessment_templates.max_attempts)
    };
  }

  // ========== Assessment History ==========

  async getAssessmentHistory(studentId: string, filters: HistoryFilters, userToken?: string) {
    const { page, limit, status, template_id } = filters;
    const offset = (page - 1) * limit;

    let query = `student_assessment_sessions?student_id=eq.${studentId}&select=*,assessment_templates(title,category_id,assessment_categories(display_name))&order=started_at.desc&limit=${limit}&offset=${offset}`;

    const conditions: string[] = [];
    if (status) conditions.push(`status=eq.${status}`);
    if (template_id) conditions.push(`template_id=eq.${template_id}`);

    if (conditions.length > 0) {
      query += `&${conditions.join('&')}`;
    }

    const url = `${this.restUrl}/${query}`;
    const res = await fetch(url, { headers: this.headers(userToken) });

    if (!res.ok) {
      throw new InternalServerErrorException('Failed to fetch assessment history');
    }

    const sessions = await res.json();

    // Get total count for pagination
    const countQuery = `student_assessment_sessions?student_id=eq.${studentId}&select=count&${conditions.join('&')}`;
    const countUrl = `${this.restUrl}/${countQuery}`;
    const countRes = await fetch(countUrl, { headers: this.headers(userToken) });
    const [{ count }] = await countRes.json();

    return {
      sessions,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getAssessmentResults(sessionId: string, studentId: string, userToken?: string) {
    const sessionUrl = `${this.restUrl}/student_assessment_sessions?id=eq.${sessionId}&student_id=eq.${studentId}&select=*,assessment_templates(title,passing_percentage,show_results_immediately)`;
    const sessionRes = await fetch(sessionUrl, { headers: this.headers(userToken) });

    if (!sessionRes.ok) {
      throw new InternalServerErrorException('Failed to fetch session');
    }

    const [session] = await sessionRes.json();
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'completed') {
      throw new BadRequestException('Results not available for incomplete sessions');
    }

    if (!session.assessment_templates.show_results_immediately) {
      throw new ForbiddenException('Results are not available immediately for this assessment');
    }

    return {
      session_id: sessionId,
      assessment_title: session.assessment_templates.title,
      total_score: session.total_score,
      percentage_score: session.percentage_score,
      total_questions: session.total_questions,
      correct_answers: session.correct_answers,
      passed: session.passed,
      passing_percentage: session.assessment_templates.passing_percentage,
      time_spent_minutes: Math.round((session.time_spent_seconds || 0) / 60),
      attempt_number: session.attempt_number,
      completed_at: session.completed_at
    };
  }

  async getDetailedResults(sessionId: string, studentId: string, userToken?: string) {
    const results = await this.getAssessmentResults(sessionId, studentId, userToken);

    // Get detailed response breakdown
    const responsesUrl = `${this.restUrl}/student_assessment_responses?session_id=eq.${sessionId}&select=*,assessment_questions(question_text,explanation,difficulty_level),assessment_question_options(option_text,is_correct)&order=answered_at.asc`;
    const responsesRes = await fetch(responsesUrl, { headers: this.headers(userToken) });
    const responses = await responsesRes.json();

    return {
      ...results,
      detailed_responses: responses.map(response => ({
        question_text: response.assessment_questions.question_text,
        difficulty_level: response.assessment_questions.difficulty_level,
        student_answer: response.text_answer || 
          (response.assessment_question_options?.option_text || 'No answer'),
        is_correct: response.is_correct,
        points_earned: response.points_earned,
        explanation: response.assessment_questions.explanation,
        time_spent_seconds: response.time_spent_seconds
      })),
      performance_by_difficulty: this.calculatePerformanceByDifficulty(responses)
    };
  }

  // ========== Helper Methods ==========

  private async getQuestionsForSession(templateId: string, randomize: boolean, userToken?: string) {
    const questionsUrl = `${this.restUrl}/assessment_template_questions?template_id=eq.${templateId}&select=assessment_questions(*,assessment_question_options(*))&order=order_index.asc`;
    const questionsRes = await fetch(questionsUrl, { headers: this.headers(userToken) });
    
    if (!questionsRes.ok) {
      throw new InternalServerErrorException('Failed to fetch template questions');
    }

    const templateQuestions = await questionsRes.json();
    let questions = templateQuestions.map(tq => ({
      ...tq.assessment_questions,
      options: tq.assessment_questions.assessment_question_options || []
    }));

    if (randomize) {
      questions = this.shuffleArray(questions);
    }

    return questions;
  }

  private prepareQuestionOptions(options: any[], randomize: boolean) {
    let preparedOptions = options.map(option => ({
      id: option.id,
      option_text: option.option_text,
      option_image_url: option.option_image_url
      // Note: We don't include is_correct or explanation in student view
    }));

    if (randomize) {
      preparedOptions = this.shuffleArray(preparedOptions);
    }

    return preparedOptions;
  }

  private async validateAndScoreResponse(question: any, responseDto: SubmitResponseDto, userToken?: string) {
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.question_type === 'mcq' || question.question_type === 'image_mcq') {
      if (responseDto.selected_option_id) {
        const optionUrl = `${this.restUrl}/assessment_question_options?id=eq.${responseDto.selected_option_id}&question_id=eq.${question.id}&select=is_correct`;
        const optionRes = await fetch(optionUrl, { headers: this.headers(userToken) });
        const [option] = await optionRes.json();
        
        if (option && option.is_correct) {
          isCorrect = true;
          pointsEarned = question.points_value || 1;
        }
      }
    } else if (['text', 'image_text', 'short_text', 'fill_blank'].includes(question.question_type)) {
      if (responseDto.text_answer) {
        const textAnswerUrl = `${this.restUrl}/assessment_text_answers?question_id=eq.${question.id}`;
        const textAnswerRes = await fetch(textAnswerUrl, { headers: this.headers(userToken) });
        const [textAnswer] = await textAnswerRes.json();

        if (textAnswer) {
          const studentAnswer = responseDto.text_answer.trim();
          const correctAnswer = textAnswer.correct_answer.trim();

          if (textAnswer.exact_match) {
            isCorrect = textAnswer.case_sensitive 
              ? studentAnswer === correctAnswer
              : studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
          } else {
            // Partial matching logic
            const answerToCheck = textAnswer.case_sensitive ? studentAnswer : studentAnswer.toLowerCase();
            const correctToCheck = textAnswer.case_sensitive ? correctAnswer : correctAnswer.toLowerCase();

            // Check if answer contains the correct answer or any alternate answers
            isCorrect = answerToCheck.includes(correctToCheck) ||
              textAnswer.alternate_answers.some(alt => 
                answerToCheck.includes(textAnswer.case_sensitive ? alt : alt.toLowerCase())
              );

            // Check keyword matching if no direct match
            if (!isCorrect && textAnswer.keywords.length > 0) {
              const keywordMatches = textAnswer.keywords.filter(keyword => 
                answerToCheck.includes(textAnswer.case_sensitive ? keyword : keyword.toLowerCase())
              );
              isCorrect = keywordMatches.length >= Math.ceil(textAnswer.keywords.length / 2);
            }
          }

          if (isCorrect) {
            pointsEarned = question.points_value || 1;
          }
        }
      }
    }

    return { isCorrect, pointsEarned };
  }

  private async calculateSessionResults(sessionId: string, userToken?: string) {
    // This calls the database function we created
    const functionUrl = `${this.restUrl}/rpc/calculate_session_results`;
    const functionRes = await fetch(functionUrl, {
      method: 'POST',
      headers: this.headers(userToken),
      body: JSON.stringify({ session_uuid: sessionId })
    });

    if (!functionRes.ok) {
      throw new InternalServerErrorException('Failed to calculate session results');
    }
  }

  private async expireSession(sessionId: string, userToken?: string) {
    const updateUrl = `${this.restUrl}/student_assessment_sessions?id=eq.${sessionId}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: this.headers(userToken),
      body: JSON.stringify({ status: 'expired' })
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private calculatePerformanceByDifficulty(responses: any[]) {
    const byDifficulty = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 }
    };

    responses.forEach(response => {
      const difficulty = response.assessment_questions.difficulty_level;
      if (byDifficulty[difficulty]) {
        byDifficulty[difficulty].total++;
        if (response.is_correct) {
          byDifficulty[difficulty].correct++;
        }
      }
    });

    return Object.keys(byDifficulty).reduce((acc, difficulty) => {
      const data = byDifficulty[difficulty];
      acc[difficulty] = {
        total: data.total,
        correct: data.correct,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
      };
      return acc;
    }, {});
  }

  // Additional helper methods for validation
  async getActiveSessionsForTemplate(templateId: string, studentId: string, userToken?: string) {
    const url = `${this.restUrl}/student_assessment_sessions?student_id=eq.${studentId}&template_id=eq.${templateId}&status=eq.in_progress`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    return res.ok ? await res.json() : [];
  }

  async getAttemptCount(templateId: string, studentId: string, userToken?: string) {
    const url = `${this.restUrl}/student_assessment_sessions?student_id=eq.${studentId}&template_id=eq.${templateId}&select=count`;
    const res = await fetch(url, { headers: this.headers(userToken) });
    if (res.ok) {
      const [{ count }] = await res.json();
      return count;
    }
    return 0;
  }

  // Placeholder methods for future implementation
  async getProgressOverview(studentId: string, userToken?: string) {
    return { message: 'Progress overview not yet implemented' };
  }

  async getCategoryProgress(categoryId: string, studentId: string, userToken?: string) {
    return { message: 'Category progress not yet implemented' };
  }

  async getLeaderboard(studentId: string, filters: LeaderboardFilters, userToken?: string) {
    return { message: 'Leaderboard not yet implemented' };
  }

  async getPerformanceAnalytics(studentId: string, days: number, userToken?: string) {
    return { message: 'Performance analytics not yet implemented' };
  }

  async getStrengthsAndWeaknesses(studentId: string, userToken?: string) {
    return { message: 'Strengths and weaknesses not yet implemented' };
  }
}