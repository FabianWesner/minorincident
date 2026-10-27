import { expect, test, vi } from 'vitest';
const connect = vi.hoisted(() => vi.fn());
vi.mock('@playwright/test', () => ({ chromium: { connect } }));
import { launchBrowser } from '../../tools/browser-pool/client';

test('a queued context reconnects after explicit retirement while connected, closes both clients, and preserves genuine errors', async () => {
  vi.stubEnv('MI_BROWSER_POOL', '1'); vi.stubEnv('BROWSER_POOL', ''); vi.stubEnv('BROWSER_POOL_BACKEND', 'gpu');
  for (const key of ['E2E_LEGACY', 'MI_REMOTE', 'MI_BROWSER_POOL_EXTERNAL', 'MI_BROWSER_POOL_EXCLUSIVE']) vi.stubEnv(key, '');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ protocol: 1, endpoints: { gpu: 'ws://pool.invalid/gpu' }, exclusive: [] }) })));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const context = {}, firstClose = vi.fn(async () => {}), nextClose = vi.fn(async () => {});
    const first = { isConnected: () => true, newContext: vi.fn(async () => { throw Error('browser.newContext: exclusive-finished'); }), close: firstClose };
    const next = { isConnected: () => true, newContext: vi.fn(async () => context), close: nextClose };
    connect.mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce(next);
    const browser = await launchBrowser({ headless: true });
    expect(await browser.newContext()).toBe(context);
    expect(connect).toHaveBeenCalledTimes(2);
    await browser.close(); expect(firstClose).toHaveBeenCalledOnce(); expect(nextClose).toHaveBeenCalledOnce();
    const genuine = { isConnected: () => true, newContext: vi.fn(async () => { throw Error('GPU limit exceeded'); }), close: vi.fn(async () => {}) };
    connect.mockReset().mockResolvedValueOnce(genuine);
    const other = await launchBrowser({ headless: true });
    await expect(other.newContext()).rejects.toThrow('GPU limit exceeded'); expect(connect).toHaveBeenCalledOnce();
    await other.close();
  } finally { log.mockRestore(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
