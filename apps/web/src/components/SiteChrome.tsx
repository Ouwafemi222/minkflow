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

function NavLinks({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <Link href="/pricing" className={compact ? undefined : 'btn ghost'}>
        Pricing
      </Link>
      <Link href="/login" className={compact ? undefined : 'btn ghost'}>
        Sign in
      </Link>
      <Link href="/login?mode=signup" className={compact ? undefined : 'btn primary'}>
        Start free
      </Link>
    </>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={overlay ? 'site-header overlay' : 'site-header'}>
      <div className="container site-header-bar">
        <Logo />
        <nav aria-label="Main" className="site-nav">
          <div className="site-nav-wide">
            <NavLinks />
          </div>
          <div className="site-nav-narrow">
            <Link href="/login?mode=signup" className="btn primary">
              Start free
            </Link>
            <details className="site-menu">
              <summary className="btn ghost site-menu-toggle" aria-label="Open menu">
                <span className="site-menu-bars" aria-hidden="true" />
              </summary>
              <div className="site-menu-panel">
                <NavLinks compact />
              </div>
            </details>
          </div>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner small muted">
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
