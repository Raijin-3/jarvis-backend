import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface Achievement {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
  points_reward: number;
  is_repeatable: boolean;
}

export interface UserAchievement {
  id: string;
  achievement_type_id: string;
  earned_at: string;
  points_earned: number;
  metadata: any;
  is_featured: boolean;
  achievement: Achievement;
}

export interface PointsHistory {
  id: string;
  points_change: number;
  reason: string;
  reference_type: string;
  metadata: any;
  created_at: string;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  points_reward: number;
  difficulty_level: string;
  date_active: string;
  progress?: UserChallengeProgress;
}

export interface UserChallengeProgress {
  id: string;
  current_progress: number;
  completed_at: string | null;
  points_earned: number;
  date_attempted: string;
}

export interface LeaderboardEntry {
  user_id: string;
  rank_position: number;
  score_value: number;
  full_name?: string;
  avatar_url?: string;
}

export interface Badge {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  color_primary: string;
  rarity: string;
}

export interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  is_equipped: boolean;
  badge: Badge;
}

export interface GamificationStats {
  total_points: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  achievements_count: number;
  badges_count: number;
  rank_position?: number;
}

export interface LearningStreak {
  id: string;
  streak_type: string;
  current_count: number;
  start_date: string;
  longest_count: number;
  is_active: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

@Injectable()
export class GamificationService {
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
      };
    }
    
    if (this.anonKey && userToken) {
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      };
    }
    
    if (process.env.NODE_ENV === 'test') {
      return { 'Content-Type': 'application/json' } as Record<string, string>;
    }
    
    throw new InternalServerErrorException('Supabase keys missing');
  }

  // Award points to user and trigger level updates
  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    referenceId?: string,
    referenceType?: string,
    userToken?: string
  ): Promise<void> {
    try {
      const url = `${this.restUrl}/rpc/award_points`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(userToken),
        body: JSON.stringify({
          p_user_id: userId,
          p_points: points,
          p_reason: reason,
          p_reference_id: referenceId,
          p_reference_type: referenceType
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new InternalServerErrorException(`Failed to award points: ${error}`);
      }
    } catch (error) {
      throw new InternalServerErrorException(`Award points failed: ${error.message}`);
    }
  }

  // Award achievement to user
  async awardAchievement(
    userId: string,
    achievementName: string,
    metadata = {},
    userToken?: string
  ): Promise<void> {
    try {
      const url = `${this.restUrl}/rpc/award_achievement`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(userToken),
        body: JSON.stringify({
          p_user_id: userId,
          p_achievement_name: achievementName,
          p_metadata: metadata
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new InternalServerErrorException(`Failed to award achievement: ${error}`);
      }
    } catch (error) {
      throw new InternalServerErrorException(`Award achievement failed: ${error.message}`);
    }
  }

  // Update learning streak
  async updateLearningStreak(
    userId: string,
    streakType = 'daily_login',
    userToken?: string
  ): Promise<void> {
    try {
      const url = `${this.restUrl}/rpc/update_learning_streak`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(userToken),
        body: JSON.stringify({
          p_user_id: userId,
          p_streak_type: streakType
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new InternalServerErrorException(`Failed to update streak: ${error}`);
      }
    } catch (error) {
      throw new InternalServerErrorException(`Update streak failed: ${error.message}`);
    }
  }

  // Get user's gamification stats
  async getUserStats(userId: string, userToken?: string): Promise<GamificationStats> {
    try {
      // Get basic stats from profile
      const profileUrl = `${this.restUrl}/profiles?id=eq.${userId}&select=total_points,current_level,current_streak,longest_streak`;
      const profileResponse = await fetch(profileUrl, {
        headers: this.headers(userToken),
      });

      if (!profileResponse.ok) {
        throw new InternalServerErrorException('Failed to fetch profile stats');
      }

      const [profile] = await profileResponse.json();
      
      // Get achievements count
      const achievementsUrl = `${this.restUrl}/user_achievements?user_id=eq.${userId}&select=id`;
      const achievementsResponse = await fetch(achievementsUrl, {
        headers: this.headers(userToken),
      });
      const achievements = await achievementsResponse.json();

      // Get badges count
      const badgesUrl = `${this.restUrl}/user_badges?user_id=eq.${userId}&select=id`;
      const badgesResponse = await fetch(badgesUrl, {
        headers: this.headers(userToken),
      });
      const badges = await badgesResponse.json();

      return {
        total_points: profile?.total_points || 0,
        current_level: profile?.current_level || 1,
        current_streak: profile?.current_streak || 0,
        longest_streak: profile?.longest_streak || 0,
        achievements_count: achievements?.length || 0,
        badges_count: badges?.length || 0,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Get user stats failed: ${error.message}`);
    }
  }

  // Get user's achievements
  async getUserAchievements(userId: string, userToken?: string): Promise<UserAchievement[]> {
    try {
      const url = `${this.restUrl}/user_achievements?user_id=eq.${userId}&select=*,achievement_types(*)&order=earned_at.desc`;
      const response = await fetch(url, {
        headers: this.headers(userToken),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to fetch achievements');
      }

      const achievements = await response.json();
      return achievements.map((item: any) => ({
        ...item,
        achievement: item.achievement_types
      }));
    } catch (error) {
      throw new InternalServerErrorException(`Get achievements failed: ${error.message}`);
    }
  }

  // Get user's points history
  async getPointsHistory(userId: string, limit = 50, userToken?: string): Promise<PointsHistory[]> {
    try {
      const url = `${this.restUrl}/points_history?user_id=eq.${userId}&select=*&order=created_at.desc&limit=${limit}`;
      const response = await fetch(url, {
        headers: this.headers(userToken),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to fetch points history');
      }

      return await response.json();
    } catch (error) {
      throw new InternalServerErrorException(`Get points history failed: ${error.message}`);
    }
  }

  // Get daily challenges for user (with dynamic generation)
  async getDailyChallenges(userId: string, userToken?: string): Promise<DailyChallenge[]> {
    try {
      const date = new Date().toISOString().split('T')[0];
      
      // First, try to get existing challenges for today
      let challengesUrl = `${this.restUrl}/daily_challenges?date_active=eq.${date}&is_active=eq.true&select=*`;
      const response = await fetch(challengesUrl, {
        headers: this.headers(userToken),
      });

      let challenges: any[] = [];
      if (response.ok) {
        challenges = await response.json();
      }

      // If no challenges exist for today, generate them dynamically
      if (challenges.length === 0) {
        challenges = await this.generateDynamicChallenges(userId, date, userToken);
      }

      // Get user's progress for these challenges
      const challengeIds = challenges.map((c: any) => c.id);
      if (challengeIds.length === 0) return [];

      const progressUrl = `${this.restUrl}/user_daily_challenge_progress?user_id=eq.${userId}&challenge_id=in.(${challengeIds.join(',')})&select=*`;
      const progressResponse = await fetch(progressUrl, {
        headers: this.headers(userToken),
      });

      const progress = progressResponse.ok ? await progressResponse.json() : [];

      return challenges.map((challenge: any) => ({
        ...challenge,
        progress: progress.find((p: any) => p.challenge_id === challenge.id)
      }));
    } catch (error) {
      throw new InternalServerErrorException(`Get daily challenges failed: ${error.message}`);
    }
  }

  // Generate dynamic challenges based on user behavior and progress
  private async generateDynamicChallenges(userId: string, date: string, userToken?: string): Promise<any[]> {
    try {
      // Get user stats to personalize challenges
      const userStats = await this.getUserStats(userId, userToken);
      const userLevel = userStats.current_level || 1;
      const currentStreak = userStats.current_streak || 0;

      // Get user's recent activity to avoid repetitive challenges
      const recentActivitiesUrl = `${this.restUrl}/user_activities?user_id=eq.${userId}&select=activity_type,created_at&order=created_at.desc&limit=20`;
      const activitiesResponse = await fetch(recentActivitiesUrl, {
        headers: this.headers(userToken),
      });
      const recentActivities = activitiesResponse.ok ? await activitiesResponse.json() : [];

      // Dynamic challenge templates based on user level and behavior
      const challengeTemplates = this.getDynamicChallengeTemplates(userLevel, currentStreak, recentActivities);
      
      // Select 3-4 challenges for the day based on variety and difficulty
      const selectedChallenges = this.selectOptimalChallenges(challengeTemplates, userLevel);

      // Create challenges in database
      const createdChallenges: any[] = [];
      for (const template of selectedChallenges) {
        const challengeData = {
          ...template,
          date_active: date,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        const createUrl = `${this.restUrl}/daily_challenges`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            ...this.headers(userToken),
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(challengeData),
        });

        if (createResponse.ok) {
          const [createdChallenge] = await createResponse.json();
          createdChallenges.push(createdChallenge);
        }
      }

      return createdChallenges;
    } catch (error) {
      console.error('Failed to generate dynamic challenges:', error);
      return [];
    }
  }

  private getDynamicChallengeTemplates(userLevel: number, currentStreak: number, recentActivities: any[]): any[] {
    const activityCounts = recentActivities.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      return acc;
    }, {});

    // Base challenge templates with dynamic scaling
    const templates = [
      // Quiz completion challenges (scaled by level)
      {
        title: 'Quiz Champion',
        description: `Complete ${Math.min(2 + Math.floor(userLevel / 2), 8)} quizzes today`,
        challenge_type: 'quiz_completion',
        target_value: Math.min(2 + Math.floor(userLevel / 2), 8),
        points_reward: 30 + (userLevel * 5),
        difficulty_level: userLevel <= 3 ? 'easy' : userLevel <= 6 ? 'medium' : 'hard',
        priority: activityCounts.quiz_completed ? 0.7 : 1.0, // Lower priority if recently active
      },
      
      // Learning time challenges (adaptive based on level)
      {
        title: 'Study Session',
        description: `Spend ${15 + (userLevel * 5)} minutes learning today`,
        challenge_type: 'time_spent',
        target_value: 15 + (userLevel * 5),
        points_reward: 25 + (userLevel * 3),
        difficulty_level: userLevel <= 2 ? 'easy' : userLevel <= 5 ? 'medium' : 'hard',
        priority: activityCounts.lecture_viewed ? 0.8 : 1.0,
      },

      // Course progress challenges
      {
        title: 'Progress Maker',
        description: `Complete ${1 + Math.floor(userLevel / 3)} course sections`,
        challenge_type: 'course_progress',
        target_value: 1 + Math.floor(userLevel / 3),
        points_reward: 40 + (userLevel * 4),
        difficulty_level: userLevel <= 2 ? 'easy' : userLevel <= 5 ? 'medium' : 'hard',
        priority: activityCounts.course_progress ? 0.6 : 1.0,
      },

      // Streak maintenance (higher priority for users with existing streaks)
      {
        title: 'Streak Keeper',
        description: 'Maintain your daily learning streak',
        challenge_type: 'streak_maintain',
        target_value: 1,
        points_reward: currentStreak > 0 ? 20 + Math.min(currentStreak * 2, 50) : 15,
        difficulty_level: 'easy',
        priority: currentStreak > 0 ? 1.2 : 0.5,
      },

      // Perfect score challenge (for intermediate+ users)
      {
        title: 'Perfectionist',
        description: 'Achieve a perfect score on any quiz',
        challenge_type: 'perfect_score',
        target_value: 1,
        points_reward: 50 + (userLevel * 5),
        difficulty_level: 'hard',
        priority: userLevel >= 3 ? 1.0 : 0.3,
      },

      // Social/engagement challenges
      {
        title: 'Explorer',
        description: 'View course materials from 2 different subjects',
        challenge_type: 'subject_diversity',
        target_value: 2,
        points_reward: 30 + (userLevel * 3),
        difficulty_level: 'medium',
        priority: 0.8,
      },
    ];

    // Add weekend or special day bonuses
    const today = new Date();
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;
    
    if (isWeekend) {
      templates.push({
        title: 'Weekend Warrior',
        description: 'Complete double your usual learning on the weekend',
        challenge_type: 'weekend_bonus',
        target_value: 2,
        points_reward: 60 + (userLevel * 8),
        difficulty_level: 'medium',
        priority: 1.1,
      });
    }

    return templates;
  }

  private selectOptimalChallenges(templates: any[], userLevel: number): any[] {
    // Sort by priority and difficulty appropriateness
    const sortedTemplates = templates
      .filter(t => t.priority > 0.2) // Filter out very low priority
      .sort((a, b) => b.priority - a.priority);

    const selected: any[] = [];
    const maxChallenges = Math.min(3 + Math.floor(userLevel / 4), 5); // 3-5 challenges based on level

    // Always include at least one easy challenge
    const easyChallenges = sortedTemplates.filter(t => t.difficulty_level === 'easy');
    if (easyChallenges.length > 0) {
      selected.push(easyChallenges[0]);
    }

    // Add medium and hard challenges based on user level
    const remainingTemplates = sortedTemplates.filter(t => !selected.includes(t));
    
    for (const template of remainingTemplates) {
      if (selected.length >= maxChallenges) break;
      
      // Avoid duplicate challenge types
      const hasSimilarType = selected.some(s => s.challenge_type === template.challenge_type);
      if (!hasSimilarType) {
        selected.push(template);
      }
    }

    // Fill remaining slots with highest priority challenges
    for (const template of remainingTemplates) {
      if (selected.length >= maxChallenges) break;
      if (!selected.includes(template)) {
        selected.push(template);
      }
    }

    return selected.slice(0, maxChallenges);
  }

  // Update challenge progress
  async updateChallengeProgress(
    userId: string,
    challengeId: string,
    progressIncrement: number,
    userToken?: string
  ): Promise<void> {
    try {
      // Get current progress
      const progressUrl = `${this.restUrl}/user_daily_challenge_progress?user_id=eq.${userId}&challenge_id=eq.${challengeId}`;
      const progressResponse = await fetch(progressUrl, {
        headers: this.headers(userToken),
      });

      let currentProgress = 0;
      if (progressResponse.ok) {
        const [existing] = await progressResponse.json();
        currentProgress = existing?.current_progress || 0;
      }

      const newProgress = currentProgress + progressIncrement;

      // Get challenge info to check if completed
      const challengeUrl = `${this.restUrl}/daily_challenges?id=eq.${challengeId}`;
      const challengeResponse = await fetch(challengeUrl, {
        headers: this.headers(userToken),
      });
      const [challenge] = await challengeResponse.json();

      const isCompleted = newProgress >= challenge.target_value;
      const updateData: any = {
        user_id: userId,
        challenge_id: challengeId,
        current_progress: newProgress,
        date_attempted: new Date().toISOString().split('T')[0]
      };

      if (isCompleted && currentProgress < challenge.target_value) {
        updateData.completed_at = new Date().toISOString();
        updateData.points_earned = challenge.points_reward;
        // Award points
        await this.awardPoints(userId, challenge.points_reward, 'daily_challenge', challengeId, 'challenge', userToken);
      }

      // Upsert progress
      const upsertUrl = `${this.restUrl}/user_daily_challenge_progress`;
      const upsertResponse = await fetch(upsertUrl, {
        method: 'POST',
        headers: {
          ...this.headers(userToken),
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(updateData),
      });

      if (!upsertResponse.ok) {
        const error = await upsertResponse.text();
        throw new InternalServerErrorException(`Failed to update challenge progress: ${error}`);
      }
    } catch (error) {
      throw new InternalServerErrorException(`Update challenge progress failed: ${error.message}`);
    }
  }

  // Get leaderboard
  async getLeaderboard(
    leaderboardName: string,
    limit = 100,
    userToken?: string
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get leaderboard configuration
      const leaderboardUrl = `${this.restUrl}/leaderboards?name=eq.${leaderboardName}&is_active=eq.true`;
      const leaderboardResponse = await fetch(leaderboardUrl, {
        headers: this.headers(userToken),
      });

      if (!leaderboardResponse.ok) {
        throw new InternalServerErrorException('Leaderboard not found');
      }

      const [leaderboard] = await leaderboardResponse.json();
      if (!leaderboard) {
        return [];
      }

      // Get leaderboard entries
      const entriesUrl = `${this.restUrl}/leaderboard_entries?leaderboard_id=eq.${leaderboard.id}&order=rank_position.asc&limit=${limit}&select=*,profiles(full_name)`;
      const entriesResponse = await fetch(entriesUrl, {
        headers: this.headers(userToken),
      });

      if (!entriesResponse.ok) {
        // If no entries exist, calculate and cache them
        return await this.calculateLeaderboard(leaderboard, limit, userToken);
      }

      const entries = await entriesResponse.json();
      
      return entries.map((entry: any) => ({
        user_id: entry.user_id,
        rank_position: entry.rank_position,
        score_value: entry.score_value,
        full_name: entry.profiles?.full_name || 'Anonymous User',
      }));
    } catch (error) {
      throw new InternalServerErrorException(`Get leaderboard failed: ${error.message}`);
    }
  }

  // Calculate and cache leaderboard data
  private async calculateLeaderboard(
    leaderboard: any,
    limit: number,
    userToken?: string
  ): Promise<LeaderboardEntry[]> {
    try {
      let query = '';
      let orderBy = '';

      switch (leaderboard.metric_type) {
        case 'total_points':
          query = `${this.restUrl}/profiles?select=id,full_name,total_points&order=total_points.desc&limit=${limit}`;
          orderBy = 'total_points';
          break;
        case 'current_streak':
          query = `${this.restUrl}/profiles?select=id,full_name,current_streak&order=current_streak.desc&limit=${limit}`;
          orderBy = 'current_streak';
          break;
        case 'achievements_count':
          query = `${this.restUrl}/user_achievements?select=user_id,profiles(full_name),count&group=user_id&order=count.desc&limit=${limit}`;
          orderBy = 'count';
          break;
        default:
          return [];
      }

      const response = await fetch(query, {
        headers: this.headers(userToken),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const entries: LeaderboardEntry[] = data.map((item: any, index: number) => ({
        user_id: item.id || item.user_id,
        rank_position: index + 1,
        score_value: item[orderBy] || item.count || 0,
        full_name: item.full_name || item.profiles?.full_name || 'Anonymous User',
      }));

      // Cache the results
      await this.cacheLeaderboardEntries(leaderboard.id, entries, userToken);

      return entries;
    } catch (error) {
      console.error('Failed to calculate leaderboard:', error);
      return [];
    }
  }

  // Cache leaderboard entries for performance
  private async cacheLeaderboardEntries(
    leaderboardId: string,
    entries: LeaderboardEntry[],
    userToken?: string
  ): Promise<void> {
    try {
      // Clear existing entries
      const clearUrl = `${this.restUrl}/leaderboard_entries?leaderboard_id=eq.${leaderboardId}`;
      await fetch(clearUrl, {
        method: 'DELETE',
        headers: this.headers(userToken),
      });

      // Insert new entries
      const insertData = entries.map(entry => ({
        leaderboard_id: leaderboardId,
        user_id: entry.user_id,
        rank_position: entry.rank_position,
        score_value: entry.score_value,
        calculated_at: new Date().toISOString(),
      }));

      const insertUrl = `${this.restUrl}/leaderboard_entries`;
      await fetch(insertUrl, {
        method: 'POST',
        headers: this.headers(userToken),
        body: JSON.stringify(insertData),
      });
    } catch (error) {
      console.error('Failed to cache leaderboard entries:', error);
    }
  }

  // Get user badges
  async getUserBadges(userId: string, userToken?: string): Promise<UserBadge[]> {
    try {
      const url = `${this.restUrl}/user_badges?user_id=eq.${userId}&select=*,badges(*)&order=earned_at.desc`;
      const response = await fetch(url, {
        headers: this.headers(userToken),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to fetch user badges');
      }

      const badges = await response.json();
      return badges.map((item: any) => ({
        ...item,
        badge: item.badges
      }));
    } catch (error) {
      throw new InternalServerErrorException(`Get user badges failed: ${error.message}`);
    }
  }

  // Get user notifications
  async getNotifications(
    userId: string,
    limit = 50,
    userToken?: string
  ): Promise<Notification[]> {
    try {
      const url = `${this.restUrl}/gamification_notifications?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`;
      const response = await fetch(url, {
        headers: this.headers(userToken),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to fetch notifications');
      }

      return await response.json();
    } catch (error) {
      throw new InternalServerErrorException(`Get notifications failed: ${error.message}`);
    }
  }

  // Mark notifications as read
  async markNotificationsRead(
    userId: string,
    notificationIds: string[],
    userToken?: string
  ): Promise<void> {
    try {
      const url = `${this.restUrl}/gamification_notifications?user_id=eq.${userId}&id=in.(${notificationIds.join(',')})`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers(userToken),
        body: JSON.stringify({ is_read: true }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new InternalServerErrorException(`Failed to mark notifications as read: ${error}`);
      }
    } catch (error) {
      throw new InternalServerErrorException(`Mark notifications as read failed: ${error.message}`);
    }
  }

  // Record user activity and trigger gamification events
  async recordActivity(
    userId: string,
    activityType: string,
    referenceId?: string,
    referenceType?: string,
    durationMinutes?: number,
    userToken?: string
  ): Promise<void> {
    try {
      // Calculate points based on activity type
      const pointsMap = {
        'course_started': 10,
        'course_completed': 100,
        'quiz_completed': 25,
        'lecture_viewed': 5,
        'login': 5,
        'section_completed': 20,
        'perfect_score': 50,
        'streak_bonus': 15,
      };

      const pointsEarned = pointsMap[activityType] || 0;
      
      // Record the activity
      const activityData = {
        user_id: userId,
        activity_type: activityType,
        reference_id: referenceId,
        reference_type: referenceType,
        duration_minutes: durationMinutes,
        points_earned: pointsEarned,
        created_at: new Date().toISOString(),
      };

      const activityUrl = `${this.restUrl}/user_activities`;
      const activityResponse = await fetch(activityUrl, {
        method: 'POST',
        headers: {
          ...this.headers(userToken),
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(activityData),
      });

      if (!activityResponse.ok) {
        const error = await activityResponse.text();
        throw new InternalServerErrorException(`Failed to record activity: ${error}`);
      }

      // Award points if applicable
      if (pointsEarned > 0) {
        await this.awardPoints(userId, pointsEarned, activityType, referenceId, referenceType, userToken);
      }

      // Update learning streak for certain activities
      const streakActivities = ['course_completed', 'quiz_completed', 'section_completed', 'login'];
      if (streakActivities.includes(activityType)) {
        await this.updateLearningStreak(userId, 'daily_login', userToken);
      }

      // Check for achievement triggers
      await this.checkAndAwardAchievements(userId, activityType, userToken);

      // Update challenge progress
      await this.updateChallengesFromActivity(userId, activityType, durationMinutes || 0, userToken);

    } catch (error) {
      throw new InternalServerErrorException(`Record activity failed: ${error.message}`);
    }
  }

  // Check and award achievements based on activity
  private async checkAndAwardAchievements(
    userId: string,
    activityType: string,
    userToken?: string
  ): Promise<void> {
    try {
      // Get user's current stats and activities
      const stats = await this.getUserStats(userId, userToken);
      const activitiesUrl = `${this.restUrl}/user_activities?user_id=eq.${userId}&select=activity_type`;
      const activitiesResponse = await fetch(activitiesUrl, {
        headers: this.headers(userToken),
      });
      const activities = activitiesResponse.ok ? await activitiesResponse.json() : [];

      // Count activities by type
      const activityCounts = activities.reduce((acc: any, activity: any) => {
        acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
        return acc;
      }, {});

      // Achievement rules
      const achievementRules = [
        { name: 'first_course_started', trigger: 'course_started', count: 1 },
        { name: 'first_course_completed', trigger: 'course_completed', count: 1 },
        { name: 'quiz_master_bronze', trigger: 'quiz_completed', count: 5 },
        { name: 'quiz_master_silver', trigger: 'quiz_completed', count: 15 },
        { name: 'quiz_master_gold', trigger: 'quiz_completed', count: 50 },
        { name: 'perfect_score', trigger: 'perfect_score', count: 1 },
        { name: 'streak_3_days', trigger: 'streak_milestone', streakCount: 3 },
        { name: 'streak_7_days', trigger: 'streak_milestone', streakCount: 7 },
        { name: 'streak_30_days', trigger: 'streak_milestone', streakCount: 30 },
        { name: 'streak_100_days', trigger: 'streak_milestone', streakCount: 100 },
        { name: 'level_5_reached', trigger: 'level_milestone', level: 5 },
        { name: 'level_10_reached', trigger: 'level_milestone', level: 10 },
        { name: 'points_1000', trigger: 'points_milestone', points: 1000 },
        { name: 'points_5000', trigger: 'points_milestone', points: 5000 },
      ];

      for (const rule of achievementRules) {
        let shouldAward = false;

        if (rule.trigger === activityType && rule.count) {
          shouldAward = activityCounts[activityType] >= rule.count;
        } else if (rule.trigger === 'streak_milestone' && activityType === 'login') {
          shouldAward = stats.current_streak >= (rule.streakCount || 0);
        } else if (rule.trigger === 'level_milestone') {
          shouldAward = stats.current_level >= (rule.level || 0);
        } else if (rule.trigger === 'points_milestone') {
          shouldAward = stats.total_points >= (rule.points || 0);
        }

        if (shouldAward) {
          // Check if achievement already exists
          const existingUrl = `${this.restUrl}/user_achievements?user_id=eq.${userId}&achievement_types.name=eq.${rule.name}`;
          const existingResponse = await fetch(existingUrl, {
            headers: this.headers(userToken),
          });
          const existing = await existingResponse.json();

          if (existing.length === 0) {
            await this.awardAchievement(userId, rule.name, {}, userToken);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  }

  // Update challenges based on activity
  private async updateChallengesFromActivity(
    userId: string,
    activityType: string,
    duration: number,
    userToken?: string
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get active challenges for today
      const challengesUrl = `${this.restUrl}/daily_challenges?date_active=eq.${today}&is_active=eq.true`;
      const challengesResponse = await fetch(challengesUrl, {
        headers: this.headers(userToken),
      });

      if (!challengesResponse.ok) return;
      
      const challenges = await challengesResponse.json();

      for (const challenge of challenges) {
        let progressIncrement = 0;

        switch (challenge.challenge_type) {
          case 'quiz_completion':
            if (activityType === 'quiz_completed') progressIncrement = 1;
            break;
          case 'time_spent':
            if (['lecture_viewed', 'course_progress'].includes(activityType)) {
              progressIncrement = duration;
            }
            break;
          case 'course_progress':
            if (activityType === 'section_completed') progressIncrement = 1;
            break;
          case 'streak_maintain':
            if (['course_completed', 'quiz_completed', 'login'].includes(activityType)) {
              progressIncrement = 1;
            }
            break;
          case 'perfect_score':
            if (activityType === 'perfect_score') progressIncrement = 1;
            break;
        }

        if (progressIncrement > 0) {
          await this.updateChallengeProgress(userId, challenge.id, progressIncrement, userToken);
        }
      }
    } catch (error) {
      console.error('Failed to update challenges from activity:', error);
    }
  }

  // Generate personalized insights for the user
  async generateUserInsights(userId: string, userToken?: string): Promise<any> {
    try {
      const [stats, recentActivities, challenges, achievements] = await Promise.all([
        this.getUserStats(userId, userToken),
        this.getRecentUserActivities(userId, 50, userToken),
        this.getDailyChallenges(userId, userToken),
        this.getUserAchievements(userId, userToken)
      ]);

      const insights = {
        productivity: this.calculateProductivityInsights(recentActivities),
        progress: this.calculateProgressInsights(stats, achievements),
        recommendations: this.generateRecommendations(stats, recentActivities, challenges),
        streakStatus: this.analyzeStreakStatus(stats.current_streak, recentActivities),
        levelProgress: this.calculateLevelProgress(stats),
      };

      return insights;
    } catch (error) {
      console.error('Failed to generate user insights:', error);
      return {
        productivity: { message: 'Unable to calculate productivity' },
        progress: { message: 'Unable to analyze progress' },
        recommendations: [],
        streakStatus: { status: 'unknown' },
        levelProgress: { progress: 0 }
      };
    }
  }

  // Get recent user activities (helper method)
  private async getRecentUserActivities(
    userId: string,
    limit = 50,
    userToken?: string
  ): Promise<any[]> {
    try {
      const url = `${this.restUrl}/user_activities?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`;
      const response = await fetch(url, {
        headers: this.headers(userToken),
      });

      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      return [];
    }
  }

  private calculateProductivityInsights(activities: any[]): any {
    if (activities.length === 0) {
      return { message: 'Not enough activity data', weeklyAverage: 0, trend: 'neutral' };
    }

    // Calculate weekly activity pattern
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentActivities = activities.filter(a => new Date(a.created_at) >= weekAgo);

    // Group by day
    const dailyActivity = {};
    recentActivities.forEach(activity => {
      const day = new Date(activity.created_at).toDateString();
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    });

    const activeDays = Object.keys(dailyActivity).length;
    const weeklyAverage = recentActivities.length / 7;
    const trend = recentActivities.length > activities.slice(7, 14).length ? 'increasing' : 'decreasing';

    return {
      weeklyAverage: Math.round(weeklyAverage * 10) / 10,
      activeDays,
      trend,
      message: `You've been active ${activeDays} days this week with an average of ${Math.round(weeklyAverage * 10) / 10} activities per day.`
    };
  }

  private calculateProgressInsights(stats: any, achievements: any[]): any {
    const recentAchievements = achievements.filter(a => {
      const earnedDate = new Date(a.earned_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return earnedDate >= weekAgo;
    });

    return {
      totalPoints: stats.total_points || 0,
      currentLevel: stats.current_level || 1,
      recentAchievements: recentAchievements.length,
      streakDays: stats.current_streak || 0,
      message: `You're at level ${stats.current_level || 1} with ${stats.total_points || 0} total points. You've earned ${recentAchievements.length} achievements this week!`
    };
  }

  private generateRecommendations(stats: any, activities: any[], challenges: any[]): string[] {
    const recommendations: string[] = [];
    const currentLevel = stats.current_level || 1;
    const currentStreak = stats.current_streak || 0;

    // Streak recommendations
    if (currentStreak === 0) {
      recommendations.push("Start a learning streak by completing any activity today!");
    } else if (currentStreak < 7) {
      recommendations.push(`You're on a ${currentStreak}-day streak! Keep it going to reach the 7-day milestone.`);
    } else if (currentStreak >= 7 && currentStreak < 30) {
      recommendations.push(`Amazing ${currentStreak}-day streak! Can you make it to 30 days?`);
    }

    // Challenge recommendations
    const incompleteChallenges = challenges.filter(c => !c.progress?.completed_at);
    if (incompleteChallenges.length > 0) {
      const easiest = incompleteChallenges.find(c => c.difficulty_level === 'easy');
      if (easiest) {
        recommendations.push(`Try completing "${easiest.title}" - it's an easy challenge that fits your level!`);
      }
    }

    // Activity-based recommendations
    const quizCount = activities.filter(a => a.activity_type === 'quiz_completed').length;
    const courseCount = activities.filter(a => a.activity_type === 'course_completed').length;

    if (quizCount < 5) {
      recommendations.push("Take more quizzes to test your knowledge and earn points!");
    }

    if (courseCount === 0) {
      recommendations.push("Complete your first course to unlock the Course Conqueror achievement!");
    }

    // Level-based recommendations
    if (currentLevel < 3) {
      recommendations.push("Focus on consistent daily learning to level up faster!");
    } else if (currentLevel >= 5) {
      recommendations.push("You're doing great! Try tackling some harder challenges for bonus points.");
    }

    return recommendations.slice(0, 3); // Return top 3 recommendations
  }

  private analyzeStreakStatus(currentStreak: number, activities: any[]): any {
    const today = new Date().toDateString();
    const hasActivityToday = activities.some(a => 
      new Date(a.created_at).toDateString() === today
    );

    if (currentStreak === 0) {
      return {
        status: 'inactive',
        message: 'Start a new streak today!',
        action: 'Complete any learning activity',
        risk: 'none'
      };
    }

    if (hasActivityToday) {
      return {
        status: 'active',
        message: `Great! Your ${currentStreak}-day streak is secure for today.`,
        action: 'Keep learning tomorrow',
        risk: 'none'
      };
    }

    return {
      status: 'at_risk',
      message: `Your ${currentStreak}-day streak is at risk! Complete an activity today to maintain it.`,
      action: 'Complete any learning activity',
      risk: 'high'
    };
  }

  private calculateLevelProgress(stats: any): any {
    const currentLevel = stats.current_level || 1;
    const totalPoints = stats.total_points || 0;

    // Level thresholds from database schema
    const levelThresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];
    
    const currentLevelThreshold = levelThresholds[currentLevel - 1] || 0;
    const nextLevelThreshold = levelThresholds[currentLevel] || levelThresholds[levelThresholds.length - 1];
    
    const pointsInCurrentLevel = totalPoints - currentLevelThreshold;
    const pointsNeededForNext = nextLevelThreshold - currentLevelThreshold;
    const progress = pointsInCurrentLevel / pointsNeededForNext;

    return {
      currentLevel,
      totalPoints,
      pointsInCurrentLevel,
      pointsNeededForNext: nextLevelThreshold - totalPoints,
      progress: Math.min(progress, 1),
      nextLevel: currentLevel < 10 ? currentLevel + 1 : currentLevel
    };
  }

  // Refresh daily challenges (force regeneration)
  async refreshDailyChallenges(userId: string, userToken?: string): Promise<DailyChallenge[]> {
    try {
      const date = new Date().toISOString().split('T')[0];
      
      // Deactivate existing challenges for today
      const deactivateUrl = `${this.restUrl}/daily_challenges?date_active=eq.${date}`;
      await fetch(deactivateUrl, {
        method: 'PATCH',
        headers: this.headers(userToken),
        body: JSON.stringify({ is_active: false }),
      });

      // Generate new challenges
      const newChallenges = await this.generateDynamicChallenges(userId, date, userToken);
      
      return newChallenges;
    } catch (error) {
      throw new InternalServerErrorException(`Refresh daily challenges failed: ${error.message}`);
    }
  }
}