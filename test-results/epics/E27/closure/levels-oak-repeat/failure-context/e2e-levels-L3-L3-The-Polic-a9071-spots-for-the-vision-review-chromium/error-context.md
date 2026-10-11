# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L3.spec.ts >> L3 The Police Collapse in the browser >> T-E21-19 @E21 @E21-AC19 @E21-AC04 @E21-AC20 real-input playthrough: armory, station attack, fallback, oak to the army zone; photo spots for the vision review
- Location: tests/e2e/levels/L3.spec.ts:109:62

# Error details

```
Error: Could not travel to {"x":118,"z":24} from {"x":106.62232208251953,"y":0.8500000238418579,"z":25.383996963500977,"yaw":-2.9805933854926376} {"hp":100,"deaths":0,"near":0}
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic:
      - text: N ▲
      - generic "Objective direction": ➜
    - button "Pause" [ref=e4] [cursor=pointer]: Ⅱ
    - generic:
      - generic:
        - generic "Survivor portrait"
        - generic:
          - meter "health":
            - generic: 100 / 100
          - meter "armor":
            - generic: Armor 0%
      - generic: Corgi · following
      - generic "North-up minimap, range 30 meters":
        - generic: "N"
        - generic: ▲
        - generic: ⌂
      - generic: Reach the army checkpoint · 43 m
      - generic:
        - button "LEFT" [ref=e5] [cursor=pointer]:
          - generic [ref=e6]: RMB · NEXT
          - generic [ref=e7]: RMB to equip
          - generic [ref=e8]: corgi lure
        - button "RIGHT selected" [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: ACTIVE · LMB
          - generic [ref=e14]: Ready
          - generic [ref=e15]: handgun
          - generic [ref=e16]: ✓
      - status: ◌ Haze
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
  1   | import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import type { Page } from '@playwright/test';
  3   | import { test, expect, boot, testUrl } from '../fixtures';
  4   | import { l3, l3Anchors } from '../../../src/data/l3';
  5   | 
  6   | /** E21 L3 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
  7   | const output = 'test-results/epics/E21';
  8   | test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
  9   | const at = (name: string) => ({ x: l3Anchors[name][0], z: l3Anchors[name][1] });
  10  | type P = { x: number; z: number };
  11  | 
  12  | function helpers(page: Page) {
  13  |   const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  14  |   const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  15  |   const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  16  |   const shots = new Set<string>();
  17  |   const snap = async (name: string) => {
  18  |     await page.evaluate(n => window.__SS__!.camera.preset(`D-CORRIDOR/W2/${n}`), name);
  19  |     await page.evaluate(() => window.__SS__!.screenshotReady());
  20  |     await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
  21  |     await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  22  |   };
  23  |   /** Shift + click the nearest infected within `range` (the active handgun shoots it, the axe swings at arm's length). */
  24  |   const fightNearby = async (range = 2.6): Promise<boolean> => {
  25  |     const target = await page.evaluate(range => {
  26  |       const a = window.__SS__!, p = a.getState().player!.transform;
  27  |       const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < range).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
  28  |       const point = near ? a.input.project(near.transform) : null;
  29  |       // A covered/offscreen body cannot receive a physical canvas click.
  30  |       return point && document.elementFromPoint(point.x, point.y)?.tagName === 'CANVAS' ? point : null;
  31  |     }, range);
  32  |     if (!target) return false;
  33  |     await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(20); await page.mouse.up(); await page.keyboard.up('Shift');
  34  |     return true;
  35  |   };
  36  |   /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  37  |   let seenDeaths = 0;
  38  |   const go = async (target: P, stop = 1.2, done?: () => Promise<boolean>, range = 2.6) => {
  39  |     let groundStart = 0, lastRetry = (await player()).transform;
  40  |     const click = async () => {
  41  |       const start = (await player()).transform;
  42  |       await page.evaluate(({ start, target }) => {
  43  |         // A distant checkpoint respawn must still click the canvas, above the weapon HUD.
  44  |         const a = window.__SS__!, x = target.x, z = target.z, r = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
  45  |         a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
  46  |       }, { start, target });
  47  |       // Keep the destination in the canvas centre, clear of HUD buttons, and resolve the click
  48  |       // under the camera used to project it. A corpse at a waypoint
  49  |       // is still a valid attack target: choose nearby ground within the existing arrival tolerance.
  50  |       await step(1);
  51  |       const radius = stop * .8;
  52  |       const ground = [target, ...Array.from({ length: 16 }, (_, i) => ({
  53  |         x: target.x + Math.cos(i * Math.PI / 8) * radius,
  54  |         z: target.z + Math.sin(i * Math.PI / 8) * radius,
  55  |       }))];
  56  |       for (let j = 0; j < ground.length; j++) {
  57  |         const q = ground[(groundStart + j) % ground.length];
  58  |         const point = await page.evaluate(q => window.__SS__!.input.project(q), q);
  59  |         await page.mouse.click(point.x, point.y); await step(1);
  60  |         if (await page.evaluate(() => window.__SS__!.input.lastPick().length === 0)) break;
  61  |       }
  62  |       await page.evaluate(() => window.__SS__!.camera.follow());
  63  |     };
  64  |     await click();
  65  |     let fights = 0, retreatAt = -Infinity;
  66  |     for (let i = 0; i < 600; i++) {
  67  |       await step(20);
  68  |       if (process.env.L3_TRACE && i % 2 === 0) console.log(await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!, inf = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 12); return `T x=${p.transform.x.toFixed(0)} z=${p.transform.z.toFixed(0)} hp=${p.health.current.toFixed(0)} n12=${inf.length} n4=${inf.filter(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 4).length}`; }));
  69  |       const deaths = (await mission()).stats.deaths;
  70  |       if (deaths !== seenDeaths) { seenDeaths = deaths; const q = (await player()).transform; console.log(`L3 death #${deaths} near x=${q.x.toFixed(0)} z=${q.z.toFixed(0)}`); }
  71  |       if (done && await done()) return;
  72  |       const p = (await player()).transform;
  73  |       if (Math.hypot(target.x - p.x, target.z - p.z) <= stop) return;
  74  |       // Fight a few, then break away (PO: fight a few, flee from many; knocked-down infected get up again).
  75  |       const crowd = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 10).length; });
  76  |       // Many ahead: back off along the street for a moment (they string out), then push on.
  77  |       if (crowd >= 4 && i - retreatAt >= 30) {
  78  |         // Give the forward click time to pass the pack before retreating again.
  79  |         retreatAt = i;
  80  |         const p0 = (await player()).transform, back = { x: p0.x - 10, z: p0.z };
  81  |         const point = await page.evaluate(q => { const p = window.__SS__!.input.project(q); return document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS' ? p : null; }, back);
  82  |         if (point) { await page.mouse.click(point.x, point.y); await step(45); }
  83  |         await click(); fights = 0;
  84  |       }
  85  |       else if (fights < 3 && (await player()).health.current > 0 && await fightNearby(range)) { fights++; await click(); }
  86  |       else if (fights >= 3) { if (++fights >= 8) fights = 0; if (fights === 4) await click(); }
  87  |       else if (i % 10 === 9) {
  88  |         // A clear ground click can still approach the wrong side of a wreck. Try another
  89  |         // physical ground point within the unchanged waypoint tolerance after a stall.
  90  |         if (Math.hypot(p.x - lastRetry.x, p.z - lastRetry.z) < .25) groundStart = (groundStart + 1) % 17;
  91  |         lastRetry = p; await click();
  92  |       }
  93  |     }
  94  |     const why = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!; return { hp: p.health.current, deaths: a.missions.state()!.stats.deaths, near: a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 10).length }; });
