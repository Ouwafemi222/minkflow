import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketingShell } from '@/components/SiteChrome';
import { LEGAL_DOCS } from '../content';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: LEGAL_DOCS[doc]?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const page = LEGAL_DOCS[doc];
  if (!page) notFound();
  return (
    <MarketingShell>
      <article className="container prose" style={{ padding: '40px 20px' }}>
        <p className="alert warning small">Beta draft — this document is under legal review and may change before public launch.</p>
        <h1>{page.title}</h1>
        <p className="muted">{page.summary}</p>
        {page.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </MarketingShell>
  );
}
