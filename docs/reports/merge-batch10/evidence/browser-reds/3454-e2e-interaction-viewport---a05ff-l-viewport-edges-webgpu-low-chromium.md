# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/interaction-viewport.spec.ts >> @E26-AC16 @E24 interaction panel stays inside all viewport edges webgpu low
- Location: tests/e2e/interaction-viewport.spec.ts:6:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic:
    - generic: Cover the retreat through the tunnel · 151 m
    - generic "Objective minimap": N ▲
    - generic "Objective direction": ➜
    - generic: "New objective: Cover the retreat through the tunnel"
  - generic:
    - strong: Block the tunnel
    - progressbar "Interaction progress"
    - generic: Let everyone pass · E to close the gate
  - generic:
    - generic: The injured cannot run. Stay with them; I will hold the rear.
    - generic:
      - generic:
        - generic "Dale"
        - generic: Dale
        - meter "survivor-health-dale"
      - generic:
        - generic "Rosa"
        - generic: Rosa
        - meter "survivor-health-rosa"
      - generic:
        - generic "Mr. Okafor"
        - generic: Mr. Okafor
        - meter "survivor-health-okafor"
      - generic:
        - generic "Mia"
        - generic: Mia
        - meter "survivor-health-mia"
      - generic:
        - generic "Sam"
        - generic: Sam
        - meter "survivor-health-sam"
    - generic:
      - generic "Survivor portrait"
      - generic:
        - meter "health":
          - generic: 100 / 100
      - 'button "Active weapon: Machine gun, Ready" [ref=e4] [cursor=pointer]'
    - generic: Corgi · awaiting rescue
    - generic "North-up minimap, range 30 meters":
      - generic: "N"
      - generic: ▲
      - generic: ⌂
    - generic: Cover the retreat through the tunnel · 151 m
    - status: ☀ Clear
```

# Test source

```ts
  1  | import { mkdirSync, writeFileSync } from 'node:fs';
  2  | import { readSpec } from '../../tools/scenelab/session';
  3  | import { boot, expect, test } from './fixtures';
  4  | 
  5  | for (const backend of ['webgl', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
  6  |   test(`@E26-AC16 @E24 interaction panel stays inside all viewport edges ${backend} ${tier}`, async ({ page }) => {
  7  |     test.setTimeout(300_000);
  8  |     await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
  9  |     const out = `test-results/ui-night/panels/${backend}-${tier}`;
  10 |     mkdirSync(out, { recursive: true });
  11 |     const results = [];
  12 |     for (const viewport of [{ width: 1600, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  13 |       await page.setViewportSize(viewport);
  14 |       for (const name of ['barricade-W0', 'barricade-W5', 'l6-gate']) {
  15 |         const spec = readSpec(`tests/scenes/catalog/ui-night-${name}.json`);
  16 |         await page.evaluate(async ({ spec, tier }) => { window.__SS__!.settings.set({ quality: tier }); await window.__SCENE__!.load(spec); }, { spec, tier });
  17 |         expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(tier);
  18 |         // State changes can change caption wrapping and hide the coverage meter.
  19 |         let current = 0;
  20 |         for (const frame of name === 'l6-gate' ? [0, 61, 81, 106] : [0, 90, 101, 116]) {
  21 |           await page.evaluate(async frames => { if (frames > 0) await window.__SCENE__!.step(frames); }, frame - current);
  22 |           current = frame;
  23 |           if (name === 'l6-gate' && frame > 0) {
  24 |             const gate = await page.evaluate(() => window.__SS__!.barricades.slots().find(s => s.state.slot.id === 'l6-gate-90')!);
> 25 |             expect(gate.state.intact).toBe(frame < 100);
     |                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  26 |           }
  27 |           for (const zoom of [.5, 1, 1.5]) {
  28 |             await page.evaluate(async ({ zoom, camera }) => {
  29 |               window.__SCENE__!.setCamera({ ...camera, mode: 'game', zoom });
  30 |               await window.__SS__!.screenshotReady();
  31 |             }, { zoom, camera: spec.camera });
  32 |             const panel = page.getByTestId('interaction-prompt');
  33 |             // A full, braced barricade has no active repair interaction.
  34 |             if (name !== 'l6-gate' && frame === 90) {
  35 |               expect(await page.evaluate(() => window.__SS__!.barricades.intact('door'))).toBe(true);
  36 |               await expect(panel).toBeHidden();
  37 |               await page.screenshot({ path: `${out}/${name}-${viewport.width}x${viewport.height}-f${frame}-z${zoom}.png` });
  38 |               continue;
  39 |             }
  40 |             await expect(panel).toBeVisible();
  41 |             const rect = await panel.boundingBox(); expect(rect).not.toBeNull();
  42 |             expect(rect!.x).toBeGreaterThanOrEqual(7.5); expect(rect!.y).toBeGreaterThanOrEqual(7.5);
  43 |             expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width - 7.5);
  44 |             expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height - 7.5);
  45 |             results.push({ viewport, name, frame, zoom, rect, text: await panel.innerText() });
  46 |             await page.screenshot({ path: `${out}/${name}-${viewport.width}x${viewport.height}-f${frame}-z${zoom}.png` });
  47 |           }
  48 |         }
  49 |       }
  50 |     }
  51 |     expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
  52 |     writeFileSync(`${out}/bounds.json`, JSON.stringify(results, null, 2));
  53 |   });
  54 | }
  55 | 
```