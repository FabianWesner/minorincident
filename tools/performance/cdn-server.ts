// Cloudflare-Pages-like static server for load measurements of `dist/`.
// Serves over HTTP/2 (TLS) when a cert/key pair is given, applies `dist/_headers`
// (Pages syntax: path pattern lines followed by indented `Name: value` lines),
// brotli-compresses the same text types Pages does, and answers ETag revalidation with 304.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createSecureServer, type Http2ServerRequest, type Http2ServerResponse } from 'node:http2';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { brotliCompressSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.md': 'text/markdown', '.bin': 'application/octet-stream',
};
const compressible = new Set(['.html', '.js', '.css', '.json', '.wasm', '.svg', '.md']);

type Rule = { pattern: RegExp; headers: [string, string][] };
export function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const source = line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[A-Za-z]\w*/g, '[^/]+');
      rules.push({ pattern: new RegExp(`^${source}$`), headers: [] });
    } else if (rules.length) {
      const i = line.indexOf(':'); rules.at(-1)!.headers.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function startCdnServer(options: { root: string; port: number; cert?: string; key?: string }): Promise<() => Promise<void>> {
  const rules = existsSync(join(options.root, '_headers')) ? parseHeaders(readFileSync(join(options.root, '_headers'), 'utf8')) : [];
  const compressed = new Map<string, Buffer>();
  const handler = (req: IncomingMessage | Http2ServerRequest, res: ServerResponse | Http2ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(options.root, path);
    if (!existsSync(file) || statSync(file).isDirectory()) { path = '/index.html'; file = join(options.root, 'index.html'); }
    const stat = statSync(file), ext = extname(file);
    const etag = `"${createHash('md5').update(`${file}:${stat.size}:${stat.mtimeMs}`).digest('hex')}"`;
    const headers: Record<string, string> = { 'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate', etag, 'access-control-allow-origin': '*' };
    for (const rule of rules) if (rule.pattern.test(path)) for (const [name, value] of rule.headers) headers[name] = value;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
    const accept = String(req.headers['accept-encoding'] ?? '');
    if (compressible.has(ext) && accept.includes('br')) {
      let body = compressed.get(etag);
      if (!body) { body = brotliCompressSync(readFileSync(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }); compressed.set(etag, body); }
      res.writeHead(200, { ...headers, 'content-encoding': 'br', 'content-length': String(body.length) }); res.end(body); return;
    }
    res.writeHead(200, { ...headers, 'content-length': String(stat.size) });
    (createReadStream(file) as NodeJS.ReadableStream).pipe(res as NodeJS.WritableStream);
  };
  const server = options.cert && options.key
    ? createSecureServer({ cert: readFileSync(options.cert), key: readFileSync(options.key), allowHTTP1: true }, handler)
    : createServer(handler);
  return new Promise(resolve => server.listen(options.port, '127.0.0.1', () => resolve(() => new Promise(done => server.close(() => done())))));
}

if (process.argv[1]?.endsWith('cdn-server.ts')) {
  const [root = 'dist', port = '3362', cert, key] = process.argv.slice(2);
  void startCdnServer({ root, port: Number(port), cert, key }).then(() => console.log(`cdn-server ${root} on ${cert ? 'https' : 'http'}://127.0.0.1:${port}`));
}
