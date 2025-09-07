import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { decodeJwt } from 'jose';

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  career_goal: string;
  difficulty_level: string;
  estimated_duration_weeks: number;
  icon: string;
  color: string;
  is_active: boolean;
  steps?: LearningPathStep[];
}

export interface LearningPathStep {
  id: string;
  learning_path_id: string;
  title: string;
  description: string;
  step_type: string;
  order_index: number;
  estimated_hours: number;
  skills: string[];
  prerequisites: string[];
  resources: any;
  is_required: boolean;
}

export interface UserProgress {
  learning_path_id: string;
  current_step_id?: string;
  started_at: string;
  completed_at?: string;
  progress_percentage: number;
  completed_steps?: string[];
}

@Injectable()
export class LearningPathService {
  private restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  private anonKey = process.env.SUPABASE_ANON_KEY;

  private headers(userToken?: string) {
    if (!process.env.SUPABASE_URL) {
      if (process.env.NODE_ENV === 'test') {
        return { 'Content-Type': 'application/json' } as Record<string, string>;
      }
      throw new InternalServerErrorException('SUPABASE_URL not set');
    }
    
    const sk = this.serviceKey?.trim();
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt) {
      return {
        apikey: sk,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      } as Record<string, string>;
    }
    
    if (this.anonKey && userToken) {
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      } as Record<string, string>;
    }
    
    if (process.env.NODE_ENV === 'test') {
      return { 'Content-Type': 'application/json' } as Record<string, string>;
    }
    
    throw new InternalServerErrorException('Supabase keys missing');
  }

  private getUserId(userToken?: string): string {
    if (!userToken) throw new InternalServerErrorException('User token required');
    const token = userToken.replace(/^Bearer\s+/i, '');
    const decoded = decodeJwt(token);
    return decoded.sub as string;
  }

  async getAllPaths(userToken?: string): Promise<LearningPath[]> {
    const url = `${this.restUrl}/learning_paths?is_active=eq.true&order=created_at`;
    
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to fetch learning paths: ${res.status} ${msg}`);
    }
    
    return res.json();
  }

  async getPathDetails(pathId: string, userToken?: string): Promise<LearningPath> {
    const url = `${this.restUrl}/learning_paths?id=eq.${pathId}&is_active=eq.true`;
    
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to fetch learning path: ${res.status} ${msg}`);
    }
    
    const paths = await res.json();
    if (!paths || paths.length === 0) {
      throw new NotFoundException('Learning path not found');
    }
    
    // Fetch steps for this path
    const stepsUrl = `${this.restUrl}/learning_path_steps?learning_path_id=eq.${pathId}&order=order_index`;
    const stepsRes = await fetch(stepsUrl, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    
    const steps = stepsRes.ok ? await stepsRes.json() : [];
    
    return {
      ...paths[0],
      steps
    };
  }

  async getRecommendedPath(profileData: any, userToken?: string): Promise<LearningPath> {
    const userId = this.getUserId(userToken);
    
    // Simple recommendation logic based on career goals and focus areas
    const { career_goals, focus_areas = [], experience_level } = profileData;
    
    let recommendedCareerGoal = 'data_analyst'; // default
    
    if (career_goals?.includes('business') || focus_areas.includes('business_intelligence')) {
      recommendedCareerGoal = 'business_analyst';
    } else if (career_goals?.includes('data') || focus_areas.includes('python') || focus_areas.includes('statistics')) {
      recommendedCareerGoal = 'data_analyst';
    }
    
    const url = `${this.restUrl}/learning_paths?career_goal=eq.${recommendedCareerGoal}&is_active=eq.true&limit=1`;
    
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to get recommendation: ${res.status} ${errorText}`);
    }
    
    const paths = await res.json();
    if (!paths || paths.length === 0) {
      // Fallback to first available path
      const allPaths = await this.getAllPaths(userToken);
      if (!allPaths || allPaths.length === 0) {
        throw new InternalServerErrorException('No learning paths available');
      }
      return allPaths[0];
    }
    
    return paths[0];
  }

  async enrollUserInPath(pathId: string, userToken?: string): Promise<{ success: boolean }> {
    const userId = this.getUserId(userToken);
    
    const url = `${this.restUrl}/user_learning_path_progress`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers(userToken),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify([{
        user_id: userId,
        learning_path_id: pathId,
        progress_percentage: 0
      }])
    });
    
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to enroll in learning path: ${res.status} ${msg}`);
    }
    
    return { success: true };
  }

  async getUserProgress(userToken?: string): Promise<UserProgress[]> {
    const userId = this.getUserId(userToken);
    
    const url = `${this.restUrl}/user_learning_path_progress?user_id=eq.${userId}`;
    
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to fetch user progress: ${res.status} ${msg}`);
    }
    
    const progress = await res.json();
    
    // For each path, get completed steps
    for (const p of progress) {
      const stepsUrl = `${this.restUrl}/user_step_progress?user_id=eq.${userId}&learning_path_id=eq.${p.learning_path_id}`;
      const stepsRes = await fetch(stepsUrl, {
        headers: this.headers(userToken),
        cache: 'no-store',
      });
      
      if (stepsRes.ok) {
        const completedSteps = await stepsRes.json();
        p.completed_steps = completedSteps.map((s: any) => s.step_id);
      }
    }
    
    return progress;
  }

  async completeStep(stepId: string, body: any, userToken?: string): Promise<{ success: boolean }> {
    const userId = this.getUserId(userToken);
    const { learning_path_id, time_spent_hours = 0, rating, notes } = body;
    
    const url = `${this.restUrl}/user_step_progress`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers(userToken),
        'Prefer': 'resolution=ignore-duplicates'
      },
      body: JSON.stringify([{
        user_id: userId,
        step_id: stepId,
        learning_path_id,
        time_spent_hours,
        rating,
        notes
      }])
    });
    
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(`Failed to complete step: ${res.status} ${msg}`);
    }
    
    // Update overall progress percentage
    await this.updatePathProgress(userId, learning_path_id, userToken);
    
    return { success: true };
  }

  private async updatePathProgress(userId: string, pathId: string, userToken?: string): Promise<void> {
    // Get total steps in path
    const stepsUrl = `${this.restUrl}/learning_path_steps?learning_path_id=eq.${pathId}&select=id`;
    const stepsRes = await fetch(stepsUrl, { headers: this.headers(userToken) });
    const allSteps = stepsRes.ok ? await stepsRes.json() : [];
    
    // Get completed steps
    const completedUrl = `${this.restUrl}/user_step_progress?user_id=eq.${userId}&learning_path_id=eq.${pathId}&select=step_id`;
    const completedRes = await fetch(completedUrl, { headers: this.headers(userToken) });
    const completedSteps = completedRes.ok ? await completedRes.json() : [];
    
    const progressPercentage = allSteps.length > 0 ? Math.round((completedSteps.length / allSteps.length) * 100) : 0;
    
    // Update progress
    const updateUrl = `${this.restUrl}/user_learning_path_progress?user_id=eq.${userId}&learning_path_id=eq.${pathId}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: this.headers(userToken),
      body: JSON.stringify({ 
        progress_percentage: progressPercentage,
        completed_at: progressPercentage === 100 ? new Date().toISOString() : null
      })
    });
  }
}