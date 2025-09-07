import { Controller, Get, Headers } from '@nestjs/common';
import { decodeJwt } from 'jose';

@Controller('v1/debug')
export class DebugController {
  @Get('jwt')
  jwt(@Headers('authorization') auth?: string) {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) return { error: 'no token' };
    try {
      const p: any = decodeJwt(token);
      return {
        sub: p.sub,
        iss: p.iss,
        aud: p.aud,
        iat: p.iat,
        exp: p.exp,
        email: p.email,
      };
    } catch (e: any) {
      return { error: e?.message || 'decode error' };
    }
  }

  @Get('jwks')
  async jwks() {
    const url = `${process.env.SUPABASE_URL}/auth/v1/keys`;
    try {
      const res = await fetch(url);
      return { url, status: res.status };
    } catch (e: any) {
      return { url, error: e?.message };
    }
  }
}
