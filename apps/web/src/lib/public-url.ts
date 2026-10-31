/** Resolves the public site origin from the incoming request so OAuth/email links
 * stay on minkflow.vercel.app (or a preview) even when APP_BASE_URL is still localhost. */

export interface HeaderReader {
  get(name: string): string | null;
}

export function originFromHeaders(headers: HeaderReader): URL | null {
  const raw = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!raw) return null;
  const host = raw.split(',')[0]?.trim() ?? '';
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return null;
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  try {
    return new URL(`${proto}://${host}`);
  } catch {
    return null;
  }
}

export function isTrustedOrigin(origin: string, configuredBase: string, allowedOrigins: string): boolean {
  let configured: string;
  try {
    configured = new URL(configuredBase).origin;
  } catch {
    configured = '';
  }
  if (origin === configured) return true;
  const extra = allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    if (url.hostname === 'minkflow.vercel.app' || url.hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

export function publicOrigin(headers: HeaderReader, configuredBase: string, allowedOrigins = ''): string {
  const fromRequest = originFromHeaders(headers);
  if (fromRequest && isTrustedOrigin(fromRequest.origin, configuredBase, allowedOrigins)) return fromRequest.origin;
  return new URL(configuredBase).origin;
}

export function publicUrl(path: string, headers: HeaderReader, configuredBase: string, allowedOrigins = ''): URL {
  return new URL(path, publicOrigin(headers, configuredBase, allowedOrigins));
}
