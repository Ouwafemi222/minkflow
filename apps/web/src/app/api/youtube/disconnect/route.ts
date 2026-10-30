import { audit, deleteYoutubeConnection } from '@minkflow/db';
import { decryptSecret } from '@minkflow/shared/node';
import { authed, log } from '@/lib/api';
import { env } from '@/lib/env';
import { db } from '@/lib/services';
import { revokeToken } from '@/lib/youtube-oauth';

/** Removes the stored channel and revokes Minkflow's access at Google (best effort). */
export const POST = authed(
  async (ctx) => {
    const ws = await ctx.workspace();
    const ciphertext = await deleteYoutubeConnection(db(), ws.id);
    let revoked = false;
    if (ciphertext && env().TOKEN_ENCRYPTION_KEY) {
      try {
        revoked = await revokeToken(decryptSecret(ciphertext, env().TOKEN_ENCRYPTION_KEY));
      } catch (error) {
        log.warn('youtube revoke failed', { workspaceId: ws.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (ciphertext) await audit(db(), { actorId: ctx.session.userId, workspaceId: ws.id, action: 'youtube.disconnected', metadata: { revoked } });
    return { disconnected: Boolean(ciphertext), revoked };
  },
  { rateLimit: { key: 'youtube', perMinute: 10 } },
);
