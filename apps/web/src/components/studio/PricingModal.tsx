'use client';

import { CREDIT_PACKS, PRICING } from '@minkflow/contracts';
import { X } from 'lucide-react';
import Link from 'next/link';

const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export function PricingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pricing-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="pricing-modal card stack" role="dialog" aria-labelledby="pricing-modal-title" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="pricing-modal-title" style={{ margin: 0 }}>
            Credits
          </h2>
          <button className="btn ghost sm" type="button" aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Buy credits to unlock extra edit tools. Every action still shows its cost before you confirm.
        </p>
        <div className="grid" style={{ ['--min' as string]: '160px' }}>
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="card stack" style={{ ['--gap' as string]: '6px', padding: 14 }}>
              <strong>{pack.label}</strong>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{usd(pack.usdCents)}</span>
              <span className="muted small">{pack.credits.toLocaleString('en-US')} credits</span>
              <Link href="/studio/billing" className="btn primary">
                Get credits
              </Link>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Voiceover is {PRICING.mediaCreditsPer1kChars} credits per 1,000 characters. Final 1080p render is {PRICING.renderCreditsPerSecond} credits per second.
        </p>
      </div>
    </div>
  );
}
