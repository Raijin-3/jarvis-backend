import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';

@Injectable()
export class SupabaseGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  private getJwks() {
    if (!this.jwks) {
      const base =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!base) throw new InternalServerErrorException('SUPABASE_URL not set');
      this.jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/keys`));
    }
    return this.jwks;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing token');
    const token = auth.slice(7);

    try {
      // Verify signature against Supabase JWKS.
      // Do not enforce issuer/audience strictly to avoid env mismatches during dev.
      const { payload } = await jwtVerify(token, this.getJwks());
      req.user = { id: payload.sub, email: (payload as any).email };
      return true;
    } catch (err) {
      // Optional dev override to unblock local work when JWKS is unreachable
      if (
        process.env.ALLOW_DEV_UNVERIFIED_JWT === '1' ||
        process.env.NODE_ENV === 'test'
      ) {
        try {
          const payload: any = decodeJwt(token);
          req.user = { id: payload.sub, email: payload.email };
          return true;
        } catch {}
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
