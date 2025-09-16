import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

type ProfileRow = { role?: string };

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly restUrl = `${process.env.SUPABASE_URL}/rest/v1`;
  private readonly serviceKey = process.env.SUPABASE_SERVICE_ROLE?.trim();
  private readonly anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  private readonly allowDevAnon = process.env.ALLOW_DEV_UNVERIFIED_JWT === '1';

  // Build headers for PostgREST (service role in prod; anon in dev if allowed)
  private buildHeaders(): HeadersInit | null {
    const sk = this.serviceKey;
    const looksJwt = sk && sk.split('.').length === 3 && sk.length > 60;
    if (looksJwt) {
      return {
        apikey: sk as string,
        Authorization: `Bearer ${sk}`,
        'Content-Type': 'application/json',
      };
    }
    if (this.allowDevAnon && this.anonKey) {
      return {
        apikey: this.anonKey as string,
        Authorization: `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
      };
    }
    return null; // no keys available → fail closed
  }

  private getUserId(user: any): string | null {
    return user?.id ?? user?.sub ?? null;
  }

  private async getRole(userId: string): Promise<string | null> {
    const headers = this.buildHeaders();
    if (!headers || !this.restUrl) return null;

    const url =
      `${this.restUrl}/profiles?select=role&limit=1&id=eq.` +
      encodeURIComponent(userId);

    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) return null;
      const rows = (await res.json()) as ProfileRow[];
      return rows?.[0]?.role ?? null;
    } catch {
      return null;
    }
  }

  // Returns true iff profile.role === 'admin'; false otherwise
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest() as any;
    const userId = this.getUserId(req?.user);

    // Expose a convenience flag to downstream handlers (optional)
    req.isAdmin = false;

    if (!userId) return false;

    const role = await this.getRole(userId);
    const isAdmin = role === 'admin';
    req.isAdmin = isAdmin;

    return isAdmin;
  }
}
