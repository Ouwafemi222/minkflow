export const palette = {
  primary: '#635BFF',
  primaryStrong: '#4B44E0',
  midnight: '#0B1020',
  ice: '#F7F9FC',
  cyan: '#23D5E8',
  white: '#FFFFFF',
  studioCard: '#171E32',
} as const;

export type PaletteKey = keyof typeof palette;

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const brand = {
  get name(): string {
    return readEnv('NEXT_PUBLIC_PRODUCT_NAME') ?? readEnv('PRODUCT_NAME') ?? 'Minkflow';
  },
  tagline: 'Ideas into motion.',
  description: 'Turn a topic or script into an editable, narrated 2D explainer video.',
  watermarkLabel(): string {
    return `Made with ${this.name}`;
  },
  billingDescriptor(): string {
    return `${this.name} credits`;
  },
};

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) throw new Error(`Invalid hex color: ${hex}`);
  return 0.2126 * channel(clean, 0) + 0.7152 * channel(clean, 2) + 0.0722 * channel(clean, 4);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
