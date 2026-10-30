'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';

export function BuyPackButton({ packId, disabled }: { packId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn primary"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const { authorizationUrl } = await api<{ authorizationUrl: string }>('/api/billing/checkout', { method: 'POST', body: { packId } });
            window.location.assign(authorizationUrl);
          } catch (e) {
            setError(errorMessage(e));
            setPending(false);
          }
        }}
      >
        {pending ? 'Opening checkout…' : disabled ? 'Coming soon' : 'Buy'}
      </button>
      {error ? (
        <span className="error-text" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
