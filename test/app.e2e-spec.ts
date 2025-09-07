import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Mock jose so SupabaseGuard accepts a known token
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(async (token: string) => {
    if (token === 'valid-token') {
      return {
        payload: { sub: 'user-123', email: 'learner@example.com' },
      } as any;
    }
    throw new Error('invalid token');
  }),
}));

describe('API e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon';
    // Mock fetch used by ProfilesService to avoid network calls
    // @ts-ignore
    global.fetch = jest.fn(async (url: string, init?: any) => {
      if (typeof url === 'string' && url.includes('/rest/v1/profiles')) {
        if (init?.method === 'POST') {
          return {
            ok: true,
            json: async () => [{ id: 'user-123', role: 'learner' }],
          } as any;
        }
        if (init?.method === 'PATCH') {
          const body = init?.body ? JSON.parse(init.body) : {};
          const merged = {
            id: 'user-123',
            role: 'learner',
            ...(Array.isArray(body) ? body[0] : body),
          };
          return { ok: true, json: async () => [merged] } as any;
        }
        // GET
        return {
          ok: true,
          json: async () => [{ id: 'user-123', role: 'learner' }],
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // @ts-ignore
    global.fetch?.mockReset?.();
    await app.close();
  });

  it('GET /v1/health -> ok', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true });
      });
  });

  it('GET /v1/me without token -> 401', async () => {
    await request(app.getHttpServer()).get('/v1/me').expect(401);
  });

  it('GET /v1/me with valid token -> user payload', async () => {
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.user).toEqual({
          id: 'user-123',
          email: 'learner@example.com',
        });
      });
  });

  it('GET /v1/dashboard with valid token -> role-based data', async () => {
    await request(app.getHttpServer())
      .get('/v1/dashboard')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.user?.id).toBe('user-123');
        expect(body.role).toBeDefined();
      });
  });

  it('GET /v1/profile without token -> 401', async () => {
    await request(app.getHttpServer()).get('/v1/profile').expect(401);
  });

  it('GET /v1/profile with valid token -> profile data', async () => {
    await request(app.getHttpServer())
      .get('/v1/profile')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe('user-123');
        expect(['learner', 'teacher', 'admin']).toContain(body.role);
      });
  });

  it('PUT /v1/profile updates fields', async () => {
    await request(app.getHttpServer())
      .put('/v1/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({
        education: 'B.Sc',
        graduation_year: 2024,
        domain: 'Retail',
        profession: 'Analyst',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.education).toBe('B.Sc');
        expect(body.graduation_year).toBe(2024);
        expect(body.onboarding_completed).toBeTruthy();
      });
  });

  // TODO: RLS cross-org protection (requires real DB + RLS policies)
  // This is a placeholder to document expected behavior once the org endpoint
  // queries Supabase Postgres with RLS enabled.
  describe.skip('RLS org access', () => {
    it('rejects fetching another org by id', async () => {
      await request(app.getHttpServer())
        .get('/v1/orgs/some-other-org-id')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);
    });
  });
});
