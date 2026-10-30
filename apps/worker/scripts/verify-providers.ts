/**
 * Checks live provider credentials and model/voice configuration with the smallest possible calls
 * (one moderation call, two tiny JSON completions, one ~25-character TTS call: well under US$0.05 in total).
 *
 *   AI_PROVIDER_MODE=live pnpm --filter @minkflow/worker verify:providers
 *
 * Prints only pass/fail, model names and usage; never prints keys or provider responses.
 */
import { createProvidersFromEnv, type Usage } from '@minkflow/ai';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../src/env';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const envFile = resolve(repoRoot, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = loadEnv();
if (env.AI_PROVIDER_MODE !== 'live') {
  console.error('Set AI_PROVIDER_MODE=live (and the OPENAI_* / ELEVENLABS_* variables) to verify real providers.');
  process.exit(2);
}

const { llm, tts } = createProvidersFromEnv(env);
const usages: Usage[] = [];
let failed = false;

async function check(name: string, fn: () => Promise<string>) {
  try {
    console.log(`PASS ${name}: ${await fn()}`);
  } catch (error) {
    failed = true;
    const e = error as { code?: string; message?: string; details?: unknown };
    console.log(`FAIL ${name}: ${e.code ?? ''} ${e.message ?? String(error)} ${e.details ? JSON.stringify(e.details) : ''}`.trim());
  }
}

await check('openai moderation', async () => {
  const r = await llm.moderate('A short explainer about how saving money works.');
  if (r.usage) usages.push(r.usage);
  if (r.flagged) throw new Error('benign text was flagged');
  return `model=${env.OPENAI_MODEL_MODERATION || 'omni-moderation-latest'} flagged=false`;
});

for (const model of ['script', 'storyboard'] as const) {
  await check(`openai json (${model})`, async () => {
    const r = await llm.completeJson(
      [
        { role: 'system', content: 'Reply with a JSON object only.' },
        { role: 'user', content: 'Return {"ok": true}.' },
      ],
      { model, maxOutputTokens: 200 },
    );
    usages.push(r.usage);
    const parsed = JSON.parse(r.text) as { ok?: unknown };
    if (parsed.ok !== true) throw new Error('unexpected JSON shape');
    return `model=${r.usage.model}`;
  });
}

const voice = tts.listVoices()[0];
await check('elevenlabs tts with timestamps', async () => {
  if (!voice) throw new Error('ELEVENLABS_VOICE_IDS is empty');
  const r = await tts.synthesize('Testing the Minkflow voice.', voice.id);
  usages.push(r.usage);
  if (r.words.length < 3) throw new Error(`expected word timings, got ${r.words.length}`);
  return `model=${tts.model} voice=${voice.name} bytes=${r.audio.byteLength} words=${r.words.length} endMs=${r.alignmentEndMs}`;
});

const usd = usages.reduce((n, u) => n + u.estimatedUsd, 0);
console.log(`Estimated spend: $${usd.toFixed(4)} (from configured unit prices; TO VERIFY against provider dashboards)`);
process.exit(failed ? 1 : 0);
