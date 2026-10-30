'use client';

import { FONT_FAMILIES, THEME_PRESETS, type BrandKit, type ThemePresetId } from '@minkflow/contracts';
import { useRef, useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/client';
import type { ProjectView } from '@/lib/project-view';

const PRESET_LABELS: Record<ThemePresetId, string> = { minkflow_dark: 'Midnight (dark)', paper_light: 'Paper (light)', warm_studio: 'Warm studio' };
const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  view: ProjectView;
  disabled: boolean;
  onSaved: (version: number, brand: BrandKit) => void;
  onError: (text: string) => void;
}

/** Brand kit: colour preset, video font, burned-in captions and an optional logo (PNG/JPEG/WebP, max 2 MB). */
export function BrandPanel({ view, disabled, onSaved, onError }: Props) {
  const brand = view.doc.brand;
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = (Object.keys(THEME_PRESETS) as ThemePresetId[]).find((id) => THEME_PRESETS[id].background === brand.theme.background && THEME_PRESETS[id].primary === brand.theme.primary);

  async function save(next: BrandKit) {
    setPending(true);
    try {
      const res = await api<{ version: number }>(`/api/projects/${view.project.id}/document`, { method: 'PUT', body: { expectedVersion: view.project.version, brand: next } });
      onSaved(res.version, next);
    } catch (error) {
      onError(error instanceof ApiError && error.body.code === 'REVISION_CONFLICT' ? 'This project changed in another tab. Reload the page to continue editing.' : errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function upload(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return onError('Upload a PNG, JPEG or WebP image.');
    if (file.size > MAX_BYTES) return onError('Logos can be at most 2 MB.');
    setPending(true);
    try {
      const target = await api<{ key: string; url: string; headers: Record<string, string> }>('/api/assets/upload-url', { method: 'POST', body: { contentType: file.type, size: file.size } });
      const put = await fetch(target.url, { method: 'PUT', headers: target.headers, body: file });
      if (!put.ok) throw new Error('Upload failed. Please try again.');
      const { asset } = await api<{ asset: { id: string } }>('/api/assets/complete', { method: 'POST', body: { key: target.key } });
      await save({ ...brand, logoAssetId: asset.id });
    } catch (error) {
      onError(errorMessage(error));
      setPending(false);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const locked = disabled || pending;
  return (
    <section className="card stack" aria-labelledby="brand-heading" style={{ ['--gap' as string]: '12px' }}>
      <h2 id="brand-heading" style={{ margin: 0 }}>
        Brand kit
      </h2>
      <div className="grid" style={{ ['--min' as string]: '200px' }}>
        <label className="field">
          Colours
          <select className="input" disabled={locked} value={preset ?? ''} onChange={(e) => void save({ ...brand, theme: { ...THEME_PRESETS[e.target.value as ThemePresetId], fontFamily: brand.theme.fontFamily } })}>
            {preset ? null : <option value="">Custom</option>}
            {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((id) => (
              <option key={id} value={id}>
                {PRESET_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Video font
          <select className="input" disabled={locked} value={brand.theme.fontFamily} onChange={(e) => void save({ ...brand, theme: { ...brand.theme, fontFamily: e.target.value as BrandKit['theme']['fontFamily'] } })}>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="row" style={{ alignSelf: 'end', minHeight: 40 }}>
          <input type="checkbox" disabled={locked} checked={brand.captionsEnabled} onChange={(e) => void save({ ...brand, captionsEnabled: e.target.checked })} />
          Burn in captions
        </label>
      </div>
      <div className="row">
        <span className="small" style={{ fontWeight: 600 }}>
          Logo
        </span>
        <span className="small muted">{brand.logoAssetId ? 'Shown in the top-right corner of every scene.' : 'None'}</span>
        <label className="btn sm" aria-disabled={locked} style={locked ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
          {brand.logoAssetId ? 'Replace logo' : 'Upload logo'}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={locked} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        {brand.logoAssetId ? (
          <button className="btn sm ghost" disabled={locked} onClick={() => void save({ ...brand, logoAssetId: null })}>
            Remove logo
          </button>
        ) : null}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Only upload logos you have the right to use. Brand changes apply to the live preview immediately and to the next preview or render.
      </p>
    </section>
  );
}
