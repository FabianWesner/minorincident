# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/l4-plaza-movement.spec.ts >> @E22 L4 war: mouse WASD stick webgl high zoom 0.5
- Location: tests/e2e/levels/l4-plaza-movement.spec.ts:62:3

# Error details

```
Error: {"point":{"x":-22.442640687119283,"z":8.242640687119284},"screen":{"x":424.32599048670386,"y":360.00012471485957},"input":{"move":{"x":0,"z":0},"aim":{"x":-0.707106260496445,"z":0.7071073018762668},"aimSource":"pointer","left":{"down":true,"held":false,"up":true},"right":{"down":false,"held":false,"up":false},"selector":0,"interact":false,"pause":false,"cancelMove":true,"drive":{"throttle":0,"steer":0},"brake":false,"aimPoint":{"x":-22.44264071483473,"z":8.242640677610666},"mouseAttack":true,"attackTarget":{"id":153,"side":"LEFT"},"pointerTarget":true},"picks":[{"id":153,"score":0.2760677793069961,"depth":8.880690203873968,"drawn":true}]}

expect(received).toBeDefined()

Received: undefined
```

# Page snapshot

```yaml
- generic:
  - generic:
    - generic:
      - text: N ▲
      - status: Contact! All sides! Hold the plaza!
    - button "Pause" [ref=e2] [cursor=pointer]: Ⅱ
    - button "Home" [ref=e3] [cursor=pointer]
    - generic:
      - generic:
        - generic "Survivor portrait"
        - generic:
          - meter "health":
            - generic: 100 / 100
        - generic "Corgi · following": 🐕
      - button "North-up minimap, range 30 meters" [expanded] [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: "N"
        - generic [ref=e8]: ▲
        - generic [ref=e9]: ⌂
      - button "Hold the plaza with the army" [ref=e12] [cursor=pointer]
      - status: Stand / F / MMB · Stand by the door to enter
      - status: ☀ Clear
    - status: 🐾 ←
```

# Test source

