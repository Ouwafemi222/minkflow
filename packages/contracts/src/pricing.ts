import type { JobType } from './jobs';

/** 1 credit = 1,000,000 microcredits; the ledger stores integers only. */
export const MICRO = 1_000_000;

/** PROVISIONAL prices (ADR-016). TO VERIFY against measured provider cost during beta (docs/VERIFY.md V-10). */
export const PRICING = {
  scriptCredits: 2,
  storyboardCredits: 3,
  sceneRegenerateCredits: 1,
  mediaCreditsPer1kChars: 8,
  previewCreditsPerSecond: 0.05,
  renderCreditsPerSecond: 0.5,
  signupGrantCredits: 60,
} as const;

export const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', usdCents: 900, credits: 650 },
  { id: 'creator', label: 'Creator', usdCents: 1900, credits: 1650 },
  { id: 'pro', label: 'Pro', usdCents: 3900, credits: 4100 },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export function findPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export const toMicro = (credits: number) => Math.round(credits * MICRO);
export const fromMicro = (micro: number) => micro / MICRO;
export const formatCredits = (micro: number) => fromMicro(micro).toLocaleString('en-US', { maximumFractionDigits: 2 });

export interface QuoteInput {
  type: JobType;
  /** Narration characters that are NOT already cached (media). */
  uncachedChars?: number;
  /** Video length in seconds (preview/render). */
  seconds?: number;
}

/** Upper-bound reservation in microcredits for a job. */
export function quoteMicro(input: QuoteInput): number {
  switch (input.type) {
    case 'script':
      return toMicro(PRICING.scriptCredits);
    case 'storyboard':
      return toMicro(PRICING.storyboardCredits);
    case 'scene_regenerate':
      return toMicro(PRICING.sceneRegenerateCredits);
    case 'media':
      return Math.ceil(((input.uncachedChars ?? 0) / 1000) * PRICING.mediaCreditsPer1kChars * MICRO);
    case 'preview':
      return Math.ceil((input.seconds ?? 0) * PRICING.previewCreditsPerSecond * MICRO);
    case 'render':
      return Math.ceil((input.seconds ?? 0) * PRICING.renderCreditsPerSecond * MICRO);
    default:
      return 0;
  }
}
