# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual/e25-closure.spec.ts >> T-E25-16 @E25 @E25-AC16 production photo spots for the non-L6 lighting review
- Location: tests/visual/e25-closure.spec.ts:64:1

# Error details

```
Test timeout of 240000ms exceeded.
```

```
Error: Uncaught errors, console errors and failed requests

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 52

- Array []
+ Array [
+   "HTTP 404: http://127.0.0.1:3498/assets/models/veh.sedan-white.wrecked.glb?v=ed906c2691",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/veh.sedan-white.wrecked.glb?v=ed906c2691 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/veh.pickup-red.burned.lod1.glb?v=b8d326039a",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/veh.pickup-red.burned.lod1.glb?v=b8d326039a net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/veh.pickup-red.burned.glb?v=f5b897ede1",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/veh.pickup-red.burned.glb?v=f5b897ede1 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/veh.school-bus.wrecked.lod1.glb?v=96949cf8e5",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/veh.school-bus.wrecked.lod1.glb?v=96949cf8e5 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/veh.school-bus.wrecked.glb?v=bd9a28b0d9",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/veh.school-bus.wrecked.glb?v=bd9a28b0d9 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/prop.fire-hydrant.lod1.glb?v=d7cd8d9bd0",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/prop.fire-hydrant.lod1.glb?v=d7cd8d9bd0 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/prop.street-sign.lod1.glb?v=cf7e25b77b",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/prop.street-sign.lod1.glb?v=cf7e25b77b net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/prop.street-sign.glb?v=e723bc9dbe",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/prop.street-sign.glb?v=e723bc9dbe net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/int.basement-cellar.lod1.glb?v=ad3ca99eeb",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/int.basement-cellar.lod1.glb?v=ad3ca99eeb net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/int.basement-cellar.glb?v=b7f31560e0",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/int.basement-cellar.glb?v=b7f31560e0 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/prop.jersey-barrier.lod1.glb?v=85ca235d87",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/prop.jersey-barrier.lod1.glb?v=85ca235d87 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/prop.jersey-barrier.glb?v=f7ecb9b84e",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/prop.jersey-barrier.glb?v=f7ecb9b84e net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/decay.damaged-sign.lod1.glb?v=ceac02758c",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/decay.damaged-sign.lod1.glb?v=ceac02758c net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/decay.damaged-sign.glb?v=086308496d",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/decay.damaged-sign.glb?v=086308496d net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/util.radio.lod1.glb?v=946e69a9b1",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/util.radio.lod1.glb?v=946e69a9b1 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/assets/models/util.radio.glb?v=b6788b4697",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "requestfailed: http://127.0.0.1:3498/assets/models/util.radio.glb?v=b6788b4697 net::ERR_ABORTED",
+   "HTTP 404: http://127.0.0.1:3498/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&dpr=1",
+   "console.error: Failed to load resource: the server responded with a status of 404 (Not Found)",
+ ]
```

```
Error: page.waitForFunction: Test timeout of 240000ms exceeded.
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
  33 |   errorGuard: [async ({ page }, use) => {
  34 |     if (process.env.E2E_SKIN !== undefined) await page.addInitScript(skin => {
  35 |       const url = new URL(location.href); if (!url.searchParams.has('skin')) { url.searchParams.set('skin', skin); history.replaceState(null, '', url); }
  36 |     }, process.env.E2E_SKIN);
  37 |     const guard = attachErrorGuard(page);
  38 |     await use(); guard.dispose();
  39 |     expect(guard.errors, 'Uncaught errors, console errors and failed requests').toEqual([]);
  40 |   }, { auto: true }],
  41 | });
  42 | export { expect };
  43 | export const testUrl = '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1';
  44 | export async function boot(page: Page, url = testUrl): Promise<void> {
  45 |   await page.goto(url);
> 46 |   await page.waitForFunction(() => Boolean(window.__SS__));
     |              ^ Error: page.waitForFunction: Test timeout of 240000ms exceeded.
  47 |   await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  48 | }
  49 | 
```