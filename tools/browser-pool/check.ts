import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchBrowser, launchProfile, poolHealth } from './client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { delay } from './host';

process.env.BROWSER_POOL_URL = 'http://127.0.0.1:4328';
process.env.BROWSER_POOL_BACKEND = 'swiftshader';
const daemon = spawn(process.execPath, ['--import', 'tsx', 'tools/browser-pool/daemon.ts'], { env: { ...process.env, BROWSER_POOL_PORT: '4328', BROWSER_POOL_SHARED_LIMIT: '4', BROWSER_POOL_IDLE_MS: '1500', BROWSER_POOL_BROWSER_IDLE_MS: '1500' }, stdio: ['ignore', 'pipe', 'pipe'] });
const profile = mkdtempSync(join(tmpdir(), 'mi-pool-profile-'));
let log = ''; daemon.stdout.on('data', b => { log += b; }); daemon.stderr.on('data', b => { log += b; });
const state = async () => await (await fetch(`${process.env.BROWSER_POOL_URL}/status`)).json() as { leases: unknown[]; browsers: { pid: number }[]; waiting: number };
const until = async (check: () => Promise<boolean>, description: string, timeout = 15_000) => {
  const end = Date.now() + timeout;
  while (!(await check())) { if (Date.now() > end) throw new Error(`Timed out: ${description}\n${log}`); await delay(50); }
};
try {
  await until(async () => !!(await poolHealth()), 'daemon ready');
  const a = await launchBrowser(), b = await launchBrowser(), c = await launchBrowser();
  const ca = await a.newContext(), cb = await b.newContext();
  await ca.addCookies([{ name: 'isolated', value: 'a', url: 'http://example.test' }]);
  assert.equal((await cb.cookies()).length, 0, 'storage isolated across leases');
  let admitted = false;
  const third = c.newContext().then(context => { admitted = true; return context; });
  await delay(200); assert.equal(admitted, false, 'third context queues at capacity');
  assert.equal((await state()).leases.length, 2);
  await ca.close(); const cc = await third;
  await cb.close(); await cc.close();
  await until(async () => (await state()).leases.length === 0, 'contexts release admission');
  const first = await a.newContext(), second = await b.newContext();
  let olderAdmitted = false;
  const older = c.newContext().then(context => { olderAdmitted = true; return context; });
  await until(async () => (await state()).waiting === 1, 'older shared request queued');
  const barrier = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive`, { method: 'POST' })).json() as { id: string };
  await first.close();
  const olderContext = await older;
  assert.equal(olderAdmitted, true, 'shared request before exclusive barrier retains FIFO position');
  await second.close(); await olderContext.close();
  await until(async () => (await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${barrier.id}`)).json() as { granted: boolean }).granted, 'exclusive follows older shared request');
  // A shared request on an existing connection queues while exclusive is active.
  const later = a.newContext();
  await until(async () => (await state()).waiting === 1, 'later shared request queued');
  process.env.MI_BROWSER_POOL_EXCLUSIVE = barrier.id;
  const exclusiveProbe = await launchBrowser(), exclusiveProbeContext = await exclusiveProbe.newContext();
  await exclusiveProbeContext.close(); await exclusiveProbe.close();
  delete process.env.MI_BROWSER_POOL_EXCLUSIVE;
  await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${barrier.id}/release`, { method: 'POST' });
  await (await later).close();
  const active = await a.newContext(), page = await active.newPage();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2200)));
  assert.equal(page.isClosed(), false, 'in-flight page action survives idle deadline');
  await until(async () => page.isClosed(), 'idle context really closes');
  const shared = await b.newContext();
  const ex = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive`, { method: 'POST' })).json() as { id: string };
  let status = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${ex.id}`)).json() as { granted: boolean };
  assert.equal(status.granted, false, 'exclusive waits for safe point');
  await shared.close();
  await until(async () => { status = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${ex.id}`)).json(); return status.granted; }, 'exclusive drains shared');
  process.env.MI_BROWSER_POOL_EXCLUSIVE = ex.id;
  const exclusiveBrowser = await launchBrowser(), exclusiveContext = await exclusiveBrowser.newContext();
  assert.equal((await state()).leases.length, 1);
  await exclusiveContext.close(); await exclusiveBrowser.close();
  await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${ex.id}/release`, { method: 'POST' });
  delete process.env.MI_BROWSER_POOL_EXCLUSIVE;
  const nativeReservation = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive`, { method: 'POST' })).json() as { id: string };
  process.env.MI_BROWSER_POOL_EXCLUSIVE = nativeReservation.id;
  const native = await launchBrowser({ args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'] });
  const nativeContext = await native.newContext();
  delete process.env.MI_BROWSER_POOL_EXCLUSIVE;
  let resumed = false;
  const nextContext = a.newContext().then(c => { resumed = true; return c; });
  await delay(200); assert.equal(resumed, false, 'shared reconnect waits behind native exclusive');
  await nativeContext.close(); await native.close();
  await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${nativeReservation.id}/release`, { method: 'POST' });
  const recovered = await nextContext;
  assert.equal((await recovered.newPage()).isClosed(), false, 'client reconnects after native browser retirement');
  await recovered.close();
  const savedProfile = await launchProfile(profile, {});
  await savedProfile.addCookies([{ name: 'campaign', value: 'shared-save', url: 'http://example.test' }]); await savedProfile.close();
  const external = await (await fetch(`${process.env.BROWSER_POOL_URL}/exclusive`, { method: 'POST' })).json() as { id: string };
  await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${external.id}/external`, { method: 'POST' });
  assert.equal((await state()).browsers.length, 0, 'opaque exclusive retires pooled Chrome');
  process.env.BROWSER_POOL = 'off'; process.env.MI_E2E_LOCK_HELD = '1';
  const legacyProfile = await launchProfile(profile, { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  assert.equal((await legacyProfile.cookies())[0].value, 'shared-save', 'pool storage resumes on legacy path');
  await legacyProfile.addCookies([{ name: 'campaign', value: 'legacy-save', url: 'http://example.test' }]); await legacyProfile.close();
  delete process.env.BROWSER_POOL; delete process.env.MI_E2E_LOCK_HELD;
  await fetch(`${process.env.BROWSER_POOL_URL}/exclusive/${external.id}/release`, { method: 'POST' });
  const resumedProfile = await launchProfile(profile, {});
  assert.equal((await resumedProfile.cookies())[0].value, 'legacy-save', 'legacy storage resumes in pool'); await resumedProfile.close();
  await Promise.all([a.close(), b.close(), c.close()]);
  await until(async () => (await state()).browsers.length === 0, 'idle browser process releases');
  console.log('PASS: context isolation, capacity queue, safe release, action activity, idle context/process release, exclusive drain, native restart/reconnect, opaque exclusive');
} finally {
  if (daemon.exitCode === null && !daemon.signalCode) {
    const ended = new Promise<void>(resolve => daemon.once('exit', () => resolve()));
    daemon.kill('SIGTERM'); await ended;
  }
  rmSync(profile, { recursive: true, force: true });
  if (process.exitCode) console.error(log);
}

assert.equal(await poolHealth(), null, 'pool is down for fallback check');
process.env.E2E_LEGACY = '1';
const fallback = await launchBrowser({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await fallback.newPage(); await page.setContent('<p>fallback works</p>');
  assert.equal(await page.locator('p').innerText(), 'fallback works');
  assert.ok((await page.screenshot()).length > 0);
  console.log('PASS: explicit E2E_LEGACY=1 -> legacy headless launch, page actions and capture');
} finally { await fallback.close(); }
