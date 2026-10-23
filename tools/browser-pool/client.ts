import { chromium, type Browser, type BrowserContextOptions, type LaunchOptions } from '@playwright/test';
import { delay, gpuAdmission, reserveLegacySlots } from './host';

type Health = { protocol: number; endpoints: { gpu: string; swiftshader: string }; exclusive: { id: string; granted: boolean }[] };
export const poolUrl = () => process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329';
export async function poolHealth(): Promise<Health | null> {
  if (process.env.BROWSER_POOL === 'off') return null;
  try {
    const response = await fetch(`${poolUrl()}/health`, { signal: AbortSignal.timeout(700) });
    if (!response.ok) return null;
    const health = await response.json() as Health;
    if (health.protocol !== 1) throw new Error('Unsupported browser pool protocol');
    return health;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unsupported browser pool protocol') throw error;
    return null;
  }
}
export async function poolEndpoint(): Promise<string | undefined> {
  const deadline = Date.now() + Number(process.env.BROWSER_POOL_WAIT_MS ?? 1_800_000);
  while (true) {
    const health = await poolHealth();
    if (!health) {
      if (process.env.MI_BROWSER_POOL === '1') throw new Error('Pool disappeared after wrapper admission; refusing an unguarded browser launch');
      return undefined;
    }
    const exclusive = process.env.MI_BROWSER_POOL_EXCLUSIVE;
    if (exclusive && !health.exclusive.some(e => e.id === exclusive && e.granted)) throw new Error('Exclusive pool reservation is missing or not granted');
    if (exclusive || health.exclusive.length === 0) {
      const backend = process.env.BROWSER_POOL_BACKEND ?? (process.platform === 'darwin' ? 'gpu' : 'swiftshader');
      if (backend !== 'gpu' && backend !== 'swiftshader') throw new Error('BROWSER_POOL_BACKEND must be gpu or swiftshader');
      return health.endpoints[backend] + (exclusive ? `?exclusive=${encodeURIComponent(exclusive)}` : '');
    }
    if (Date.now() >= deadline) throw new Error('Pool exclusive admission exceeded wait deadline');
    await delay(500);
  }
}

/** A remote Browser.close disconnects this client; it never kills the shared Chrome. */
export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  if (options.headless === false) throw new Error('Browser automation must stay headless');
  const endpoint = await poolEndpoint();
  if (endpoint) {
    if (options.channel && !process.env.MI_BROWSER_POOL_EXCLUSIVE) throw new Error('A browser channel override requires quiet-run exclusive mode');
    const browser = await chromium.connect(endpoint, { timeout: Number(process.env.BROWSER_POOL_WAIT_MS ?? 1_800_000), headers: { 'x-mi-launch-options': JSON.stringify(options), 'x-mi-job': process.env.BROWSER_POOL_JOB_ID ?? '' } });
    const create = browser.newContext.bind(browser), close = browser.close.bind(browser), replacements = new Set<Browser>();
    browser.newContext = async contextOptions => {
      try { return await create(contextOptions); }
      catch (error) {
        // No page has been created yet. A native exclusive run may have retired the
        // old server while this context was queued; reconnect at this safe point.
        if (browser.isConnected()) throw error;
        const next = await launchBrowser(options); replacements.add(next);
        try { return await next.newContext(contextOptions); }
        catch (retryError) { replacements.delete(next); await next.close(); throw retryError; }
      }
    };
    browser.close = async options => { await Promise.allSettled([...replacements].map(b => b.close(options))); await close(options); };
    return browser;
  }
  const release = process.env.MI_E2E_LOCK_HELD === '1' ? undefined : await reserveLegacySlots();
  try {
    if (release && !options.args?.includes('--use-angle=swiftshader')) await gpuAdmission();
    const browser = await chromium.launch({ ...options, headless: true });
    const close = browser.close.bind(browser);
    browser.close = async options => { try { await close(options); } finally { await release?.(); } };
    return browser;
  } catch (error) { await release?.(); throw error; }
}

/** Each test context owns its connection, so native exclusive runs can restart Chrome
 * between specs without leaving a Playwright worker attached to the retired process. */
export async function connectForTests(endpoint: string, options: LaunchOptions): Promise<Browser> {
  const initial = await chromium.connect(await poolEndpoint() ?? endpoint, { timeout: Number(process.env.BROWSER_POOL_WAIT_MS ?? 1_800_000), headers: { 'x-mi-launch-options': JSON.stringify(options), 'x-mi-job': process.env.BROWSER_POOL_JOB_ID ?? '' } });
  const children = new Set<Browser>();
  initial.newContext = async (contextOptions: BrowserContextOptions = {}) => {
    const browser = await launchBrowser(options); children.add(browser);
    try {
      const context = await browser.newContext(contextOptions);
      const close = context.close.bind(context);
      context.close = async options => { try { await close(options); } finally { children.delete(browser); await browser.close(); } };
      return context;
    } catch (error) { children.delete(browser); await browser.close(); throw error; }
  };
  initial.newPage = async options => {
    const context = await initial.newContext(options);
    const page = await context.newPage(), close = page.close.bind(page);
    page.close = async options => { try { await close(options); } finally { await context.close(); } };
    return page;
  };
  const close = initial.close.bind(initial);
  initial.close = async options => { await Promise.allSettled([...children].map(b => b.close(options))); await close(options); };
  return initial;
}

/** Keep campaign cookies/local storage per playtest profile without sharing a Chrome
 * user-data directory between agents. The pool always uses an isolated context. */
export async function launchProfile(profile: string, options: LaunchOptions & BrowserContextOptions) {
  const { existsSync, mkdirSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const endpoint = await poolEndpoint();
  const storage = resolve(profile, 'pool-storage.json'); mkdirSync(profile, { recursive: true });
  let browser: Browser | undefined, release: (() => Promise<void>) | undefined;
  try {
    if (endpoint) browser = await launchBrowser(options);
    else if (process.env.MI_E2E_LOCK_HELD !== '1') {
      release = await reserveLegacySlots();
      if (!options.args?.includes('--use-angle=swiftshader')) await gpuAdmission();
    }
    const context = browser
      ? await browser.newContext({ viewport: options.viewport, deviceScaleFactor: options.deviceScaleFactor, ...(existsSync(storage) ? { storageState: storage } : {}) })
      : await chromium.launchPersistentContext(profile, { ...options, headless: true });
    if (!browser && existsSync(storage)) await context.setStorageState(storage);
    const close = context.close.bind(context);
    let closing: Promise<void> | undefined;
    context.close = options => closing ??= (async () => {
      try { await context.storageState({ path: storage, indexedDB: true }); }
      finally { try { await close(options); } finally { await browser?.close(); await release?.(); } }
    })();
    return context;
  } catch (error) { await browser?.close(); await release?.(); throw error; }
}
