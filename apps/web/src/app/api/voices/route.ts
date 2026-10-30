import { authed } from '@/lib/api';
import { env } from '@/lib/env';
import { availableVoices } from '@/lib/voices';

export const GET = authed(async () => ({ voices: availableVoices(), mock: env().AI_PROVIDER_MODE !== 'live' }));
