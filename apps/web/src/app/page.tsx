import { brand } from '@minkflow/brand';
import { TEMPLATE_IDS, TEMPLATE_META } from '@minkflow/contracts';
import Link from 'next/link';
import { MarketingShell } from '@/components/SiteChrome';

const STEPS = [
  { title: 'Start with a topic or your script', body: 'Describe what you want to explain, or paste a script you already wrote.' },
  { title: 'Review the script', body: 'Edit every line. Statements that need fact-checking are flagged for you to confirm.' },
  { title: 'Shape the storyboard', body: 'Reorder scenes, swap templates, edit on-screen text, and regenerate a single scene.' },
  { title: 'Voice, captions, render', body: 'Natural narration with word-timed captions, rendered to a 1080p MP4.' },
];

const FAQ = [
  { q: 'Who is it for?', a: 'Solo YouTube creators who publish faceless explainer videos and want a fast, editable first cut.' },
  { q: 'Can I edit everything?', a: 'Yes. Script, scene order, templates, on-screen text, narration and theme are all editable before you render.' },
  { q: 'Do I own my videos?', a: 'You own the content you provide and the videos you export, subject to our Terms and the voice provider’s terms.' },
  { q: 'How does pricing work?', a: 'Pay-as-you-go credits. You see the exact credit cost before every generation or render, and failed jobs are refunded.' },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="hero container">
        <span className="badge">Private beta</span>
        <h1>Turn any idea into a narrated, animated explainer video</h1>
        <p>{brand.description} Script, storyboard, voice and captions — all editable, in one place.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link href="/login" className="btn primary">
            Create your first video
          </Link>
          <Link href="/pricing" className="btn">
            See pricing
          </Link>
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>
          60 free credits on sign-up — enough for a short first video. No card required.
        </p>
      </section>

      <section className="section container" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="grid" style={{ listStyle: 'none', padding: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <div className="badge">Step {i + 1}</div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section container" aria-labelledby="templates">
        <h2 id="templates">{TEMPLATE_IDS.length} motion templates built for explainers</h2>
        <ul className="grid" style={{ listStyle: 'none', padding: 0, ['--min' as string]: '200px' }}>
          {TEMPLATE_IDS.map((id) => (
            <li key={id} className="card">
              <strong>{TEMPLATE_META[id].label}</strong>
              <p className="small muted">{TEMPLATE_META[id].description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section container" aria-labelledby="faq">
        <h2 id="faq">Questions</h2>
        <div className="stack">
          {FAQ.map((f) => (
            <details key={f.q} className="card">
              <summary>
                <strong>{f.q}</strong>
              </summary>
              <p className="muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
