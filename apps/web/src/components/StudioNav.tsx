'use client';

import { CreditCard, FolderOpen, Plus, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, YoutubeMark } from './Avatar';

export interface NavYoutube {
  channelTitle: string;
  thumbnailUrl: string | null;
}

export function StudioNav({ isAdmin, youtube }: { isAdmin: boolean; youtube: NavYoutube | null }) {
  const path = usePathname();
  const links = [
    { href: '/studio', label: 'Projects', icon: FolderOpen, active: path === '/studio' || path.startsWith('/studio/projects') },
    { href: '/studio/new', label: 'New video', icon: Plus, active: path === '/studio/new' },
    { href: '/studio/billing', label: 'Credits & billing', icon: CreditCard, active: path.startsWith('/studio/billing') },
    ...(isAdmin ? [{ href: '/studio/admin', label: 'Admin', icon: Shield, active: path.startsWith('/studio/admin') }] : []),
  ];
  return (
    <>
      <nav className="stack" style={{ ['--gap' as string]: '2px' }}>
        {links.map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href} className="nav-link" aria-current={active ? 'page' : undefined}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="studio-nav-youtube">
        <Link
          href="/studio/account#youtube"
          className={`youtube-link${youtube ? ' connected' : ''}`}
          aria-current={path.startsWith('/studio/account') ? 'page' : undefined}
        >
          {youtube?.thumbnailUrl ? <Avatar src={youtube.thumbnailUrl} name={youtube.channelTitle} size={22} /> : <YoutubeMark size={22} />}
          <span className="yt-text">
            <span>{youtube ? youtube.channelTitle : 'Connect your YouTube'}</span>
            <span className="small muted">{youtube ? 'YouTube connected' : 'Link your channel'}</span>
          </span>
        </Link>
      </div>
    </>
  );
}
