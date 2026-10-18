# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/interaction-viewport.spec.ts >> @E26-AC16 @E24 interaction panel stays inside all viewport edges webgl high
- Location: tests/e2e/interaction-viewport.spec.ts:6:3

# Error details

```
Error: page.evaluate: TypeError: Failed to fetch
    at id.load (http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:238989)
    at http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:237793
    at new Promise (<anonymous>)
    at id.loadAsync (http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:237765)
    at xo (http://127.0.0.1:3446/build/registry-tmCKZxLn.js:2:84948)
    at nb.glb (http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:484750)
    at http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:511859
    at Array.map (<anonymous>)
    at http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:511838
    at Array.map (<anonymous>)
```

```
Error: Uncaught errors, console errors and failed requests

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 63

- Array []
+ Array [
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/util.radio.lod2.glb?v=20668d9683 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/prop.emergency-light.lod2.glb?v=00e0f04231 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/prop.emergency-light.lod1.glb?v=65447728cb net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/kit.metro-track.lod2.glb?v=7e6cefa28d net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/layouts/D-SUBWAY.base.glb?v=13667160e0 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "console.error: Level load failed TypeError: Failed to fetch
+     at id.load (http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:238989)
+     at http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:237793
+     at new Promise (<anonymous>)
+     at id.loadAsync (http://127.0.0.1:3446/build/three.module-BSnTNmqF.js:5:237765)
+     at xo (http://127.0.0.1:3446/build/registry-tmCKZxLn.js:2:84948)
+     at nb.glb (http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:484750)
+     at http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:511859
+     at Array.map (<anonymous>)
+     at http://127.0.0.1:3446/build/index-C9S8-D5W.js:9:511838
+     at Array.map (<anonymous>)",
+   "requestfailed: http://127.0.0.1:3446/build/civilianBake.worker-C13d_nt9.js net::ERR_ABORTED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/acc.headlamp.glb?v=d24ee55287 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/prop.jersey-barrier.lod1.glb?v=85ca235d87 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/statics/prop.crates.lod2.base.3ef2ddbe8eab5787.bin.gz net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/veh.sedan-green.wrecked.lod2.glb?v=c6fa33cf5a net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/bld.house-a.lod2.glb?v=4f3da3d252 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/decay.fuel-truck-crater.lod2.glb?v=840a0590c4 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/statics/prop.crates.lod1.base.761d5c1f5df0447c.bin.gz net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/util.radio.lod1.glb?v=946e69a9b1 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/kit.metro-track.lod1.glb?v=91e569eb6a net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/wpn.fire-axe.glb?v=4f1749fbf0 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/wpn.machine-gun.glb?v=e2bb4df71c net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/prop.crates.lod2.glb?v=80a0efbb15 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/veh.sedan-green.wrecked.lod1.glb?v=35afc66193 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/bld.house-a.lod1.glb?v=d2682b9d27 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/decay.fuel-truck-crater.lod1.glb?v=81c0b3cd17 net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "requestfailed: http://127.0.0.1:3446/assets/models/prop.crates.lod1.glb?v=3acece132e net::ERR_CONNECTION_REFUSED",
+   "console.error: Failed to load resource: net::ERR_CONNECTION_REFUSED",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - status [ref=e3]:
    - generic [ref=e4]:
      - heading "Loading neighborhood" [level=1] [ref=e5]
      - paragraph [ref=e6]: Getting the neighborhood ready.
      - progressbar "Level loading progress" [ref=e7]
      - paragraph [ref=e8]: Could not load the neighborhood. Please try again.
      - button "Try again" [ref=e9]
  - text: N ▲
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