import { authed } from '@/lib/api';
import { adminOverview, assertAdmin } from '@/lib/admin';

export const GET = authed(async (ctx) => {
  assertAdmin(ctx);
  return adminOverview();
});
