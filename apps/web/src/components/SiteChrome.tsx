import { brand } from '@minkflow/brand';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label={`${brand.name} home`}>
      <img className="logo-mark" src="/brand/minkflow-mark.png" alt="" width={30} height={30} />
      <span className="logo-word" aria-hidden="true">
        mink<span className="logo-word-accent">flow</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={overlay ? 'site-header overlay' : 'site-header'}>
      <div className="container spread">
        <Logo />
        <nav aria-label="Main" className="row">
          <Link href="/pricing" className="btn ghost">
            Pricing
          </Link>
          <Link href="/login" className="btn ghost">
            Sign in
          </Link>
          <Link href="/login?mode=signup" className="btn primary">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container spread small muted">
        <span>
          © {new Date().getFullYear()} {brand.name}. {brand.tagline}
        </span>
        <nav aria-label="Legal" className="row">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/acceptable-use">Acceptable use</Link>
          <Link href="/legal/refunds">Credits & refunds</Link>
        </nav>
      </div>
    </footer>
  );
}

export function MarketingShell({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  return (
    <>
      <SiteHeader overlay={overlay} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
