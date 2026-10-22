# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/zoo-s2.spec.ts >> T-E07-19-elephant-charge-browser @E07-AC05 @E07-AC19 @E30-AC10 production telegraph, pause, activation and shared bar
- Location: tests/e2e/zoo-s2.spec.ts:6:3

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 1
Received length: 0
Received array:  []
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: N ▲
```

# Test source

```ts
  1  | import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
  2  | import { test, expect } from './fixtures';
  3  | import type { SceneSpec } from '../../src/debug/scenelab/spec';
  4  | 
  5  | for (const [name, move, windup] of [['gorilla-throw', 'gorilla.grab-throw', 48], ['elephant-charge', 'elephant.charge', 54], ['elephant-swipe', 'elephant.swipe', 42]] as const) {
  6  |   test(`T-E07-19-${name}-browser @E07-AC05 @E07-AC19 @E30-AC10 production telegraph, pause, activation and shared bar`, async ({ page }) => {
  7  |     test.setTimeout(120_000);
  8  |     const spec = JSON.parse(readFileSync(`tests/scenes/zoo-s2/qa-zoo-${name}.json`, 'utf8')) as SceneSpec;
  9  |     await page.goto('/?test=1&scenelab&renderer=webgl&quality=high&audio=muted&profile=1&dpr=1');
  10 |     await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  11 |     await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ flashReduction: true, gore: 'Off' }); }, spec);
  12 |     await page.evaluate(async n => { await window.__SCENE__!.step(1); await window.__SS__!.step(n - 1); await window.__SCENE__!.ready(); }, windup - 1);
  13 |     const before = await page.evaluate(() => ({ id: window.__SCENE__!.actors.get('animal')!.entity, state: window.__SS__!.getState(), events: window.__SS__!.events() }));
  14 |     const a = before.state.entities.find(e => e.id === before.id)!.infected!.specialAttack!;
  15 |     expect(before.state.entities.find(e => e.id === before.id)!.health.max).toBe(move.startsWith('elephant') ? 1200 : 1800);
  16 |     expect(a).toMatchObject({ move, stage: 'telegraph' }); expect(a.activeTick - a.startTick).toBe(windup);
  17 |     expect(before.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(true);
  18 |     const phone = page.viewportSize()!.width < 900;
  19 |     expect(before.state.render.healthBars?.bars.find(b => b.id === before.id)).toMatchObject({ fraction: 1, width: phone ? 48 : 64, height: phone ? 6 : 8 });
  20 |     await page.evaluate(() => window.__SS__!.pause());
  21 |     await page.waitForTimeout(100);
  22 |     expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(before.state.tick);
  23 |     await page.evaluate(async () => { await window.__SS__!.step(1); await window.__SCENE__!.ready(); });
  24 |     const after = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
  25 |     expect(after.events.some(ev => ev.type === 'infected.special' && ev.attackId === a.attackId && ev.stage === 'active')).toBe(true);
  26 |     expect(after.state.render.vfx?.telegraphs.some(t => t.attackId === a.attackId)).toBe(false);
  27 |     if (move === 'elephant.swipe') expect(after.state.player!.health.current).toBe(75);
  28 |     await page.evaluate(async () => { await window.__SS__!.step(100); await window.__SCENE__!.ready(); });
  29 |     const impact = await page.evaluate(() => ({ state: window.__SS__!.getState(), events: window.__SS__!.events() }));
> 30 |     expect(impact.events.filter(ev => ev.type === 'infected.attack' && ev.attackId === a.attackId && ev.targetId === 1)).toHaveLength(1);
     |                                                                                                                          ^ Error: expect(received).toHaveLength(expected)
  31 |     expect(impact.state.player!.health.current).toBe(move === 'elephant.swipe' ? 75 : move === 'elephant.charge' ? 60 : 70);
  32 |   });
  33 | }
  34 | 
  35 | for (const [width, height] of [[390, 844], [844, 390]] as const) test(`T-E07-19-elephant-bar-${width} @E07-AC19 @E30-AC10 shared mobile bar uses real HP and updates within a frame`, async ({ page }) => {
  36 |   await page.setViewportSize({ width, height });
  37 |   const spec = JSON.parse(readFileSync('tests/scenes/zoo-s2/qa-zoo-elephant-swipe.json', 'utf8')) as SceneSpec;
  38 |   spec.script = []; spec.actors![0].at = [8, 0];
  39 |   await page.goto('/?test=1&scenelab&renderer=webgl&quality=low&audio=muted&dpr=1');
  40 |   await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  41 |   await page.evaluate(async s => { await window.__SS__!.ready; await window.__SCENE__!.load(s); window.__SS__!.settings.set({ textSize: 1.5 }); await window.__SCENE__!.ready(); }, spec);
  42 |   const id = await page.evaluate(() => window.__SCENE__!.actors.get('animal')!.entity);
  43 |   expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), id)).toMatchObject({ fraction: 1, width: 48, height: 6 });
  44 |   await page.evaluate(async () => { window.__SCENE__!.command('animal', { hit: { amount: 300 } }); await window.__SCENE__!.step(1); await window.__SCENE__!.ready(); });
  45 |   expect(await page.evaluate(id => window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id), id)).toMatchObject({ fraction: .75, width: 48, height: 6 });
  46 |   const out = 'test-results/epics/E07/phone-bars'; mkdirSync(out, { recursive: true });
  47 |   await page.locator('canvas').screenshot({ path: `${out}/elephant-${width}.png` });
  48 |   writeFileSync(`${out}/elephant-${width}.json`, JSON.stringify(await page.evaluate(id => ({ entity: window.__SS__!.getEntity(id), bars: window.__SS__!.getState().render.healthBars }), id), null, 2));
  49 | });
  50 | 
```