# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L2.spec.ts >> L2 The Failed Rescue in the browser >> T-E20-18 @E20 @E20-AC18 @E20-AC16 @E20-AC19 real-input playthrough from the station to the closing gate, photo spots for the vision review
- Location: tests/e2e/levels/L2.spec.ts:63:3

# Error details

```
Error: Could not travel to {"x":20,"z":48} from {"x":-46.467071533203125,"y":0.7049999833106995,"z":-37.93520736694336,"yaw":2.3198236284882405}
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
            - generic: 11 / 100
          - meter "armor":
            - generic: Armor 0%
      - generic: Corgi · following
      - generic "North-up minimap, range 30 meters":
        - generic: "N"
        - generic: ▲
        - generic: ⌂
      - generic: Reach the police checkpoint at the bridge · 143 m
      - generic:
        - button "LEFT selected" [active] [ref=e5] [cursor=pointer]:
          - generic [ref=e6]: ACTIVE · LMB
          - generic [ref=e7]: 0.0s
          - generic [ref=e8]: bat
          - generic [ref=e9]: "0.0"
        - button "RIGHT" [ref=e13] [cursor=pointer]:
          - generic [ref=e14]: RMB · NEXT
          - generic [ref=e15]: RMB to equip
          - generic [ref=e16]: unarmed
      - status: ☀ Clear
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
  1   | import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import type { Page } from '@playwright/test';
  3   | import { test, expect, boot, testUrl } from '../fixtures';
  4   | import { menuStart } from '../ui-helpers';
  5   | import { l2Anchors } from '../../../src/data/l2';
  6   | import { l2Routes } from '../../../src/debug/bot/LevelTwoBot';
  7   | 
  8   | /** E20 L2 browser runs. Browser runs only through tools/e2e-lock.sh, headless. */
  9   | const output = 'test-results/epics/E20';
  10  | test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
  11  | const at = (name: string) => ({ x: l2Anchors[name][0], z: l2Anchors[name][1] });
  12  | type P = { x: number; z: number };
  13  | 
  14  | function helpers(page: Page) {
  15  |   const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  16  |   const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  17  |   const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  18  |   const shots = new Set<string>();
  19  |   const snap = async (name: string) => {
  20  |     await page.evaluate(n => window.__SS__!.camera.preset(`D-GROVE/W1/${n}`), name);
  21  |     await page.evaluate(() => window.__SS__!.screenshotReady());
  22  |     await page.screenshot({ path: `${output}/${name}.png` }); shots.add(name);
  23  |     await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  24  |   };
  25  |   /** Shift + click: stand and strike the nearest infected under the cursor. */
  26  |   const fightNearby = async (): Promise<boolean> => {
  27  |     const target = await page.evaluate(() => {
  28  |       const a = window.__SS__!, p = a.getState().player!.transform;
  29  |       const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
  30  |       return near ? a.input.project(near.transform) : null;
  31  |     });
  32  |     if (!target) return false;
  33  |     await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(20); await page.mouse.up(); await page.keyboard.up('Shift');
  34  |     return true;
  35  |   };
  36  |   /** Click the actual destination (camera framed for the click only); re-click after fights and respawns. */
  37  |   const go = async (target: P, stop = 1.2, done?: () => Promise<boolean>) => {
  38  |     const click = async () => {
  39  |       const start = (await player()).transform;
  40  |       await page.evaluate(({ start, target }) => {
  41  |         const a = window.__SS__!, x = (start.x + target.x) / 2, z = (start.z + target.z) / 2, r = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
  42  |         a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
  43  |       }, { start, target });
  44  |       const point = await page.evaluate(q => window.__SS__!.input.project(q), target);
  45  |       await page.mouse.click(point.x, point.y);
  46  |       await page.evaluate(() => window.__SS__!.camera.follow());
  47  |     };
  48  |     await click();
  49  |     for (let i = 0; i < 600; i++) {
  50  |       await step(20);
  51  |       const p = (await player()).transform;
  52  |       if (Math.hypot(target.x - p.x, target.z - p.z) <= stop || (done && await done())) return;
  53  |       if ((await player()).health.current > 0 && await fightNearby()) await click();
  54  |       else if (i % 10 === 9) await click();
  55  |     }
> 56  |     throw new Error(`Could not travel to ${JSON.stringify(target)} from ${JSON.stringify((await player()).transform)}`);
      |           ^ Error: Could not travel to {"x":20,"z":48} from {"x":-46.467071533203125,"y":0.7049999833106995,"z":-37.93520736694336,"yaw":2.3198236284882405}
  57  |   };
  58  |   const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(2); };
  59  |   return { step, mission, player, snap, shots, go, fightNearby, interact };
  60  | }
  61  | 
  62  | test.describe('L2 The Failed Rescue in the browser', () => {
  63  |   test('T-E20-18 @E20 @E20-AC18 @E20-AC16 @E20-AC19 real-input playthrough from the station to the closing gate, photo spots for the vision review', async ({ page }) => {
  64  |     test.setTimeout(1_500_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  65  |     await boot(page, `${testUrl}&ui=1`);
  66  |     await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
  67  |     await page.evaluate(() => window.__SS__!.pause());
  68  |     await page.getByRole('button', { name: 'Begin mission' }).click();
  69  |     await page.evaluate(() => window.__SS__!.pause());
  70  |     const h = helpers(page), { step, mission, player, snap, go, interact } = h;
  71  |     await step(150); await snap('l2-station-calm');
  72  |     expect((await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }))).length).toBe(0);
  73  |     for (let i = 0; i < 80 && (await mission()).l2!.phase === 'calm'; i++) await step(30);
  74  |     await step(30); await snap('l2-alarm');
  75  |     // Optional axe: walk to the wall rack and press E.
  76  |     await go(at('l2-axe-rack'), .8); await interact();
  77  |     for (let i = 0; i < 10 && !(await mission()).l2!.axe; i++) { await interact(); await step(10); }
  78  |     expect((await mission()).l2!.axe).toBe(true);
  79  |     expect((await player()).weapons!.LEFT.rack.map(r => r.id)).toContain('weapon.fire-axe');
  80  |     // Board at the crew door by interaction.
  81  |     await go(at('l2-board'), .6); await interact();
  82  |     for (let i = 0; i < 20 && !(await mission()).l2!.seated; i++) { await interact(); await step(10); }
  83  |     expect((await mission()).l2!.seated).toBe(true);
  84  |     for (let i = 0; i < 200; i++) {
  85  |       const truck = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state()!.l2!; return a.getState().entities.find(e => e.id === s.truckId)!.transform; });
  86  |       if (truck.x > -32 && truck.z < 6) break; await step(10);
  87  |     }
  88  |     await snap('l2-truck-ride');
  89  |     for (let i = 0; i < 100 && !(await mission()).l2!.arrivedAt; i++) await step(15);
  90  |     expect((await player()).hidden).toBeFalsy();
  91  |     // Main Row before the doors open: the same game camera as the L1 pickup spot, W1 damage without the crowd.
  92  |     await snap('l2-streets-w1');
  93  |     await go(at('l2-forecourt'), 1.5, async () => (await mission()).l2!.doorsOpenAt > 0);
  94  |     for (let i = 0; i < 1200 && !(await mission()).l2!.doorsOpenAt; i++) await step(1);
  95  |     await snap('l2-doors-open'); await step(300);
  96  |     await page.evaluate(n => window.__SS__!.camera.preset(`D-GROVE/W1/${n}`), 'l2-doors-open'); await page.evaluate(() => window.__SS__!.screenshotReady());
  97  |     await page.screenshot({ path: `${output}/l2-doors-open-5s.png` }); await page.evaluate(() => window.__SS__!.camera.follow());
  98  |     // Fight a little at the doors, then break away.
  99  |     for (let i = 0; i < 8; i++) { if (!await h.fightNearby()) await step(20); }
  100 |     await snap('l2-collapse');
  101 |     // The escape horde really hunts (zombie-ai). No god mode: the checkpoints wait for a calm moment and a death loop thins the street population
  102 |     // (l2.mercy), so even this naive straight-line courier finishes the route (PO 10-09).
  103 |     const route = l2Routes.side;
  104 |     for (const wp of route) {
  105 |       await go(wp, 1.8, async () => { const m = await mission(); return m.phase !== 'playing' || m.l2!.gateClosedAt > 0; });
  106 |       const m = await mission();
  107 |       if (m.l2!.clusterReached && !h.shots.has('l2-cluster')) await snap('l2-cluster');
  108 |       if (m.phase !== 'playing' || m.l2!.gateClosedAt) break;
  109 |     }
  110 |     if (!h.shots.has('l2-cluster')) await snap('l2-cluster');
  111 |     for (let i = 0; i < 40 && !(await mission()).l2!.gateClosedAt; i++) await step(15);
  112 |     expect((await mission()).l2!.gateClosedAt).toBeGreaterThan(0);
  113 |     const checkpoint = await mission();
  114 |     await step(20); await snap('l2-bridge-checkpoint');
  115 |     for (let i = 0; i < 40 && (await mission()).phase === 'playing'; i++) await step(15);
  116 |     // The campaign hands over immediately; retain L2 evidence before its state is replaced by L3.
  117 |     await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
  118 |     expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L3');
  119 |     const final = await mission();
  120 |     writeFileSync(`${output}/browser-real-input.json`, JSON.stringify({ phase: final.phase, scenario: 'L3', stats: checkpoint.stats, l2: { axe: checkpoint.l2!.axe, deaths: checkpoint.stats.deaths }, shots: [...h.shots] }, null, 2) + '\n');
  121 |     expect(await page.evaluate(() => window.__SS__!.campaign.state()!.ownedActions)).toContain('weapon.fire-axe');
  122 |     expect([...h.shots].sort()).toEqual(['l2-alarm', 'l2-bridge-checkpoint', 'l2-cluster', 'l2-collapse', 'l2-doors-open', 'l2-station-calm', 'l2-streets-w1', 'l2-truck-ride']);
  123 |   });
  124 | 
  125 |   test('T-E20-14b @E20 @E20-AC14 campaign: the gate closes, no reward screen, L3 loads with the carried loadout', async ({ page }) => {
  126 |     test.setTimeout(600_000); page.setDefaultTimeout(120_000);
  127 |     await menuStart(page);
  128 |     await page.evaluate(() => window.__SS__!.pause());
  129 |     for (let i = 0; i < 12 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) === 'playing'; i++) await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  130 |     for (let i = 0; i < 40 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) !== 'result'; i++) await page.evaluate(() => window.__SS__!.step(30));
  131 |     await page.getByRole('button', { name: 'Continue', exact: true }).click();
  132 |     await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
  133 |     expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
  134 |     await page.getByRole('button', { name: 'Begin mission' }).click();
  135 |     await page.evaluate(() => window.__SS__!.pause());
  136 |     // Walk the L2 graph with the objective cheat, taking the optional axe on the way.
  137 |     for (let i = 0; i < 16; i++) {
  138 |       const m = await page.evaluate(() => window.__SS__!.missions.state()!);
  139 |       if (m.phase !== 'playing') break;
  140 |       const active = Object.entries(m.steps).filter(([, s]) => s.status === 'active').map(([id]) => id);
  141 |       await page.evaluate(id => window.__SS__!.cheats.completeObjective(id), active.includes('axe') ? 'axe' : undefined);
  142 |       // Completing the bridge objective hands over to L3 at once (its load resets the clock), so only step while L2 plays.
  143 |       if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'playing' && window.__SS__!.getState().scenario === 'L2')) await page.evaluate(() => window.__SS__!.step(2));
  144 |     }
  145 |     await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 120_000 });
  146 |     expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L3');
  147 |     await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal|Level complete/);
  148 |     const save = await page.evaluate(() => window.__SS__!.campaign.state());
  149 |     expect(save!.ownedActions).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe']));
  150 |     expect(save!.unlockedLevel).toBe(3);
  151 |   });
  152 | });
  153 | 
```