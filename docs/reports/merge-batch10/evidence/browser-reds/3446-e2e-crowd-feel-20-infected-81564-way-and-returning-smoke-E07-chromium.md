# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/crowd-feel.spec.ts >> 20 infected corpses remain drawn after walking 60 m away and returning @smoke @E07
- Location: tests/e2e/crowd-feel.spec.ts:87:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3446/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1
Call log:
  - navigating to "http://127.0.0.1:3446/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1", waiting until "load"

```

```
Error: Uncaught errors, console errors and failed requests

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "requestfailed: http://127.0.0.1:3446/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1 net::ERR_CONNECTION_REFUSED",
+ ]
```

# Test source

```ts
  1  | import { test as base, expect, type Page } from '@playwright/test';
  2  | import { consoleAllowlist } from './console-allowlist';
  3  | 
  4  | /** All browser suites share the guard, including visual, perf and smoke tests. */
  5  | export function attachErrorGuard(page: Page): { errors: string[]; dispose(): void } {
  6  |   const errors: string[] = [];
  7  |   const record = (text: string): void => { if (!consoleAllowlist.some((pattern) => pattern.test(text))) errors.push(text); };
  8  |   const consoleListener = (message: import('@playwright/test').ConsoleMessage): void => { if (message.type() === 'error') record(`console.error: ${message.text()}`); };
  9  |   const errorListener = (error: Error): void => record(`pageerror: ${error.message}`);
  10 |   const mediaFinished = new Map<string, number[]>();
  11 |   const mediaAborts: { url: string; time: number; text: string }[] = [];
  12 |   const requestListener = (request: import('@playwright/test').Request): void => {
  13 |     const text = `requestfailed: ${request.url()} ${request.failure()?.errorText}`;
  14 |     // Chromium can replace a media range request when a recording loops. Accept
  15 |     // that cancellation only if the same media URL completes a replacement nearby.
  16 |     if (request.resourceType() === 'media' && request.failure()?.errorText === 'net::ERR_ABORTED')
  17 |       mediaAborts.push({ url: request.url(), time: Date.now(), text });
  18 |     else record(text);
  19 |   };
  20 |   const finishedListener = (request: import('@playwright/test').Request): void => {
  21 |     if (request.resourceType() === 'media') {
  22 |       const times = mediaFinished.get(request.url()) ?? []; times.push(Date.now()); mediaFinished.set(request.url(), times);
  23 |     }
  24 |   };
  25 |   const responseListener = (response: import('@playwright/test').Response): void => { if (response.status() >= 400) record(`HTTP ${response.status()}: ${response.url()}`); };
  26 |   page.on('console', consoleListener); page.on('pageerror', errorListener); page.on('requestfailed', requestListener); page.on('requestfinished', finishedListener); page.on('response', responseListener);
  27 |   return { errors, dispose: () => {
  28 |     for (const abort of mediaAborts) if (!(mediaFinished.get(abort.url) ?? []).some(time => Math.abs(time - abort.time) <= 1000)) record(abort.text);
  29 |     page.off('console', consoleListener); page.off('pageerror', errorListener); page.off('requestfailed', requestListener); page.off('requestfinished', finishedListener); page.off('response', responseListener);
  30 |   } };
  31 | }
  32 | export const test = base.extend<{ errorGuard: void }>({
  33 |   errorGuard: [async ({ page, context }, use) => {
  34 |     if (process.env.PHONE_PERF === '1') {
  35 |       const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  36 |     }
  37 |     if (process.env.E2E_SKIN !== undefined) await page.addInitScript(skin => {
  38 |       const url = new URL(location.href); if (!url.searchParams.has('skin')) { url.searchParams.set('skin', skin); history.replaceState(null, '', url); }
  39 |     }, process.env.E2E_SKIN);
  40 |     const guard = attachErrorGuard(page);
  41 |     await use(); guard.dispose();
> 42 |     expect(guard.errors, 'Uncaught errors, console errors and failed requests').toEqual([]);
     |                                                                                 ^ Error: Uncaught errors, console errors and failed requests
  43 |   }, { auto: true }],
  44 | });
  45 | export { expect };
  46 | export const testUrl = '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
  47 | export async function boot(page: Page, url = testUrl): Promise<void> {
  48 |   await page.goto(url);
  49 |   await page.waitForFunction(() => Boolean(window.__SS__));
  50 |   await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  51 | }
  52 | 
```