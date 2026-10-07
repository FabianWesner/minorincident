import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type Page } from '@playwright/test';

/** Skin-pilot harness: headless Chromium (ANGLE Metal) against a Vite server on E2E_PORT (default 3354).
 * Starts and retires Vite only when that port is free. Run through tools/e2e-lock.sh. */
export const port = Number(process.env.E2E_PORT ?? 3354);
export const origin = `http://localhost:${port}`;
let server: ChildProcess | undefined;
async function up(): Promise<boolean> { try { return (await fetch(origin)).ok; } catch { return false; } }
export async function open(viewport = { width: 1600, height: 900 }, mobile = false): Promise<{ browser: Browser; page: Page; close(): Promise<void> }> {
  if (!(await up())) {
    server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: false });
    for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  }
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  return { browser, page, async close() { await browser.close(); server?.kill(); } };
}
