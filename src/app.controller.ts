import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { SupabaseGuard } from './auth/supabase.guard';

@Controller('v1')
export class AppController {
  @Get('health') health() {
    return { ok: true };
  }

  @UseGuards(SupabaseGuard)
  @Get('me')
  me(@Req() req: any) {
    return { user: req.user };
  }

  @UseGuards(SupabaseGuard)
  @Get('orgs/:id')
  async getOrg() {
    /* query Supabase Postgres with RLS via pg */ return {};
  }
}
