import { launchBrowser } from '../browser-pool/client';
import { spawn, type ChildProcess } from 'node:child_process';
import { type Browser, type Page } from '@playwright/test';

/** Skin-pilot harness: headless Chromium (ANGLE Metal) against a Vite server on E2E_PORT (default 3354).
 * Starts and retires Vite only when that port is free. Run through tools/e2e-lock.sh. */
export const port = Number(process.env.E2E_PORT ?? 3354);
if (port === 3300) throw new Error('Skin pilot must not use the shared dev-server port');
export const origin = `http://localhost:${port}`;
async function up(): Promise<boolean> { try { return (await fetch(origin)).ok; } catch { return false; } }
/** Each session owns the preview server it started (if any) and retires it on `close()` or on a failed setup. */
export async function open(viewport = { width: 1600, height: 900 }, mobile = false): Promise<{ browser: Browser; page: Page; close(): Promise<void> }> {
  let server: ChildProcess | undefined;
  if (!(await up())) {
    server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore', detached: false });
    for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  }
  if (!(await up())) { server?.kill(); throw new Error(`Preview server did not start on ${port}; run npm run build:qa first`); }
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', e => console.error('pageerror', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
    const owned = browser;
    return { browser, page, async close() { await owned.close(); server?.kill(); } };
  } catch (error) {
    await browser?.close().catch(() => undefined); server?.kill();
    throw error;
  }
}
