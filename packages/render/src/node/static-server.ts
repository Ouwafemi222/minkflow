import { createReadStream, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export interface StaticServer {
  url: (relativePath: string) => string;
  close: () => Promise<void>;
}

/** Loopback-only read-only file server so the renderer can fetch local artifacts over HTTP. */
export async function startStaticServer(root: string): Promise<StaticServer> {
  const base = normalize(root);
  const server: Server = createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const file = normalize(join(base, pathname));
      if (!file.startsWith(base + sep) || req.method !== 'GET') {
        res.writeHead(403).end();
        return;
      }
      const size = statSync(file).size;
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': size,
        'Access-Control-Allow-Origin': '*',
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (relativePath) => `http://127.0.0.1:${port}/${relativePath.split(/[\\/]/).map(encodeURIComponent).join('/')}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
