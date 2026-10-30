import { toMicro } from '@minkflow/contracts';
import { audit, grantCredits } from '@minkflow/db';
import { AppError } from '@minkflow/shared';
import { z } from 'zod';
import { authed, readJson } from '@/lib/api';
import { assertAdmin } from '@/lib/admin';
import { db } from '@/lib/services';

/** Beta credit grants (ADR-008: used until Paystack USD settlement is approved). Audited and idempotent. */
export const POST = authed(
  async (ctx) => {
    assertAdmin(ctx);
    const body = await readJson(ctx.req, z.object({ email: z.email(), credits: z.number().positive().max(10_000), reason: z.string().trim().min(3).max(200), requestKey: z.uuid() }));
    const { rows } = await db().query<{ id: string }>(
      `select w.id from public.workspaces w join auth.users u on u.id = w.owner_id where lower(u.email) = lower($1)`,
      [body.email],
    );
    const workspaceId = rows[0]?.id;
    if (!workspaceId) throw new AppError('NOT_FOUND', 'No workspace for that email');
    const granted = await grantCredits(db(), workspaceId, toMicro(body.credits), 'grant', 'admin_grant', body.requestKey, `admin:${body.requestKey}`);
    await audit(db(), { actorId: ctx.session.userId, workspaceId, action: 'credits.granted', targetId: body.requestKey, metadata: { credits: body.credits, reason: body.reason, granted } });
    return { granted, workspaceId };
  },
  { rateLimit: { key: 'admin', perMinute: 30 } },
);
