/** Profile photo with an initials fallback. Google photos need `no-referrer` or they can fail to load. */
export function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-initials" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials}
    </span>
  );
}

export function YoutubeMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 20) / 28)} viewBox="0 0 28 20" aria-hidden="true">
      <path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 24.9.6C22.7 0 14 0 14 0S5.3 0 3.1.6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9a3.5 3.5 0 0 0 2.5 2.5C5.3 20 14 20 14 20s8.7 0 10.9-.6a3.5 3.5 0 0 0 2.5-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9z" />
      <path fill="#FFFFFF" d="M11.2 14.3 18.5 10l-7.3-4.3z" />
    </svg>
  );
}
