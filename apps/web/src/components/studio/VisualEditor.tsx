'use client';

import { ICON_IDS } from '@minkflow/contracts';

type Json = string | number | boolean | null | undefined | Json[] | { [k: string]: Json };

const label = (key: string) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** Generic editor for template visuals; the result is validated against the template schema by the caller. */
export function VisualEditor({ value, onChange, path = 'visual', name = '' }: { value: Json; onChange: (next: Json) => void; path?: string; name?: string }) {
  const id = path.replace(/[^\w-]/g, '-');
  if (typeof value === 'string') {
    if (name === 'icon') {
      return (
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {ICON_IDS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
        </select>
      );
    }
    return value.length > 60 ? (
      <textarea id={id} className="input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (typeof value === 'number') {
    return <input id={id} className="input" type="number" step="any" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
  }
  if (Array.isArray(value)) {
    return (
      <div className="stack" style={{ ['--gap' as string]: '8px' }}>
        {value.map((item, i) => (
          <div key={i} className="card" style={{ padding: 10, background: 'var(--surface-inset)' }}>
            <div className="spread small muted">
              <span>
                {label(name || 'item')} {i + 1}
              </span>
              <button type="button" className="btn sm ghost" aria-label={`Remove ${name || 'item'} ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
            <VisualEditor value={item} path={`${path}-${i}`} name={name} onChange={(next) => onChange(value.map((v, j) => (j === i ? next : v)))} />
          </div>
        ))}
        {value.length > 0 ? (
          <button type="button" className="btn sm" onClick={() => onChange([...value, structuredClone(value.at(-1)!)])}>
            Add {name ? label(name).replace(/s$/, '').toLowerCase() : 'item'}
          </button>
        ) : null}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div className="stack" style={{ ['--gap' as string]: '8px' }}>
        {Object.entries(value).map(([key, v]) =>
          v === undefined ? null : (
            <div key={key} className="field">
              <label htmlFor={`${id}-${key}`} className="small" style={{ fontWeight: 600 }}>
                {label(key)}
              </label>
              <VisualEditor value={v} path={`${id}-${key}`} name={key} onChange={(next) => onChange({ ...value, [key]: next })} />
            </div>
          ),
        )}
      </div>
    );
  }
  return null;
}
