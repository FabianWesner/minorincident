import { test as base, expect, type Page } from '@playwright/test';
import { consoleAllowlist } from './console-allowlist';

/** All browser suites share the guard, including visual, perf and smoke tests. */
export function attachErrorGuard(page: Page): { errors: string[]; dispose(): void } {
  const errors: string[] = [];
  const record = (text: string): void => { if (!consoleAllowlist.some((pattern) => pattern.test(text))) errors.push(text); };
  const consoleListener = (message: import('@playwright/test').ConsoleMessage): void => { if (message.type() === 'error') record(`console.error: ${message.text()}`); };
  const errorListener = (error: Error): void => record(`pageerror: ${error.message}`);
  const requestListener = (request: import('@playwright/test').Request): void => record(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
  const responseListener = (response: import('@playwright/test').Response): void => { if (response.status() >= 400) record(`HTTP ${response.status()}: ${response.url()}`); };
  page.on('console', consoleListener); page.on('pageerror', errorListener); page.on('requestfailed', requestListener); page.on('response', responseListener);
  return { errors, dispose: () => { page.off('console', consoleListener); page.off('pageerror', errorListener); page.off('requestfailed', requestListener); page.off('response', responseListener); } };
}
export const test = base.extend<{ errorGuard: void }>({
  errorGuard: [async ({ page }, use) => {
    const guard = attachErrorGuard(page);
    await use(); guard.dispose();
    expect(guard.errors, 'Uncaught errors, console errors and failed requests').toEqual([]);
  }, { auto: true }],
});
export { expect };
export const testUrl = '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
export async function boot(page: Page): Promise<void> {
  await page.goto(testUrl);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
}
