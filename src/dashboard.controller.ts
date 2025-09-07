import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';
import { ProfilesService } from './profiles.service';

@Controller('v1')
export class DashboardController {
  constructor(private readonly profiles: ProfilesService) {}

  @UseGuards(SupabaseGuard)
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    const token = (req.headers.authorization as string | undefined)?.replace(
      /^Bearer\s+/i,
      '',
    );
    const profile = await this.profiles.ensureProfile(req.user.id, token);
    const role = profile.role ?? 'student';
    const displayName = req.user.email?.split('@')[0] ?? 'Learner';

    if (role === 'admin') {
      return {
        role,
        user: { id: req.user.id, displayName },
        panels: ['Org Health', 'User Growth', 'System Metrics'],
      };
    }
    if (role === 'teacher') {
      return {
        role,
        user: { id: req.user.id, displayName },
        panels: ['Cohorts', 'Assignments', 'Progress'],
      };
    }
    return {
      role,
      user: { id: req.user.id, displayName },
      stats: { xp: 5420, streakDays: 12, tier: 'Silver' },
      coins: 320,
      leaderboardPosition: 128,
      nextActions: [
        { label: 'Resume last lesson', href: '/lessons/123' },
        { label: 'Daily review pack', href: '/reviews/today' },
        { label: 'Generate case study', href: '/assignments/new' },
      ],
      badges: [
        { name: '7-Day Streak', earnedAt: new Date().toISOString() },
        { name: 'SQL Novice', earnedAt: new Date().toISOString() },
        { name: 'Quiz Whiz', earnedAt: new Date().toISOString() },
      ],
      history: [
        {
          date: new Date().toISOString(),
          action: 'Completed SQL Joins lesson',
          xp: 120,
          coins: 10,
        },
        {
          date: new Date(Date.now() - 86400000).toISOString(),
          action: 'Daily streak maintained',
          xp: 20,
          coins: 2,
        },
        {
          date: new Date(Date.now() - 2 * 86400000).toISOString(),
          action: 'Passed weekly assessment',
          xp: 300,
          coins: 30,
        },
      ],
      weeklyXp: [
        { week: 'W1', XP: 820 },
        { week: 'W2', XP: 1040 },
        { week: 'W3', XP: 660 },
        { week: 'W4', XP: 900 },
      ],
      completion: [
        { name: 'SQL', value: 65 },
        { name: 'Statistics', value: 40 },
        { name: 'Python', value: 20 },
      ],
    };
  }
}
