import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface ProfileRow {
  id: string;
  role: string;
  education?: string | null;
  graduation_year?: number | null;
  domain?: string | null;
  profession?: string | null;
  onboarding_completed?: boolean | null;
  assessment_completed_at?: string | null;
  learning_path_preference?: string | null;
  career_goal?: string | null;
  focus_areas?: any | null;
  experience_level?: string | null;
  time_commitment?: string | null;
  learning_style?: string | null;
  preferred_pace?: string | null;
  full_name?: string | null;
  year_of_study?: number | null;
  qualification?: string | null;
  location?: string | null;
  current_institute?: string | null;
  previous_learning_experiences?: string | null;
  reason_for_learning?: string | null;
  best_study_time?: string | null;
  past_challenges?: string | null;
  hobbies_extracurricular?: string | null;
  favorites?: string | null; // books/shows/games they enjoy
  sports_arts?: string | null;
  languages?: string | null;
  motivations?: string | null;
}

@Injectable()
export class ProfilesService {
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
    // Prefer service role if available and looks valid (JWT-like: at least 2 dots and sufficient length)
    const sk = this.serviceKey?.trim();
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt) {
      return {
        apikey: sk,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      } as Record<string, string>;
    }
    // Fallback to user context via anon key + user JWT (requires RLS policies)
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
    throw new InternalServerErrorException(
      'Supabase keys missing (set SUPABASE_SERVICE_ROLE or provide user token + SUPABASE_ANON_KEY)',
    );
  }

  async getProfile(
    userId: string,
    userToken?: string,
  ): Promise<ProfileRow | null> {
    const select = encodeURIComponent(
      [
        'id',
        'role',
        'education',
        'graduation_year',
        'domain',
        'profession',
        'onboarding_completed',
        'assessment_completed_at',
        'learning_path_preference',
        'career_goal',
        'focus_areas',
        'experience_level',
        'time_commitment',
        'learning_style',
        'preferred_pace',
        'full_name',
        'year_of_study',
        'qualification',
        'location',
        'current_institute',
        'previous_learning_experiences',
        'reason_for_learning',
        'best_study_time',
        'past_challenges',
        'hobbies_extracurricular',
        'favorites',
        'sports_arts',
        'languages',
        'motivations',
      ].join(','),
    );
    const url = `${this.restUrl}/profiles?id=eq.${userId}&select=${select}&limit=1`;
    const res = await fetch(url, {
      headers: this.headers(userToken),
      cache: 'no-store',
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `profiles select failed: ${res.status} ${msg}`,
      );
    }
    const rows = (await res.json()) as ProfileRow[];
    return rows[0] ?? null;
  }

  async ensureProfile(userId: string, userToken?: string): Promise<ProfileRow> {
    const existing = await this.getProfile(userId, userToken);
    if (existing) return existing;

    const url = `${this.restUrl}/profiles`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers(userToken),
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify([{ id: userId, role: 'student' }]),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `profiles insert failed: ${res.status} ${msg}`,
      );
    }
    const rows = (await res.json()) as ProfileRow[];
    return rows[0] ?? { id: userId, role: 'student' };
  }

  async updateProfile(
    userId: string,
    patch: Partial<ProfileRow>,
    userToken?: string,
  ): Promise<ProfileRow> {
    const url = `${this.restUrl}/profiles?id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers(userToken), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `profiles update failed: ${res.status} ${msg}`,
      );
    }
    // If no rows matched, PostgREST may return 204 No Content when Prefer doesn't return representation.
    // Even with Prefer=return=representation, some setups may still return 204 for no-match.
    if (res.status !== 204) {
      try {
        const rows = (await res.json()) as ProfileRow[];
        if (rows && rows[0]) return rows[0];
      } catch {
        // fallthrough to upsert
      }
    }
    // If no row updated, try upsert (requires insert policy when using user token)
    const upsertRes = await fetch(`${this.restUrl}/profiles`, {
      method: 'POST',
      headers: {
        ...this.headers(userToken),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([{ id: userId, ...patch }]),
    });
    if (!upsertRes.ok) {
      const msg = await upsertRes.text().catch(() => '');
      throw new InternalServerErrorException(
        `profiles upsert failed: ${upsertRes.status} ${msg}`,
      );
    }
    const upsertRows = (await upsertRes.json()) as ProfileRow[];
    return upsertRows[0] ?? { id: userId, role: 'student' };
  }
}
