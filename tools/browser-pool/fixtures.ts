import { test as base } from '@playwright/test';
import { connectForTests } from './client';

export const test = base.extend({
  browser: [async ({ playwright, browserName, channel, launchOptions, connectOptions }, use) => {
    const browser = connectOptions && process.env.MI_BROWSER_POOL === '1'
      ? await connectForTests(connectOptions.wsEndpoint, { ...launchOptions, ...(channel ? { channel } : {}) })
      : connectOptions ? await playwright[browserName].connect(connectOptions.wsEndpoint, connectOptions)
      : await playwright[browserName].launch({ ...launchOptions, ...(channel ? { channel } : {}), headless: true });
    try { await use(browser); } finally { await browser.close(); }
  }, { scope: 'worker' }],
});
export { expect } from '@playwright/test';
