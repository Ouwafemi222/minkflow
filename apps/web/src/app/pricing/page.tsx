import { CREDIT_PACKS, PRICING } from '@minkflow/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/SiteChrome';

export const metadata: Metadata = { title: 'Pricing' };

const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default function PricingPage() {
  const sixtySecondVideo = PRICING.scriptCredits + PRICING.storyboardCredits + PRICING.mediaCreditsPer1kChars * 0.9 + 60 * PRICING.previewCreditsPerSecond + 60 * PRICING.renderCreditsPerSecond;
  return (
    <MarketingShell>
      <section className="section container">
        <h1 style={{ fontSize: 40, letterSpacing: '-0.02em' }}>Simple, pay-as-you-go credits</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Every action shows its credit cost before you confirm. Failed or canceled jobs are refunded automatically. Credits are sold in US dollars.
        </p>
        <div className="grid" style={{ marginTop: 24 }}>
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="card stack">
              <strong style={{ fontSize: 18 }}>{pack.label}</strong>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{usd(pack.usdCents)}</div>
              <div className="muted">{pack.credits.toLocaleString()} credits</div>
              <div className="small muted">≈ {Math.floor(pack.credits / sixtySecondVideo)} one-minute videos</div>
              <Link href="/login?mode=signup" className="btn primary">
                Get started
              </Link>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20 }}>What things cost</h2>
          <table className="table">
            <tbody>
              <tr><td>Write a script</td><td>{PRICING.scriptCredits} credits</td></tr>
              <tr><td>Build a storyboard</td><td>{PRICING.storyboardCredits} credits</td></tr>
              <tr><td>Regenerate one scene</td><td>{PRICING.sceneRegenerateCredits} credit</td></tr>
              <tr><td>Voiceover + captions</td><td>{PRICING.mediaCreditsPer1kChars} credits per 1,000 characters (unchanged scenes are free)</td></tr>
              <tr><td>Draft preview (360p)</td><td>{PRICING.previewCreditsPerSecond} credits per second</td></tr>
              <tr><td>Final render (1080p MP4)</td><td>{PRICING.renderCreditsPerSecond} credits per second</td></tr>
            </tbody>
          </table>
          <p className="small muted">
            New accounts get {PRICING.signupGrantCredits} free credits. Videos from accounts without a purchase include a small watermark. Prices are provisional during the beta.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
