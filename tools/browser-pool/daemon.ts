import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { chromium, type BrowserServer } from '@playwright/test';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import { delay, gpuAdmission, quietConditions, reserveLegacySlots, windowServerSnapshot } from './host';

// The proxy observes the pinned Playwright protocol. Tests exercise real connections;
// upgrading Playwright requires running tools/browser-pool/check.ts again.
type Backend = 'gpu' | 'swiftshader';
type Wire = { id?: number; guid?: string; method?: string; params?: Record<string, unknown>; result?: { context?: { guid: string } }; error?: unknown };
type Lease = { id: string; backend: Backend; connection: Connection; context?: string; last: number; calls: number; closing: boolean; exclusive?: string };
type Exclusive = { id: string; last: number; granted: boolean };
type Waiter = { connection: Connection; message: Wire; raw: string; exclusive?: string };
type Connection = { client: WebSocket; upstream: WebSocket; backend: Backend; token?: string; parents: Map<string, string>; types: Map<string, string>; pending: Map<number, { lease?: Lease; create?: Lease }>; leases: Set<Lease>; closed: boolean };
const port = Number(process.env.BROWSER_POOL_PORT ?? 4329);
if (!Number.isInteger(port) || port < 4321 || port > 4329) throw new Error('Pool port must be 4321–4329');
const configuredLimit = Number(process.env.BROWSER_POOL_SHARED_LIMIT ?? 2);
if (!Number.isInteger(configuredLimit) || configuredLimit < 1 || configuredLimit > 6) throw new Error('Shared limit must be 1–6');
const idleMs = Number(process.env.BROWSER_POOL_IDLE_MS ?? 60_000);
const browserIdleMs = Number(process.env.BROWSER_POOL_BROWSER_IDLE_MS ?? 60_000);
let limit = configuredLimit, stopping = false, lastUse = Date.now(), windowServerCpu: number | null = null;
let releaseSlots: (() => Promise<void>) | undefined;
let launchChain: Promise<unknown> = Promise.resolve();
let negativeId = -1;
const browsers = new Map<Backend, { server: BrowserServer; signature: string }>();
const leases = new Map<string, Lease>(), connections = new Set<Connection>();
const waiters: Waiter[] = [], exclusives: Exclusive[] = [];
const flags = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
function event(kind: string, data: Record<string, unknown> = {}) { console.log(JSON.stringify({ at: new Date().toISOString(), kind, ...data })); }
function owner(c: Connection, guid = ''): Lease | undefined {
  const seen = new Set<string>();
  while (guid && !seen.has(guid)) {
    seen.add(guid);
    const found = [...c.leases].find(l => l.context === guid);
    if (found) return found;
    guid = c.parents.get(guid) ?? '';
  }
  return undefined;
}
function wireError(c: Connection, id: number | undefined, message: string) {
  if (c.client.readyState === WebSocket.OPEN) c.client.send(JSON.stringify({ id, error: { error: { message, name: 'Error', stack: '' } } }));
}
function release(lease: Lease, reason: string) {
  if (!leases.delete(lease.id)) return;
  lease.connection.leases.delete(lease); lastUse = Date.now();
  event('lease-release', { id: lease.id, reason, active: leases.size }); pump();
}
function closeLease(lease: Lease, reason: string) {
  if (lease.closing) return;
  lease.closing = true;
  if (!lease.context || lease.connection.upstream.readyState !== WebSocket.OPEN) { lease.connection.upstream.close(); return; }
  // A daemon-owned negative request id cannot collide with Playwright's client ids.
  lease.connection.upstream.send(JSON.stringify({ id: negativeId--, guid: lease.context, method: 'close', params: { reason }, metadata: { internal: true } }));
  event('lease-close', { id: lease.id, reason });
}
function pump() {
  if (stopping) return;
  while (exclusives.length && Date.now() - exclusives[0].last > 20_000) {
    const expired = exclusives.shift()!;
    for (const lease of leases.values()) if (lease.exclusive === expired.id) closeLease(lease, 'Exclusive owner disconnected');
  }
  const exclusive = exclusives[0];
  if (exclusive && !exclusive.granted && leases.size === 0) { exclusive.granted = true; event('exclusive-granted', { id: exclusive.id }); }
  for (let i = 0; i < waiters.length;) {
    const waiter = waiters[i], c = waiter.connection;
    if (c.closed) { waiters.splice(i, 1); continue; }
    const permitted = waiter.exclusive
      ? exclusive?.id === waiter.exclusive && exclusive.granted && leases.size === 0
      : !exclusive && leases.size < limit;
    if (!permitted) { i++; continue; }
    waiters.splice(i, 1);
    const lease: Lease = { id: randomUUID(), connection: c, backend: c.backend, last: Date.now(), calls: 1, closing: false, exclusive: waiter.exclusive };
    leases.set(lease.id, lease); c.leases.add(lease); c.pending.set(waiter.message.id!, { create: lease, lease });
    event('lease-acquire', { id: lease.id, backend: c.backend, exclusive: !!waiter.exclusive, active: leases.size });
    c.upstream.send(waiter.raw);
  }
}
async function closeBrowsers(reason: string) {
  for (const c of connections) { c.client.close(1012, reason); c.upstream.close(); }
  await Promise.allSettled([...browsers.values()].map(b => b.server.close())); browsers.clear();
  if (releaseSlots) { const release = releaseSlots; releaseSlots = undefined; await release(); }
  event('browsers-released', { reason });
}
async function browserFor(backend: Backend, options: { args?: string[]; channel?: string }, token?: string) {
  const normal = new Set([...flags, '--use-angle=metal', '--use-angle=swiftshader', '--enable-gpu', '--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']);
  const extra = token ? (options.args ?? []).filter(a => !normal.has(a)) : [];
  const channel = token ? options.channel : undefined;
  const signature = JSON.stringify({ extra, channel });
  const current = browsers.get(backend);
  if (current?.signature === signature) return current.server;
  if (current) {
    if (leases.size) throw new Error('Cannot change browser launch flags while a context is active');
    await current.server.close(); browsers.delete(backend);
  }
  if (!releaseSlots) releaseSlots = await reserveLegacySlots();
  if (backend === 'gpu') {
    // Do not let SwiftShader occupy CPU during native timing or GPU admission.
    const software = browsers.get('swiftshader');
    if (token && software) { await software.server.close(); browsers.delete('swiftshader'); }
    await gpuAdmission();
  }
  const args = backend === 'gpu'
    ? ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const server = await chromium.launchServer({ headless: true, args: [...args, ...extra, ...flags], ...(channel ? { channel } : {}) });
  browsers.set(backend, { server, signature });
  server.on('close', () => { if (browsers.get(backend)?.server === server) browsers.delete(backend); });
  event('browser-start', { backend, pid: server.process().pid, channel: channel ?? 'headless-shell' });
  return server;
}
function proxy(client: WebSocket, upstream: WebSocket, backend: Backend, token?: string) {
  const c: Connection = { client, upstream, backend, token, parents: new Map(), types: new Map(), pending: new Map(), leases: new Set(), closed: false };
  connections.add(c);
  upstream.on('message', (raw: RawData) => {
    const text = raw.toString(), m = JSON.parse(text) as Wire;
    if (m.method === '__create__') { c.parents.set(String(m.params?.guid), m.guid ?? ''); c.types.set(String(m.params?.guid), String(m.params?.type)); }
    if (m.id !== undefined) {
      if (m.id < 0) return;
      const request = c.pending.get(m.id); c.pending.delete(m.id);
      if (request?.lease) { request.lease.calls--; request.lease.last = Date.now(); }
      if (request?.create) {
        if (m.error || !m.result?.context) release(request.create, 'context-create-failed');
        else { request.create.context = m.result.context.guid; request.create.last = Date.now(); }
      }
    }
    if (m.method === '__dispose__' && m.guid) {
      const lease = [...c.leases].find(l => l.context === m.guid);
      if (lease) release(lease, 'context-disposed');
      c.parents.delete(m.guid); c.types.delete(m.guid);
    }
    if (client.readyState === WebSocket.OPEN) client.send(text);
  });
  client.on('message', (raw: RawData) => {
    const text = raw.toString(), m = JSON.parse(text) as Wire;
    if (m.method === 'newContext' && c.types.get(m.guid ?? '') === 'Browser') {
      if (token && !exclusives.some(e => e.id === token)) return wireError(c, m.id, 'Exclusive lease expired');
      waiters.push({ connection: c, message: m, raw: text, exclusive: token }); pump(); return;
    }
    // launchPersistentContext / raw CDP context creation would bypass admission.
    if (m.method === 'send' && /^Target[.](createBrowserContext|createTarget)$/.test(String(m.params?.method))) return wireError(c, m.id, 'Raw CDP target creation bypasses context admission');
    if (m.method === 'launch' || m.method === 'launchPersistentContext' || m.method === 'connectOverCDP') {
      return wireError(c, m.id, `Pool does not permit ${m.method}; use a context lease`);
    }
    const lease = owner(c, m.guid);
    if (lease && m.id !== undefined) { lease.last = Date.now(); lease.calls++; c.pending.set(m.id, { lease }); }
    if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
  });
  function disconnected() {
    if (c.closed) return;
    c.closed = true; connections.delete(c); client.close();
    // Explicitly close before releasing admission. BrowserServer also cleans contexts
    // on connection loss; waiting for disposal avoids granting an overlapping lease.
    for (const lease of c.leases) closeLease(lease, 'Client disconnected');
    setTimeout(() => upstream.close(), 1_000).unref();
    pump();
  }
  client.on('close', disconnected); client.on('error', disconnected);
  upstream.on('close', () => { disconnected(); for (const lease of [...c.leases]) release(lease, 'upstream-disconnected'); });
  upstream.on('error', disconnected);
}
const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const json = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/health' || url.pathname === '/status') return json(200, {
    protocol: 1, pid: process.pid, playwright: '1.63.0', limit, configuredLimit, windowServerCpu, idleMs,
    endpoints: { gpu: `ws://127.0.0.1:${port}/ws/gpu`, swiftshader: `ws://127.0.0.1:${port}/ws/swiftshader` },
    browsers: [...browsers.entries()].map(([backend, b]) => ({ backend, pid: b.server.process().pid })),
    leases: [...leases.values()].map(l => ({ id: l.id, backend: l.backend, context: l.context, idle: Date.now() - l.last, calls: l.calls, exclusive: !!l.exclusive })),
    waiting: waiters.length, exclusive: exclusives.map(e => ({ id: e.id, granted: e.granted })),
  });
  if (url.pathname === '/exclusive' && req.method === 'POST') {
    const e = { id: randomUUID(), last: Date.now(), granted: false }; exclusives.push(e); pump(); return json(200, e);
  }
  const exclusivePath = /^\/exclusive\/([^/]+)(\/release)?$/.exec(url.pathname);
  if (exclusivePath) {
    const i = exclusives.findIndex(e => e.id === exclusivePath[1]);
    if (i < 0) return json(404, { error: 'Exclusive lease expired' });
    const e = exclusives[i]; e.last = Date.now();
    if (exclusivePath[2] && req.method === 'POST') {
      for (const lease of leases.values()) if (lease.exclusive === e.id) closeLease(lease, 'Exclusive step finished');
      // Prevent the next shared client from reusing uncapped/native timing flags.
      if (e.granted && leases.size === 0 && [...browsers.values()].some(b => b.signature !== JSON.stringify({ extra: [], channel: undefined }))) await closeBrowsers('exclusive-finished');
      exclusives.splice(i, 1); pump(); return json(200, { released: true });
    }
    if (url.searchParams.has('quiet')) return json(200, { ...e, conditions: await quietConditions(new Set([...browsers.values()].map(b => b.server.process().pid!))) });
    return json(200, e);
  }
  json(404, { error: 'Not found' });
});
const ws = new WebSocketServer({ noServer: true });
http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const backend = url.pathname.slice('/ws/'.length) as Backend;
  if (!url.pathname.startsWith('/ws/') || !['gpu', 'swiftshader'].includes(backend) || stopping) { socket.destroy(); return; }
  const token = url.searchParams.get('exclusive') ?? undefined;
  if (token && !exclusives.some(e => e.id === token && e.granted)) { socket.destroy(); return; }
  let options: { args?: string[]; channel?: string } = {};
  try { options = JSON.parse(String(req.headers['x-playwright-launch-options'] ?? req.headers['x-mi-launch-options'] ?? '{}')); } catch { socket.destroy(); return; }
  if (!token && options.args?.some(a => a === '--disable-frame-rate-limit' || a === '--disable-gpu-vsync')) { socket.destroy(); return; }
  // Serial launch/reconfiguration prevents two roots of the same backend.
  launchChain = launchChain.then(async () => {
    const browser = await browserFor(backend, options, token);
    if (socket.destroyed) return;
    const upstream = new WebSocket(browser.wsEndpoint());
    await new Promise<void>((resolve, reject) => { upstream.once('open', resolve); upstream.once('error', reject); });
    ws.handleUpgrade(req, socket, head, client => proxy(client, upstream, backend, token));
  }).catch(async error => { event('connection-error', { error: String(error) }); socket.destroy(); if (!browsers.size && releaseSlots) { const release = releaseSlots; releaseSlots = undefined; await release(); } });
});
let previousWindow: Awaited<ReturnType<typeof windowServerSnapshot>>, previousAt = Date.now(), coolSamples = 0;
let sampling = false;
const timer = setInterval(() => {
  pump();
  for (const lease of leases.values()) if (!lease.closing && lease.calls === 0 && Date.now() - lease.last >= idleMs) closeLease(lease, 'Idle browser lease released');
  if (!leases.size && !waiters.length && !exclusives.length && browsers.size && Date.now() - lastUse >= browserIdleMs) {
    lastUse = Date.now(); launchChain = launchChain.then(() => closeBrowsers('idle')).catch(error => event('idle-error', { error: String(error) }));
  }
  if (sampling || Date.now() - previousAt < 10_000) return;
  sampling = true;
  void windowServerSnapshot().then(next => {
    const now = Date.now();
    if (next && previousWindow?.pid === next.pid) {
      windowServerCpu = (next.seconds - previousWindow.seconds) * 100_000 / (now - previousAt);
      if (windowServerCpu > 60) { limit = Math.max(1, limit - 1); coolSamples = 0; }
      else if (windowServerCpu < 30 && ++coolSamples >= 3) { limit = Math.min(configuredLimit, limit + 1); coolSamples = 0; }
      event('host-sample', { windowServerCpu, limit });
    } else if (process.platform === 'darwin' && (!next || previousWindow)) { limit = 1; coolSamples = 0; windowServerCpu = null; }
    previousWindow = next; previousAt = now; pump();
  }).catch(error => { limit = 1; event('host-sample-error', { error: String(error) }); }).finally(() => { sampling = false; });
}, 500);
http.listen(port, '127.0.0.1', () => event('pool-ready', { port, configuredLimit }));
async function stop() {
  if (stopping) return;
  stopping = true; clearInterval(timer); http.close();
  for (const c of connections) c.client.close(1001, 'Pool stopped');
  await launchChain; await closeBrowsers('shutdown'); ws.close();
  await delay(50); process.exit(0);
}
process.on('SIGINT', () => { void stop(); }); process.on('SIGTERM', () => { void stop(); });
