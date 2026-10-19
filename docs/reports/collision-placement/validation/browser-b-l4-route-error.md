# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L4.spec.ts >> L4 The Safe City Falls in the browser >> T-E22-18 @E22 @E22-AC18 @E22-AC19 real-input playthrough: convoy, quartermaster, the turn, the war, the line break, Kessler Lane, the barred cellar door; photo spots and pair cameras
- Location: tests/e2e/levels/L4.spec.ts:132:3

# Error details

```
Error: Could not travel to {"x":-44,"z":-37.4} from {"x":-3.3936901092529297,"y":0.8500000238418579,"z":40.88429260253906,"yaw":-1.958208391202605} {"hp":67,"deaths":4,"near":1}
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic:
      - text: N ▲
      - generic "Objective direction": ◆
    - button "Pause" [ref=e4] [cursor=pointer]: Ⅱ
    - button "Home" [ref=e5] [cursor=pointer]
    - generic:
      - generic:
        - generic "Survivor portrait"
        - generic:
          - meter "health":
            - generic: 67 / 100
        - 'button "Active weapon: fire axe, 0.1s" [ref=e8] [cursor=pointer]'
      - generic: Corgi · following
      - generic "North-up minimap, range 30 meters":
        - generic: "N"
        - generic "Next turn on the cellar route": ◆
        - generic: ▲
        - generic: ⌂
      - generic: Run to the cellar via Lakeshore, Metro Road and Harbor Street · 266 m
      - status: Stand / F / MMB · Stand by the door to enter
      - status: ☀ Clear
    - status: 🐾 ←
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
  1   | import { levelFourLayouts } from '../../../src/levels/L4/layout';
  2   | import type { DistrictLayout } from '../../../src/levels/districts/types';
  3   | import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
  4   | import { PNG } from 'pngjs';
  5   | import type { Page } from '@playwright/test';
  6   | import { test, expect, boot, testUrl } from '../fixtures';
  7   | import { l4, l4Anchors } from '../../../src/data/l4';
  8   |
  9   | /** E22 L4 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
  10  | const output = 'test-results/epics/E22';
  11  | test.use({ trace: 'off' }); // Use the shared platform backend: Metal on Mac, SwiftShader on Hetzner.
  12  | type P = { x: number; z: number };
  13  | const fair = levelFourLayouts([JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout])[0];
  14  | /** Authored L4 anchors; the door and the brace come from the layout (levelFourLayouts derives them the same way). */
  15  | const at = (name: string): P => {
  16  |   if (name === 'l4-cellar-door') { const d = fair.anchors['kessler-cellar-door'].position; return { x: d[0], z: d[2] }; }
  17  |   if (name === 'l4-brace') { const c = fair.anchors['cellar-interior'].position; return { x: c[0] - .4, z: c[2] + 2.6 }; }
  18  |   return { x: l4Anchors[name][0], z: l4Anchors[name][1] };
  19  | };
  20  |
  21  | function helpers(page: Page) {
  22  |   const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  23  |   const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  24  |   const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  25  |   const shots = new Set<string>();
  26  |   const snap = async (name: string) => {
  27  |     await page.evaluate(n => window.__SS__!.camera.preset(`D-FAIR/W0/${n}`), name);
  28  |     await page.evaluate(() => window.__SS__!.screenshotReady());
  29  |     await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
  30  |     await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  31  |   };
  32  |   /** Shift + click the nearest visible infected within `range` (the machine gun shoots it, the axe swings at arm's length). */
  33  |   const fightNearby = async (range = 2.6): Promise<boolean> => {
  34  |     const target = await page.evaluate(range => {
  35  |       const a = window.__SS__!, p = a.getState().player!.transform;
  36  |       const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && a.input.visible(e.transform) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < range).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
  37  |       return near ? a.input.project(near.transform) : null;
  38  |     }, range);
  39  |     if (!target) return false;
  40  |     await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(20); await page.mouse.up(); await page.keyboard.up('Shift');
  41  |     return true;
  42  |   };
  43  |   /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  44  |   const go = async (target: P, stop = 1.2, done?: () => Promise<boolean>, range = 2.6) => {
  45  |     const click = async () => {
  46  |       const start = (await player()).transform, m = await mission();
  47  |       // After a collapse respawn, resume the authored street route. The extended
  48  |       // north/west legs must not click diagonally through the fallen camp.
  49  |       let goal = target;
  50  |       if (m.l4?.phase === 'collapse') {
  51  |         const route = l4.finale.route, end = route.findIndex(([x, z]) => Math.hypot(x - target.x, z - target.z) < .1);
  52  |         let nearest = Infinity;
  53  |         for (let i = 1; i <= end; i++) {
  54  |           const [ax, az] = route[i - 1], [bx, bz] = route[i], dx = bx - ax, dz = bz - az;
  55  |           const t = Math.max(0, Math.min(1, ((start.x - ax) * dx + (start.z - az) * dz) / (dx * dx + dz * dz)));
  56  |           const distance = Math.hypot(start.x - ax - dx * t, start.z - az - dz * t);
  57  |           if (distance >= nearest) continue;
  58  |           nearest = distance;
  59  |           const next = Math.hypot(start.x - bx, start.z - bz) <= stop && i < end ? route[i + 1] : route[i];
  60  |           goal = { x: next[0], z: next[1] };
  61  |         }
  62  |         if (end >= 0 && start.x < -12 && start.z > l4.map.plaza.z0 && start.z < l4.map.plaza.z1) goal = { x: -4, z: 3 };
  63  |       }
  64  |       await page.evaluate(({ start, target }) => {
  65  |         const a = window.__SS__!, x = (start.x + target.x) / 2, z = (start.z + target.z) / 2, r = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
  66  |         a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
  67  |       }, { start, target: goal });
  68  |       // Resolve the queued screen click with the same camera used to project it (as in the L5 harness).
  69  |       await step(1);
  70  |       const point = await page.evaluate(q => window.__SS__!.input.project(q), goal);
  71  |       await page.mouse.click(point.x, point.y); await step(1);
  72  |       await page.evaluate(() => window.__SS__!.camera.follow());
  73  |     };
  74  |     await click();
  75  |     let fights = 0;
  76  |     for (let i = 0; i < 600; i++) {
  77  |       await step(20);
  78  |       if (done && await done()) return;
  79  |       const p = (await player()).transform;
  80  |       if (Math.hypot(target.x - p.x, target.z - p.z) <= stop) return;
  81  |       const crowd = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 10).length; });
  82  |       // Many ahead: back off for a moment (they string out), then push on.
  83  |       if (crowd >= 5 && (await mission()).l4?.phase === 'collapse') { await click(); fights = 0; }
  84  |       else if (crowd >= 5) {
  85  |         const p0 = (await player()).transform, back = { x: p0.x - Math.sign(target.x - p0.x) * 8, z: p0.z };
  86  |         const point = await page.evaluate(q => window.__SS__!.input.project(q), back); await page.mouse.click(point.x, point.y); await step(45); await click(); fights = 0;
  87  |       }
  88  |       else if (fights < 3 && (await player()).health.current > 0 && await fightNearby(range)) { fights++; await click(); }
  89  |       else if (fights >= 3) { if (++fights >= 8) fights = 0; if (fights === 4) await click(); }
  90  |       else if (i % 10 === 9) await click();
  91  |     }
  92  |     const why = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!; return { hp: p.health.current, deaths: a.missions.state()!.stats.deaths, near: a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 10).length }; });
> 93  |     throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)} ${JSON.stringify(why)}`);
      |           ^ Error: Could not travel to {"x":-44,"z":-37.4} from {"x":-3.3936901092529297,"y":0.8500000238418579,"z":40.88429260253906,"yaw":-1.958208391202605} {"hp":67,"deaths":4,"near":1}
  94  |   };
  95  |   const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  96  |   return { step, mission, player, snap, shots, go, fightNearby, interact };
  97  | }
  98  | const begin = async (page: Page, level = 'L4', progression: string | undefined = 'L4-default') => {
  99  |   await boot(page, `${testUrl}&ui=1`);
  100 |   await page.evaluate(({ level, progression }) => window.__SS__!.loadLevel(level, { seed: 1, ...(progression ? { progression: progression as 'L4-default' } : {}) }), { level, progression });
  101 |   await page.evaluate(() => window.__SS__!.pause());
  102 |   await page.getByRole('button', { name: 'Begin mission' }).click();
  103 |   await page.evaluate(() => window.__SS__!.pause());
  104 | };
  105 |
  106 | test.describe('L4 The Safe City Falls in the browser', () => {
  107 |   test('T-E22-alarm @E22 @E22-AC07 real-input alarm has living visible infected within 10 seconds', async ({ page }) => {
  108 |     test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  109 |     await begin(page);
  110 |     const h = helpers(page);
  111 |     for (let i = 0; i < 80 && (await h.mission()).l4!.phase === 'convoy'; i++) await h.step(30);
  112 |     await h.go(at('l4-quartermaster'), .7); await h.interact();
  113 |     for (let i = 0; i < 10 && !(await h.mission()).l4!.gunAt; i++) { await h.interact(); await h.step(10); }
  114 |     expect((await h.mission()).l4!.gunAt).toBeGreaterThan(0);
  115 |     await h.go({ x: -21.5, z: 3 }, 1.4);
  116 |     for (let i = 0; i < 1000 && !(await h.mission()).l4!.warAt; i++) await h.step(3);
  117 |     const alarm = (await h.mission()).l4!.warAt;
  118 |     expect(alarm).toBeGreaterThan(0);
  119 |     let visible = 0, alive = 0, elapsed = 0;
  120 |     for (let i = 0; i < 100; i++) {
  121 |       await h.step(6);
  122 |       const r = await page.evaluate(() => { const a = window.__SS__!, live = a.query({kind:'infected'}).filter(e => e.health.current > 0 && !e.hidden); return { tick:a.tick(), alive:live.length, visible:live.filter(e=>{const p=a.camera.project(e.transform.x,e.transform.y,e.transform.z);return Math.abs(p[0])<1&&Math.abs(p[1])<1&&Math.abs(p[2])<1;}).length }; });
  123 |       visible = r.visible; alive = r.alive; elapsed = (r.tick - alarm) / 60;
  124 |       if (visible && alive) break;
  125 |     }
  126 |     await page.evaluate(() => window.__SS__!.screenshotReady());
  127 |     await page.screenshot({path:`${output}/alarm-visible.png`});
  128 |     writeFileSync(`${output}/alarm-visible.json`,JSON.stringify({visible,alive,elapsed}));
  129 |     expect(alive).toBeGreaterThan(0); expect(visible).toBeGreaterThan(0); expect(elapsed).toBeLessThanOrEqual(10);
  130 |   });
  131 |
  132 |   test('T-E22-18 @E22 @E22-AC18 @E22-AC19 real-input playthrough: convoy, quartermaster, the turn, the war, the line break, Kessler Lane, the barred cellar door; photo spots and pair cameras', async ({ page }) => {
  133 |     test.setTimeout(2_400_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  134 |     await begin(page);
  135 |     const h = helpers(page), { step, mission, player, snap, go, interact, fightNearby } = h;
  136 |     // The ride: the courier is a seated passenger; the convoy passes the gate and tours the clean city.
  137 |     expect((await player()).hidden).toBe(true);
  138 |     for (let i = 0; i < 200 && (await mission()).l4!.phase === 'convoy'; i++) {
  139 |       await step(15);
  140 |       const m = await mission(), bus = await page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id)?.transform, m.l4!.convoyIds[4]);
  141 |       if (!h.shots.has('l4-convoy-arrival') && bus && bus.x > 0 && bus.z < 10 && m.l4!.convoyV < 4) await snap('l4-convoy-arrival');
  142 |     }
  143 |     expect((await mission()).l4!.phase).toBe('plaza');
  144 |     if (!h.shots.has('l4-convoy-arrival')) await snap('l4-convoy-arrival');
  145 |     expect((await player()).hidden).toBeFalsy();
  146 |     // The safe city: nothing has happened yet (zero infected), every photo spot of the calm and the four pair cameras.
  147 |     await step(60);
  148 |     expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
  149 |     for (const name of ['l4-plaza-safe', 'l4-harbor-street-safe', 'l4-metro-entrance-safe', 'pair-plaza', 'pair-harbor-street', 'pair-metro-entrance', 'pair-kessler-lane']) await snap(name);
  150 |     // The machine gun: stand at the quartermaster's table and press E; it joins the carried weapons and is selected, no ammunition HUD.
  151 |     await go(at('l4-quartermaster'), .7); await interact();
  152 |     for (let i = 0; i < 10 && !(await mission()).l4!.gunAt; i++) { await interact(); await step(10); }
  153 |     expect((await mission()).l4!.gunAt).toBeGreaterThan(0);
  154 |     expect((await player()).weapons!.RIGHT.rack[0].id).toBe('weapon.army-mg'); expect((await player()).weapons!.selectedSide).toBe('RIGHT');
  155 |     await expect(page.getByTestId('weapon-active')).toHaveAttribute('aria-label', /, Ready/);
  156 |     // The turn: wait in the plaza (the soldiers hold, the people queue); the first evacuees collapse.
  157 |     await go({ x: -21.5, z: 3 }, 1.4);
  158 |     let turnShot = false;
  159 |     for (let i = 0; i < 300 && !(await mission()).l4!.turnAt; i++) await step(20);
  160 |     expect((await mission()).l4!.turnAt).toBeGreaterThan(0);
  161 |     await snap('l4-first-turn'); turnShot = true; void turnShot;
  162 |     // The war: hold the plaza with the army, shooting what comes within range; photos of the line and the tank.
  163 |     let line = false, tank = false;
  164 |     for (let i = 0; i < 1200 && !(await mission()).l4!.lineBreakAt; i++) { // l4-collapse: the war lasts ~3 min (three lines, then "Fall back!")
  165 |       const kit = await page.evaluate(() => {
  166 |         const a = window.__SS__!, p = a.getState().player!, s = a.missions.state()!.l4!;
  167 |         if (p.health.current > p.health.max * .5) return null;
  168 |         const near = s.medkitIds.map(id => a.getEntity(id)).filter(e => e?.pickup && 'kind' in e.pickup && !e.pickup.collected && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 14)
  169 |           .sort((x, y) => Math.hypot(x!.transform.x - p.transform.x, x!.transform.z - p.transform.z) - Math.hypot(y!.transform.x - p.transform.x, y!.transform.z - p.transform.z))[0];
  170 |         return near ? { x: near.transform.x, z: near.transform.z } : null;
  171 |       });
  172 |       if (kit) await go(kit, .6, async () => (await mission()).l4!.lineBreakAt > 0, 6);
  173 |       else if (!await fightNearby(16)) await step(15);
  174 |       const m = await mission();
  175 |       const inFrame = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 22, e.transform.z - 3) < 24).length);
  176 |       if (!line && inFrame >= 8) { await snap('l4-war-line'); line = true; }
  177 |       if (!tank && m.l4!.tankShots >= 1) { await snap('l4-tank'); tank = true; }
  178 |     }
  179 |     const warEnd = await mission();
  180 |     expect(warEnd.l4!.lineBreakAt, JSON.stringify({ phase: warEnd.phase, time: warEnd.stats.time, deaths: warEnd.stats.deaths, cinematic: warEnd.cinematic, turnAt: warEnd.l4!.turnAt, beats: warEnd.l4!.director.lines })).toBeGreaterThan(0);
  181 |     if (!line) await snap('l4-war-line'); if (!tank) await snap('l4-tank');
  182 |     await step(150); await snap('l4-collapse');
  183 |     await expect(page.getByTestId('weapon-active')).not.toHaveAttribute('aria-label', /\d+\s*\/\s*\d+/);
  184 |     // The collapse: the escape street (l4-collapse-2: at "Fall back!" the horde leaves a gap on it; pursuers still chase): out of the ring's
  185 |     // east side, down to Lakeshore Avenue and east to Kessler's cellar door, through whatever comes.
  186 |     const inCellar = async () => (await mission()).l4!.phase === 'cellar';
  187 |     const route: P[] = [...l4.finale.route.slice(1).map(([x, z]) => ({ x, z })), at('l4-cellar-door')];
  188 |     for (const wp of route) { await go(wp, 2.2, inCellar, 9); if (await inCellar()) break; }
  189 |     for (let i = 0; i < 40 && !await inCellar(); i++) { await go(at('l4-cellar-door'), .5, inCellar, 9); await interact(); await step(20); }
  190 |     expect(await inCellar()).toBe(true);
  191 |     // The cellar: alone, one bulb; bar the door; the battle goes on above, muffled, for at least 6 s; the level ends straight into L5.
  192 |     await step(60); await snap('l4-basement');
  193 |     await go(at('l4-brace'), .4);
```
