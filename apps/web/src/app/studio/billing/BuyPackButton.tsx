'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';

export function BuyPackButton({ packId, disabled }: { packId: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await api<{ authorizationUrl: string }>('/api/billing/checkout', { method: 'POST', body: { packId } });
      window.location.assign(authorizationUrl);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn primary" disabled={disabled || busy} onClick={() => void buy()}>
        {busy ? 'Opening checkout…' : 'Buy with Paystack'}
      </button>
      {error ? (
        <span className="error-text" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