```ts
  1   | import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import type { CDPSession, Page } from '@playwright/test';
  3   | import { boot, expect, test } from '../fixtures';
  4   |
  5   | type Point = { x: number; z: number };
  6   | // Same start as tests/levels/L4-movement.test.ts (a14716df): the parked convoy nav margin covers the old east tile from (-17.5, 4).
  7   | const center = { x: -18.2, z: 4 }, d = 6 / Math.SQRT2;
  8   | const targets = [
  9   |   { name: 'left', key: 'a', x: center.x - d, z: center.z + d },
  10  |   { name: 'right', key: 'd', x: center.x + d, z: center.z - d },
  11  |   { name: 'up', key: 'w', x: center.x - d, z: center.z - d },
  12  |   { name: 'down', key: 's', x: center.x + d, z: center.z + d },
  13  | ];
  14  | const position = (page: Page) => page.evaluate(() => window.__SS__!.getState().player!.transform);
  15  | const step = (page: Page, n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  16  | const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.z - q.z);
  17  | async function reset(page: Page, at: Point, settle = 30): Promise<void> {
  18  |   await page.evaluate(({ at, settle }) => { const a = window.__SS__!; a.input.clear(); a.teleport('player', at); if (!settle) { const r = a.getState().render.camera.radius, off = r * Math.sin(Math.PI * .3) / Math.SQRT2; a.camera.cinematic({ position: [at.x + off, r * Math.cos(Math.PI * .3), at.z + off], target: [at.x, 0, at.z] }, true); } }, { at, settle });
  19  |   await step(page, settle);
  20  | }
  21  | /** Close framing cannot display a six metre goal in every direction. Click visible ground
  22  |  * on that route, then the final goal once it enters the follow camera; all input is real. */
  23  | async function clickTo(page: Page, target: Point, capture?: string): Promise<void> {
  24  |   for (let i = 0; i < 8 && distance(await position(page), target) >= .4; i++) {
  25  |     const p = await position(page);
  26  |     let point = target, screen = { x: 0, y: 0 }, fraction = 1;
  27  |     for (let j = 0; j < 12; j++) {
  28  |       point = { x: p.x + (target.x - p.x) * fraction, z: p.z + (target.z - p.z) * fraction };
  29  |       screen = await page.evaluate(p => window.__SS__!.input.project(p), point);
  30  |       if (await page.evaluate(({ x, y }) => x > 60 && x < innerWidth - 60 && y > 110 && y < innerHeight - 90 && document.elementFromPoint(x, y)?.tagName === 'CANVAS', screen)) break;
  31  |       fraction *= .7;
  32  |     }
  33  |     await page.mouse.click(screen.x, screen.y); await step(page, 1);
  34  |     const input = await page.evaluate(() => window.__SS__!.getState().input.frame);
> 35  |     expect(input.moveTarget, JSON.stringify({ point, screen, input, picks: await page.evaluate(() => window.__SS__!.input.lastPick()) })).toBeDefined();
      |                                                                                                                                           ^ Error: {"point":{"x":-22.442640687119283,"z":8.242640687119284},"screen":{"x":424.32599048670386,"y":360.00012471485957},"input":{"move":{"x":0,"z":0},"aim":{"x":-0.707106260496445,"z":0.7071073018762668},"aimSource":"pointer","left":{"down":true,"held":false,"up":true},"right":{"down":false,"held":false,"up":false},"selector":0,"interact":false,"pause":false,"cancelMove":true,"drive":{"throttle":0,"steer":0},"brake":false,"aimPoint":{"x":-22.44264071483473,"z":8.242640677610666},"mouseAttack":true,"attackTarget":{"id":153,"side":"LEFT"},"pointerTarget":true},"picks":[{"id":153,"score":0.2760677793069961,"depth":8.880690203873968,"drawn":true}]}
  36  |     expect(distance(input.moveTarget!, point)).toBeLessThan(.05);
  37  |     await step(page, 60);
  38  |     if (capture && i === 0) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: capture }); }
  39  |   }
  40  |   expect(distance(await position(page), target)).toBeLessThan(1);
  41  | }
  42  | async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number): Promise<void> {
  43  |   await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ id: 1, x, y: y!, radiusX: 1, radiusY: 1 }] });
  44  |   await cdp.send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
  45  | }
  46  | async function stickTo(page: Page, cdp: CDPSession, target: Point): Promise<void> {
  47  |   const origin = { x: 240, y: 400 };
  48  |   await touch(cdp, 'touchStart', origin.x, origin.y);
  49  |   for (let i = 0; i < 30; i++) {
  50  |     const p = await position(page), dx = target.x - p.x, dz = target.z - p.z, length = Math.hypot(dx, dz);
  51  |     if (length < .4) break;
  52  |     await touch(cdp, 'touchMove', origin.x + (dx - dz) / Math.SQRT2 / length * 60, origin.y + (dx + dz) / Math.SQRT2 / length * 60);
  53  |     await step(page, Math.min(12, Math.max(1, Math.floor(length / 4.5 * 60))));
  54  |     expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('touch');
  55  |   }
  56  |   await touch(cdp, 'touchEnd'); await step(page, 10);
  57  |   expect(distance(await position(page), target)).toBeLessThan(1);
  58  | }
  59  |
  60  | test.use({ viewport: { width: 1280, height: 720 }, hasTouch: true, launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });
  61  | for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) for (const phase of ['plaza', 'war', 'respawn'] as const) {
  62  |   test(`@E22 L4 ${phase}: mouse WASD stick ${renderer} ${quality} zoom ${zoom}`, async ({ page, context }) => {
  63  |     test.setTimeout(600_000); page.setDefaultTimeout(120_000);
  64  |     await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
  65  |     await page.evaluate(async quality => { const a = window.__SS__!; a.settings.set({ quality }); await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); }, quality);
  66  |     await page.getByRole('button', { name: 'Begin mission' }).click();
  67  |     await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); });
  68  |     for (let i = 0; i < 80 && await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase === 'convoy'); i++) await step(page, 30);
  69  |     expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('plaza');
  70  |     // The PO's rifle loadout; finish the interaction so it cannot snap a ground goal to the quartermaster.
  71  |     await page.evaluate(() => window.__SS__!.cheats.completeObjective('quartermaster'));
  72  |     if (phase !== 'plaza') {
  73  |       for (let i = 0; i < 60 && !await page.evaluate(() => window.__SS__!.missions.state()!.l4!.turnAt); i++) await step(page, 60);
  74  |       await step(page, 180);
  75  |       expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('war');
  76  |     }
  77  |     if (phase === 'respawn') {
  78  |       await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(false); a.survivor.damage(1000); });
  79  |       expect((await page.evaluate(() => window.__SS__!.getState().player!.health.current))).toBe(0);
  80  |       await step(page, 180);
  81  |       expect((await page.evaluate(() => window.__SS__!.getState().player!.health.current))).toBeGreaterThan(0);
  82  |       expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('turn');
  83  |       await page.evaluate(() => window.__SS__!.cheats.god(true));
  84  |     }
  85  |     for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(640, 360); await page.mouse.wheel(0, -120); await step(page, 2); }
  86  |     await step(page, 30);
  87  |     expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
  88  |     expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
  89  |     const out = `test-results/l4-walk-left/${renderer}-${quality}-z${zoom}-${phase}`;
  90  |     mkdirSync(out, { recursive: true });
  91  |     const results: unknown[] = [];
  92  |     // Valid capsule position at the south-west corner of the L4 armory table.
  93  |     // A square nav margin used to reject every outward step here.
  94  |     const corner = { x: -25.855, z: 1.855 }, away = { x: corner.x - 2 / Math.SQRT2, z: corner.z + 2 / Math.SQRT2 };
  95  |     await reset(page, corner, 0); await clickTo(page, away, `${out}/corner-left-walking.png`); await page.evaluate(() => window.__SS__!.camera.follow()); await step(page, 65);
  96  |     const cdp = await context.newCDPSession(page);
  97  |     for (const input of ['mouse', 'keyboard', 'stick']) for (const target of targets) {
  98  |       await reset(page, center);
  99  |       if (input === 'mouse') await clickTo(page, target, target.name === 'left' ? `${out}/left-walking.png` : undefined);
  100 |       if (input === 'keyboard') {
  101 |         await page.keyboard.down(target.key); await step(page, 82); await page.keyboard.up(target.key); await step(page, 10);
  102 |         expect(distance(await position(page), target)).toBeLessThan(1);
  103 |       }
  104 |       if (input === 'stick') await stickTo(page, cdp, target);
  105 |       const perf = await page.evaluate(() => { const p = window.__SS__!.perf(); return { backend: p.backend, tier: p.quality.tier, draws: p.drawCalls, triangles: p.triangles }; });
  106 |       expect(perf.draws).toBeLessThanOrEqual(quality === 'high' ? 600 : 300);
  107 |       expect(perf.triangles).toBeLessThanOrEqual(quality === 'high' ? 1_500_000 : 500_000);
  108 |       results.push({ input, target, reached: await position(page), perf });
  109 |     }
  110 |     writeFileSync(`${out}/movement.json`, JSON.stringify(results, null, 2));
  111 |   });
  112 | }
  113 |
```
