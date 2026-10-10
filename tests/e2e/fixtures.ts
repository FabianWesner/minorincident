import { test as base, expect, type Page } from '@playwright/test';
import { consoleAllowlist } from './console-allowlist';

/** All browser suites share the guard, including visual, perf and smoke tests. */
export function attachErrorGuard(page: Page): { errors: string[]; dispose(): void } {
  const errors: string[] = [];
  const record = (text: string): void => { if (!consoleAllowlist.some((pattern) => pattern.test(text))) errors.push(text); };
  const consoleListener = (message: import('@playwright/test').ConsoleMessage): void => { if (message.type() === 'error') record(`console.error: ${message.text()}`); };
  const errorListener = (error: Error): void => record(`pageerror: ${error.message}`);
  const mediaFinished = new Map<string, number[]>();
  const mediaAborts: { url: string; time: number; text: string }[] = [];
  const requestListener = (request: import('@playwright/test').Request): void => {
    const text = `requestfailed: ${request.url()} ${request.failure()?.errorText}`;
    // Chromium can replace a media range request when a recording loops. Accept
    // that cancellation only if the same media URL completes a replacement nearby.
    if (request.resourceType() === 'media' && request.failure()?.errorText === 'net::ERR_ABORTED')
      mediaAborts.push({ url: request.url(), time: Date.now(), text });
    else record(text);
  };
  const finishedListener = (request: import('@playwright/test').Request): void => {
    if (request.resourceType() === 'media') {
      const times = mediaFinished.get(request.url()) ?? []; times.push(Date.now()); mediaFinished.set(request.url(), times);
    }
  };
  const responseListener = (response: import('@playwright/test').Response): void => { if (response.status() >= 400) record(`HTTP ${response.status()}: ${response.url()}`); };
  page.on('console', consoleListener); page.on('pageerror', errorListener); page.on('requestfailed', requestListener); page.on('requestfinished', finishedListener); page.on('response', responseListener);
  return { errors, dispose: () => {
    for (const abort of mediaAborts) if (!(mediaFinished.get(abort.url) ?? []).some(time => Math.abs(time - abort.time) <= 1000)) record(abort.text);
    page.off('console', consoleListener); page.off('pageerror', errorListener); page.off('requestfailed', requestListener); page.off('requestfinished', finishedListener); page.off('response', responseListener);
  } };
}
export const test = base.extend<{ errorGuard: void }>({
  errorGuard: [async ({ page }, use) => {
    if (process.env.E2E_SKIN !== undefined) await page.addInitScript(skin => {
      const url = new URL(location.href); if (!url.searchParams.has('skin')) { url.searchParams.set('skin', skin); history.replaceState(null, '', url); }
    }, process.env.E2E_SKIN);
    const guard = attachErrorGuard(page);
    await use(); guard.dispose();
    expect(guard.errors, 'Uncaught errors, console errors and failed requests').toEqual([]);
  }, { auto: true }],
});
export { expect };
export const testUrl = '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
export async function boot(page: Page, url = testUrl): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
}
