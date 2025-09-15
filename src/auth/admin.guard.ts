import { Injectable, CanActivate, ExecutionContext, ForbiddenException, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
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
    throw new InternalServerErrorException('Supabase service role key missing for admin guard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    try {
      // Check if user has admin role in profiles table
      const url = `${this.restUrl}/profiles?id=eq.${user.id}&select=role`;
      const response = await fetch(url, { headers: this.headers() });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to verify user role');
      }

      const profiles = await response.json();
      
      if (profiles.length === 0) {
        throw new ForbiddenException('User profile not found');
      }

      const profile = profiles[0];
      
      if (profile.role !== 'admin') {
        throw new ForbiddenException('Admin access required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify admin privileges');
    }
  }
}