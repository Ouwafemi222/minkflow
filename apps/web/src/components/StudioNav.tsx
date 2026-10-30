'use client';

import { CreditCard, FolderOpen, Plus, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function StudioNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: '/studio', label: 'Projects', icon: FolderOpen, active: path === '/studio' || path.startsWith('/studio/projects') },
    { href: '/studio/new', label: 'New video', icon: Plus, active: path === '/studio/new' },
    { href: '/studio/billing', label: 'Credits & billing', icon: CreditCard, active: path.startsWith('/studio/billing') },
    ...(isAdmin ? [{ href: '/studio/admin', label: 'Admin', icon: Shield, active: path.startsWith('/studio/admin') }] : []),
  ];
  return (
    <nav className="stack" style={{ ['--gap' as string]: '2px' }}>
      {links.map(({ href, label, icon: Icon, active }) => (
        <Link key={href} href={href} className="nav-link" aria-current={active ? 'page' : undefined}>
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
