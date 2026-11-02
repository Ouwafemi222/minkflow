import { brand } from '@minkflow/brand';
import Link from 'next/link';

function HostMark() {
  return (
    <svg className="hero-host" viewBox="0 0 320 470" aria-hidden>
      <ellipse cx="160" cy="452" rx="92" ry="14" fill="#fff" opacity="0.1" />
      <rect x="112" y="318" width="36" height="118" rx="18" fill="#171e32" />
      <rect x="172" y="318" width="36" height="118" rx="18" fill="#171e32" />
      <rect x="108" y="418" width="44" height="22" rx="10" fill="#fff" opacity="0.85" />
      <rect x="168" y="418" width="44" height="22" rx="10" fill="#fff" opacity="0.85" />
      <g className="hero-arm-idle">
        <rect x="96" y="188" width="32" height="132" rx="16" fill="#635bff" />
        <circle cx="112" cy="328" r="18" fill="#e8b896" />
      </g>
      <rect x="108" y="168" width="104" height="168" rx="36" fill="#635bff" />
      <rect x="128" y="196" width="64" height="88" rx="16" fill="#fff" opacity="0.12" />
      <g className="hero-arm-point">
        <rect x="192" y="188" width="32" height="132" rx="16" fill="#635bff" />
        <circle cx="208" cy="328" r="18" fill="#e8b896" />
      </g>
      <rect x="146" y="148" width="28" height="28" rx="10" fill="#e8b896" />
      <circle cx="160" cy="100" r="58" fill="#e8b896" />
      <ellipse cx="160" cy="58" rx="54" ry="34" fill="#2a2438" />
      <ellipse className="hero-eye" cx="140" cy="98" rx="8" ry="8" fill="#f7f4ef" />
      <ellipse className="hero-eye" cx="180" cy="98" rx="8" ry="8" fill="#f7f4ef" />
      <circle cx="142" cy="99" r="3.4" fill="#1a1520" />
      <circle cx="182" cy="99" r="3.4" fill="#1a1520" />
      <path d="M146 124 Q160 136 174 124" fill="none" stroke="#7a4a32" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function HeroStage() {
  return (
    <section className="hero-cinematic" aria-labelledby="hero-title">
      <div className="hero-atmosphere" aria-hidden="true">
        <div className="hero-aurora" />
        <div className="hero-beam" />
        <div className="hero-grid" />
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
        <div className="hero-orb hero-orb-c" />
        <div className="hero-grain" />
      </div>

      <div className="hero-layout container">
        <div className="hero-copy">
          <span className="badge hero-badge">Private beta</span>
          <h1 id="hero-title">Turn any idea into a narrated, animated explainer video</h1>
          <p>
            {brand.description} Script, storyboard, voice and captions — all editable, in one place.
          </p>
          <div className="row">
            <Link href="/login?mode=signup" className="btn primary">
              Create your first video
            </Link>
            <Link href="/pricing" className="btn">
              See pricing
            </Link>
          </div>
          <p className="small hero-fineprint">60 free credits on sign-up — enough for a short first video. No card required.</p>
        </div>

        <Link href="/login?mode=signup" className="hero-reel" aria-label="Play a Minkflow explainer, then create your first video. Start free.">
          <span className="hero-reel-chrome">
            <span className="hero-reel-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="hero-reel-title">Minkflow · live preview</span>
            <span className="hero-reel-live">REC</span>
          </span>
          <span className="hero-reel-viewport">
            <span className="hero-scene hero-scene-title">
              <span className="hero-spark" aria-hidden="true" />
              <span className="hero-kicker">60-second explainer</span>
              <span className="hero-big-title">Compound interest</span>
              <span className="hero-rule" />
              <span className="hero-sub">How small savings grow while you sleep</span>
            </span>
            <span className="hero-scene hero-scene-host">
              <HostMark />
              <span className="hero-board">
                <span className="hero-board-kicker">On screen</span>
                <strong>Money that works while you sleep</strong>
                <span className="hero-stat">
                  <em>$36k</em>
                  You contribute
                </span>
                <span className="hero-stat hero-stat-accent">
                  <em>$122k</em>
                  At 7% over 30 years
                </span>
              </span>
            </span>
            <span className="hero-scene hero-scene-cta">
              <span className="hero-cta-kicker">Your video is ready</span>
              <span className="hero-cta-title">Create yours in minutes</span>
              <span className="hero-cta-pill">Create your first video</span>
            </span>
            <span className="hero-captions">
              <span className="hero-caption-line">What if your money could work while you sleep?</span>
            </span>
          </span>
          <span className="hero-reel-bar">
            <span className="hero-reel-play" aria-hidden="true">
              ▶
            </span>
            <span className="hero-reel-progress">
              <span />
            </span>
            <span className="hero-reel-action">Click to start free</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
