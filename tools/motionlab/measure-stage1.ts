import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
const scratch = '/private/tmp/claude-501/-Users-fabianwesner-Workspace-suburban-survivors/88be267a-0002-4cac-aeec-a7e79e9db694/scratchpad/motion-lab';
await mkdir(scratch, { recursive: true });
const port = process.env.E2E_PORT ?? '3352';
let server: ReturnType<typeof spawn> | undefined;
try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) }); }
catch {
  // A previous E04 verification may have retired its preview server. Own a preview
  // server only when the assigned port is free, and close it with this run.
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise<void>(done => setTimeout(done, 500));
    try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) }); ready = true; break; } catch { /* wait for Vite */ }
  }
  if (!ready) { server.kill(); throw new Error(`Motion lab server did not start on ${port}`); }
}
const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors: string[] = [], reports: Record<string, unknown> = {};
try {
  for (const profile of ['desktop', 'pixel7']) {
    const context = await browser.newContext(profile === 'pixel7' ? { ...devices['Pixel 7'], deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    if (profile === 'pixel7') { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    for (const count of [200]) for (const side of ['current', 'prototype']) {
      await page.goto(`http://127.0.0.1:${port}/?motionlab&renderer=webgl&paused=1&count=${count}&side=${side}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (window as unknown as { __MOTIONLAB__: { ready: boolean } }).__MOTIONLAB__?.ready, { timeout: 60000 });
      const result = await page.evaluate(async side => {
        type API = { step(n: number): Record<string, unknown>; gpu(): Promise<number | null>; resume(): void; pause(): void; metrics(): Record<string, unknown> };
        const api = (window as unknown as { __MOTIONLAB__: API }).__MOTIONLAB__;
        const deterministic = api.step(720), gpu: number[] = [];
        for (let i = 0; i < 40; i++) { api.step(1); const value = await api.gpu(); if (value !== null) gpu.push(value); }
        api.resume(); await new Promise<void>(done => setTimeout(done, 4000)); api.pause();
        return { deterministic: deterministic[side], realtime: api.metrics()[side], gpuSamplesMs: gpu, emulation: navigator.userAgent };
      }, side);
      reports[`${profile}-${count}-${side}`] = result; await writeFile(resolve('epics-pipeline/motion-stage1-metrics.json'), JSON.stringify({ date: new Date().toISOString(), reports, errors }, null, 2)); console.log(`${profile} ${count} ${side}`, JSON.stringify(result));
    }
    if (profile === 'desktop') {
      for (const candidate of ['stage1']) {
        await page.goto(`http://127.0.0.1:${port}/?motionlab&renderer=webgl&paused=1&count=50&view=close&candidate=${candidate}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => (window as unknown as { __MOTIONLAB__: { ready: boolean } }).__MOTIONLAB__?.ready);
        const boxes: unknown[] = [], frames: PNG[] = [];
        for (const ticks of [150, 120, 120]) {
          await page.evaluate(n => (window as unknown as { __MOTIONLAB__: { step(n: number): unknown } }).__MOTIONLAB__.step(n), ticks);
          boxes.push(await page.evaluate(() => (window as unknown as { __MOTIONLAB__: { boxes(): unknown } }).__MOTIONLAB__.boxes()));
          frames.push(PNG.sync.read(await page.screenshot()));
        }
        const sheet = new PNG({ width: frames[0].width, height: frames[0].height * frames.length });
        frames.forEach((frame, index) => PNG.bitblt(frame, sheet, 0, 0, frame.width, frame.height, 0, index * frame.height));
        await writeFile(`${scratch}/${candidate}-comparison.png`, PNG.sync.write(sheet));
        reports[`${candidate}-capture-boxes`] = boxes;
        reports[candidate] = await page.evaluate(() => (window as unknown as { __MOTIONLAB__: { metrics(): unknown } }).__MOTIONLAB__.metrics());
      }
    }
    await context.close();
  }
  await writeFile(resolve('epics-pipeline/motion-stage1-metrics.json'), JSON.stringify({ date: new Date().toISOString(), reports, errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); server?.kill(); }