> 95  |     throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)} ${JSON.stringify(why)}`);
      |           ^ Error: Could not travel to {"x":118,"z":24} from {"x":106.62232208251953,"y":0.8500000238418579,"z":25.383996963500977,"yaw":-2.9805933854926376} {"hp":100,"deaths":0,"near":0}
  96  |   };
  97  |   const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  98  |   return { step, mission, player, snap, shots, go, fightNearby, interact };
  99  | }
  100 | const begin = async (page: Page) => {
  101 |   await boot(page, `${testUrl}&ui=1`);
  102 |   await page.evaluate(() => window.__SS__!.loadLevel('L3', { seed: 1, progression: 'L3-default' }));
  103 |   await page.evaluate(() => window.__SS__!.pause());
  104 |   await page.getByRole('button', { name: 'Begin mission' }).click();
  105 |   await page.evaluate(() => window.__SS__!.pause());
  106 | };
  107 | 
  108 | test.describe('L3 The Police Collapse in the browser', () => {
  109 |   for (const street of ['commerce', 'blvd', 'oak'] as const) test(`T-E21-19 @E21 @E21-AC19 @E21-AC04 @E21-AC20 real-input playthrough: armory, station attack, fallback, ${street} to the army zone; photo spots for the vision review`, async ({ page }) => {
  110 |     test.setTimeout(1_800_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  111 |     await begin(page);
  112 |     const h = helpers(page), { step, mission, player, snap, go, interact, fightNearby } = h;
  113 |     await step(150); await snap('l3-station-yard');
  114 |     expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
  115 |     // The handgun: stand at the armory table and press E; it joins the carried weapons and is selected.
  116 |     await go(at('l3-armory'), .7); await interact();
  117 |     for (let i = 0; i < 10 && !(await mission()).l3!.handgunAt; i++) { await interact(); await step(10); }
  118 |     expect((await mission()).l3!.handgunAt).toBeGreaterThan(0);
  119 |     expect((await player()).weapons!.RIGHT.rack[0].id).toBe('weapon.handgun');
  120 |     expect((await player()).weapons!.selectedSide).toBe('RIGHT');
  121 |     // No ammunition HUD: the handgun card reads "Ready", never "n / m" or a reload ring.
  122 |     await expect(page.getByTestId('stats-RIGHT')).toHaveText('Ready');
  123 |     // Hold the yard with the police, shooting what comes through the gates.
  124 |     await go({ x: -134.5, z: 1.5 }, 1.2);
  125 |     for (let i = 0; i < 80 && !(await mission()).l3!.attackAt; i++) await step(20);
  126 |     expect((await mission()).l3!.attackAt).toBeGreaterThan(0);
  127 |     let attackShot = false;
  128 |     for (let i = 0; i < 400 && !(await mission()).l3!.fallbackAt; i++) {
  129 |       if (!await fightNearby(14)) await step(15);
  130 |       // The photo: once the attack is inside the frame (>= 4 infected within 15 m of the photo spot).
  131 |       const inFrame = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 141, e.transform.z + 13) < 15).length);
  132 |       if (!attackShot && inFrame >= 4) { await snap('l3-station-attack'); attackShot = true; }
  133 |     }
  134 |     const inside = await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x + 141, e.transform.z + 13) < 15).length);
  135 |     if (!attackShot) await snap('l3-station-attack');
  136 |     console.log(JSON.stringify({ attackShotEarly: attackShot, inFrameAtFallback: inside }));
  137 |     expect((await mission()).l3!.fallbackAt).toBeGreaterThan(0);
  138 |     await expect(page.getByTestId('stats-RIGHT')).not.toHaveText(/\d+\s*\/\s*\d+|↻/);
  139 |     // Up Commerce Street to the army checkpoint (the squad follows), fighting the few that come close.
  140 |     const sz = l3.map.streets[street], route: P[] = [{ x: -126, z: 0 }];
  141 |     if (sz !== 0) route.push({ x: -120, z: sz });
  142 |     for (let x = -105; x <= 105; x += 15) {
  143 |       // Oak's crashed pickup blocks the straight centre-line approach from the west.
  144 |       // Stay on the clear north side until past the entire wreck before returning to the centre line.
  145 |       if (street === 'oak' && x === 105) route.push({ x: 92, z: 24 }, { x: 105, z: 24 }, { x: 118, z: 24 });
  146 |       else route.push({ x, z: sz });
  147 |     }
  148 |     if (sz !== 0) route.push({ x: 128, z: sz });   // On-ramp Road is the full cross street at the corridor's end
  149 |     route.push({ x: 129, z: 0 }, { x: l3.map.zoneX + 5, z: 0 }); // The 4 m arrival ring stays inside the zone.
  150 |     // Crossing the zone line ends L3 and the campaign hands over to L4: keep the last L3 state, stop touching the world then.
  151 |     const inL3 = () => page.evaluate(() => window.__SS__!.getState().scenario === 'L3' && window.__SS__!.missions.state()?.phase === 'playing');
  152 |     let last = await mission();
  153 |     for (const wp of route) {
  154 |       // Reach the wreck detour before cutting back, and finish the final click inside the army zone.
  155 |       const stop = wp.x > l3.map.zoneX || (street === 'oak' && wp.z === 24) ? 1.2 : sz === 0 ? 2 : 4;
  156 |       await go(wp, stop, async () => { if (!await inL3()) return true; last = await mission(); return false; }, 9);
  157 |       if (!await inL3()) break;
  158 |       const m = await mission(), p = (await player()).transform;
  159 |       if (!h.shots.has('l3-squad-strong') && p.x > -100 && p.x < -80) await snap('l3-squad-strong');
  160 |       if (!h.shots.has('l3-commerce-street') && p.x > 5) { await snap('l3-commerce-street'); await snap('l3-oak-avenue'); await snap('l3-grove-boulevard'); }
  161 |       if (!h.shots.has('l3-alone') && (p.x > 112 || (p.x > 90 && m.l3!.squad.length <= 1))) await snap('l3-alone');
  162 |       if (!h.shots.has('l3-army-checkpoint') && p.x > 126) await snap('l3-army-checkpoint');
  163 |     }
  164 |     for (const name of ['l3-squad-strong', 'l3-alone', 'l3-army-checkpoint']) if (!h.shots.has(name) && await inL3()) await snap(name);
  165 |     for (let i = 0; i < 60 && await inL3(); i++) { last = await mission(); await step(15); }
  166 |     // A hand-over in flight: wait for L4 to finish loading.
  167 |     await page.waitForFunction(() => { const a = window.__SS__!; return a.getState().scenario === 'L4' || !!a.missions.state()?.l3; }, undefined, { timeout: 120_000 });
  168 |     const scenario = await page.evaluate(() => window.__SS__!.getState().scenario), now = await mission();
  169 |     // Still on L3 with its state (result screen) or already handing over / on L4 (the L3 state is gone: use the last one seen).
  170 |     const handedOver = scenario !== 'L3' || !now?.l3;
  171 |     const final = !handedOver ? now : { ...last, phase: 'progression' as const, l3: { ...last.l3!, crossedAt: last.l3!.crossedAt || (scenario === 'L4' ? 1 : 0) } };
  172 |     writeFileSync(`${output}/browser-real-input-${street}.json`, JSON.stringify({ phase: final.phase, stats: final.stats, street, scenario, player: (await player()).transform, l3: { crossedAt: final.l3!.crossedAt, barrierClosedAt: final.l3!.barrierClosedAt, fallbackCause: final.l3!.fallbackCause, squadLost: final.l3!.lost, squad: final.l3!.squad.length }, shots: [...h.shots] }, null, 2) + '\n');
  173 |     console.log(`L3 RESULT street=${street} deaths=${final.stats.deaths}`);
  174 |     expect(['result', 'progression']).toContain(final.phase);
  175 |     expect(final.l3!.crossedAt).toBeGreaterThan(0);
  176 |     expect([...h.shots].sort()).toEqual(['l3-alone', 'l3-army-checkpoint', 'l3-commerce-street', 'l3-grove-boulevard', 'l3-oak-avenue', 'l3-squad-strong', 'l3-station-attack', 'l3-station-yard']);
  177 |   });
  178 | 
  179 |   test('T-E21-17b @E21 @E21-AC17 campaign: crossing the army zone line loads L4 with the carried loadout and no reward screen', async ({ page }) => {
  180 |     test.setTimeout(600_000); page.setDefaultTimeout(120_000);
  181 |     await begin(page);
  182 |     for (let i = 0; i < 8; i++) {
  183 |       const m = await page.evaluate(() => window.__SS__!.missions.state());
  184 |       if (!m || m.phase !== 'playing' || (await page.evaluate(() => window.__SS__!.getState().scenario)) !== 'L3') break;
  185 |       await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  186 |       if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L3')) await page.evaluate(() => window.__SS__!.step(2));
  187 |     }
  188 |     await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
  189 |     expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L4');
  190 |     await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
  191 |     const save = await page.evaluate(() => window.__SS__!.campaign.state());
  192 |     expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun']));
  193 |     expect(save!.unlockedLevel).toBe(4);
  194 |     expect(l3.map.zoneX).toBeGreaterThan(0);
  195 |   });
```