# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L1.spec.ts >> L1 v2 real-input playthrough >> T-E19-22 @E19 @E19-AC22 @E19-AC15 unassisted real-input bicycle playthrough from title to result
- Location: tests/e2e/levels/L1.spec.ts:43:41

# Error details

```
Error: Could not travel to {"x":40.029999999999994,"z":-40.65}; infected within 4 m [] from {"x":14.240351676940918,"y":0.7200000286102295,"z":-15.393906593322754,"yaw":1.3214711255882485}; bicycle=[{"kind":"bicycle","archetype":"veh.courier-bike","faction":"environment","transform":{"x":66.43455867750436,"y":0.05,"z":-8.270882815473344,"yaw":1.4478806807565299},"health":{"current":1,"max":1},"bicycle":{"mounted":false,"heading":-1.4478806807565299,"speed":0,"pedal":218.26463954232418,"steer":0,"lean":0,"standTicks":0,"armed":true,"lockUntil":2259},"id":85}]; lastPick=[] 
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
      - generic: Go into the fire station · 36 m
      - generic:
        - button "LEFT selected" [ref=e5] [cursor=pointer]:
          - generic [ref=e6]: ACTIVE · LMB
          - generic [ref=e7]: 0.0s
          - generic [ref=e8]: bat
          - generic [ref=e9]: ✓
        - button "RIGHT" [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: RMB · NEXT
          - generic [ref=e14]: RMB to equip
          - generic [ref=e15]: unarmed
      - status: ☀ Clear
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
  17  | const openGround = (p: { x: number; z: number }) => !screens.some(q => cameraSide(p, q.position[0], q.position[2]) && Math.hypot(q.position[0] - p.x, q.position[2] - p.z) < (/tree/.test(q.assetId) ? 3 : /lamp|sign/.test(q.assetId) ? 1.8 : 2.6))
  18  |   && !layout.colliders.some(c => { const q = closest(p, c); return cameraSide(p, q.x, q.z) && Math.hypot(q.x - p.x, q.z - p.z) < 2.2; });
  19  | const goals: Record<string, string> = { pickup: 'parcel-counter', deliver: 'lab-door', escape: 'garage-door', weapon: 'garage-bat', firestation: 'fire-bay-trigger' };
  20  | const caption = 'Delivery complete. Outbreak: not contained.';
  21  | test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
  22  | 
  23  | test.describe('L1 v2 real-input playthrough', () => {
  24  | 
  25  |   test('T-E19-unlock @E19 result screen, real click on Continue: straight to the next level, no upgrade/rack screens (PO decision 2026-10-07)', async ({ page }) => {
  26  |     test.setTimeout(300_000); page.setDefaultTimeout(90_000);
  27  |     await menuStart(page);
  28  |     await page.evaluate(() => window.__SS__!.pause());
  29  |     for (let i = 0; i < 12; i++) {
  30  |       const phase = await page.evaluate(() => window.__SS__!.missions.state()!.phase);
  31  |       if (phase === 'cinematic' || phase === 'result') break;
  32  |       await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  33  |     }
  34  |     for (let i = 0; i < 40 && (await page.evaluate(() => window.__SS__!.missions.state()!.phase)) !== 'result'; i++) await page.evaluate(() => window.__SS__!.step(30));
  35  |     await page.getByRole('button', { name: 'Continue', exact: true }).click();
  36  |     await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible({ timeout: 90_000 });
  37  |     expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L2');
  38  |     await expect(page.locator('body')).not.toContainText(/Choose upgrades|Set up racks|Pick 2 of 3|Unlock reveal/);
  39  |     const save = await page.evaluate(() => window.__SS__!.campaign.state());
  40  |     expect(save!.ownedActions).toContain('weapon.bat'); expect(save!.upgrades).toHaveLength(2);
  41  |   });
  42  | 
  43  |   for (const assisted of [false, true]) test(assisted
  44  |     ? 'T-E19-23 @E19 @E19-AC23 assisted visual capture: 9 photo spots for vision review'
  45  |     : 'T-E19-22 @E19 @E19-AC22 @E19-AC15 unassisted real-input bicycle playthrough from title to result', async ({ page }) => {
  46  |     test.setTimeout(900_000); page.setDefaultTimeout(60_000); mkdirSync(output, { recursive: true }); // local headless preview needs ~19 s from Begin mission to the playable L1
  47  |     await menuStart(page);
  48  |     await page.evaluate(() => window.__SS__!.pause());
  49  |     if (assisted) await page.evaluate(() => window.__SS__!.cheats.god(true));
  50  |     const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  51  |     const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  52  |     const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  53  |     /** `zoom` frames the focus with the game follow camera itself (its angle, at a zoom the player can pick). */
  54  |     const snap = async (name: string, focus?: { x: number; z: number }, reverse = false, zoom?: number) => {
  55  |       if (!assisted) return;
  56  |       if (name === 'l1-accident') await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__SS__!.vfx.stepRender(1); });
  57  |       await page.evaluate(n => window.__SS__!.camera.preset('D-GROVE/W0/' + n), name);
  58  |       if (focus && zoom) await page.evaluate(({ p, o }) => window.__SS__!.camera.cinematic({ position: [p.x + o[0], o[1], p.z + o[2]], target: [p.x, 0, p.z] }, true), { p: focus, o: gameOffset.map(v => v * zoom) });
  59  |       else if (focus) await page.evaluate(({ p, reverse }) => {
  60  |         const a = window.__SS__!, offset = 22;
  61  |         a.camera.cinematic({ position: [p.x + (reverse ? -offset : offset), 26, p.z + (reverse ? -offset : offset)], target: [p.x, 0, p.z] }, true);
  62  |       }, { p: focus, reverse });
  63  |       await page.evaluate(() => window.__SS__!.screenshotReady());
  64  |       await page.screenshot({ path: `${output}/${name}.png` }); await page.evaluate(() => window.__SS__!.camera.follow()); await step(1);
  65  |     };
  66  |     const waitBeat = async () => {
  67  |       for (let i = 0; i < 120 && (await mission()).l1!.beat; i++) await step(30);
  68  |     };
  69  |     /** Click the actual destination; reissue it after combat or respawn clears the movement target. */
  70  |     const go = async (target: { x: number; z: number }, stop = 1.2) => {
  71  |       await waitBeat();
  72  |       const activeBefore = Object.entries((await mission()).steps).find(([, s]) => s.status === 'active')?.[0];
  73  |       const start = (await player()).transform;
  74  |       if (Math.hypot(target.x - start.x, target.z - start.z) <= stop) return;
  75  |       let groundStart = 0;
  76  |       const clickDestination = async () => {
  77  |         const start = (await player()).transform;
  78  |         // Frame both ends for a real ground click. This changes presentation only; routing remains the game's own.
  79  |         await page.evaluate(({ start, target }) => {
  80  |           const a = window.__SS__!, x = (start.x + target.x) / 2, z = (start.z + target.z) / 2;
  81  |           const radius = Math.max(22, Math.hypot(target.x - start.x, target.z - start.z) + 12);
  82  |           a.camera.preset('D-GROVE/W0/l1-morning');
  83  |           a.camera.cinematic({ position: [x + radius, radius * 1.2, z + radius], target: [x, 0, z] }, true);
  84  |         }, { start, target });
  85  |         // A body over the waypoint turns a movement click into an attack. Try clear
  86  |         // ground within the same arrival tolerance, consuming each click under its camera.
  87  |         // Settle the new camera before projecting, as in L5.
  88  |         await step(1);
  89  |         const ground = [target, ...Array.from({ length: 16 }, (_, i) => ({
  90  |           x: target.x + Math.cos(i * Math.PI / 8) * stop * .8,
  91  |           z: target.z + Math.sin(i * Math.PI / 8) * stop * .8,
  92  |         }))];
  93  |         for (let j = 0; j < ground.length; j++) {
  94  |           const q = ground[(groundStart + j) % ground.length];
  95  |           // RayCursor uses the courier's floor even when the destination bay is raised.
  96  |           const point = await page.evaluate(q => window.__SS__!.input.project(q, 'player'), q);
  97  |           const view = page.viewportSize()!;
  98  |           expect(point.x).toBeGreaterThan(20); expect(point.x).toBeLessThan(view.width - 20);
  99  |           expect(point.y).toBeGreaterThan(20); expect(point.y).toBeLessThan(view.height - 20);
  100 |           await page.mouse.click(point.x, point.y); await step(1);
  101 |           if (await page.evaluate(() => window.__SS__!.input.lastPick().length === 0)) break;
  102 |         }
  103 |         groundStart = (groundStart + 1) % ground.length;
  104 |         await page.evaluate(() => window.__SS__!.camera.follow());
  105 |       };
  106 |       await clickDestination();
  107 |       for (let i = 0; i < 400; i++) {
  108 |         await step(30);
  109 |         const p = (await player()).transform;
  110 |         const m = await mission();
  111 |         // An objective trigger can stop movement and start a beat before the requested stop radius.
  112 |         if (Math.hypot(target.x - p.x, target.z - p.z) <= stop || m.phase !== 'playing' || (activeBefore && m.steps[activeBefore].status === 'completed')) return;
  113 |         if (!assisted && (await player()).weapons && await fightNearby(page)) await clickDestination();
  114 |         else if (i % 12 === 11) await clickDestination();
  115 |       }
  116 |       const around = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 4).map(e => ({ id: e.id, x: +e.transform.x.toFixed(2), z: +e.transform.z.toFixed(2), hp: e.health.current, state: e.infected?.state, mode: e.infected?.l1?.mode })); });
> 117 |       throw new Error(`Could not travel to ${JSON.stringify(target)}; infected within 4 m ${JSON.stringify(around)} from ${JSON.stringify((await player()).transform)}; bicycle=${JSON.stringify(await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })))}; lastPick=${JSON.stringify(await page.evaluate(() => window.__SS__!.input.lastPick()))} `);
      |             ^ Error: Could not travel to {"x":40.029999999999994,"z":-40.65}; infected within 4 m [] from {"x":14.240351676940918,"y":0.7200000286102295,"z":-15.393906593322754,"yaw":1.3214711255882485}; bicycle=[{"kind":"bicycle","archetype":"veh.courier-bike","faction":"environment","transform":{"x":66.43455867750436,"y":0.05,"z":-8.270882815473344,"yaw":1.4478806807565299},"health":{"current":1,"max":1},"bicycle":{"mounted":false,"heading":-1.4478806807565299,"speed":0,"pedal":218.26463954232418,"steer":0,"lean":0,"standTicks":0,"armed":true,"lockUntil":2259},"id":85}]; lastPick=[] 
  118 |     };
  119 |     const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(1); };
  120 |     /** Like a player, give up on an infected the strikes do not reach (e.g. across the lab fence): no HP lost in 3 tries. */
  121 |     const futile = new Map<number, { hp: number; tries: number }>();
  122 |     const fightNearby = async (page: Page) => {
  123 |       const skip = [...futile].filter(([, f]) => f.tries >= 3).map(([id]) => id);
  124 |       const target = await page.evaluate(skip => {
  125 |         const a = window.__SS__!, p = a.getState().player!.transform;
  126 |         const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !skip.includes(e.id) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
  127 |         return near ? { id: near.id, hp: near.health.current, ...a.input.project(near.transform) } : null;
  128 |       }, skip);
  129 |       if (!target) return false;
  130 |       const seen = futile.get(target.id);
  131 |       futile.set(target.id, { hp: target.hp, tries: seen && seen.hp <= target.hp ? seen.tries + 1 : 0 });
  132 |       // Shift attack-in-place: stand and strike the infected under the cursor.
  133 |       await page.keyboard.down('Shift'); await page.mouse.move(target.x, target.y); await page.mouse.down(); await step(24); await page.mouse.up(); await page.keyboard.up('Shift');
  134 |       return true;
  135 |     };
  136 | 
  137 |     expect((await mission()).l1).toBeDefined();
  138 |     expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons)).toBeUndefined();
  139 |     await snap('l1-morning');
  140 | 
  141 |     const mount = async () => {
  142 |       await waitBeat();
  143 |       const bike = await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })[0]);
  144 |       await go(bike.transform, 1.4);
  145 |       if (!(await player()).riding) await interact();
  146 |       expect((await player()).riding, 'Courier mounts using real input').toBe(bike.id);
  147 |     };
  148 |     if (!assisted) await mount();
  149 | 
  150 |     // Beat 2: the depot counter.
  151 |     await go(at('parcel-counter'), 1.2); await step(70);
  152 |     if (!(await mission()).completedObjectives.includes('pickup')) { await interact(); await step(4); }
  153 |     expect((await mission()).completedObjectives).toContain('pickup');
  154 |     await snap('l1-pickup');
  155 | 
  156 |     // Remount the bike parked at the depot, ride to the forecourt and auto-dismount.
  157 |     if (!assisted) await mount();
  158 |     await go(at('lab-door'), 1.2);
  159 |     expect((await player()).riding).toBeUndefined(); await snap('l1-facility');
  160 |     await interact();
  161 |     for (let i = 0; i < 60 && !(await mission()).l1!.delivered; i++) await step(30);
  162 |     expect((await mission()).l1!.delivered).toBe(true);
  163 |     await expect(page.getByTestId('mission-subtitle')).toHaveText('Delivered ✓');
  164 | 
  165 |     // Beat 5: 4 to 6 s of calm, then the accident.
  166 |     expect((await mission()).l1!.exitIds).toHaveLength(0);
  167 |     for (let i = 0; i < 20 && !(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'l1.smoke'))); i++) await step(30);
  168 |     await step(45); await snap('l1-accident');
  169 |     const order = await page.evaluate(() => window.__SS__!.events().filter(e => e.type.startsWith('l1.')).map(e => e.type));
  170 |     expect(order.slice(0, 5)).toEqual(['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams']);
  171 | 
  172 |     // Beat 6: five infected exit; get away.
  173 |     for (let i = 0; i < 40 && (await mission()).l1!.exitIds.length === 0; i++) await step(30);
  174 |     expect((await mission()).l1!.exitIds).toHaveLength(5);
  175 |     await step(assisted ? 300 : 60); await snap('l1-escape', at('lab-door'));
  176 | 
  177 |     // Beats 7 to 10: follow the objective, fight what blocks the way, interact at the garage, reach the fire station.
  178 |     const shots = new Set<string>(); let guard = 0;
  179 |     if (assisted) {
  180 |       // Follow a systemic victim for the spread photo: its location depends on the AI, not a scripted photo anchor. Prefer the
  181 |       // first bite on open ground (a body behind a fence or hedge is screened from the game camera); else the first one seen.
  182 |       await go(at('garage-door'), 1.5);
  183 |       const turning = () => page.evaluate(() => window.__SS__!.getState().entities.filter(e => e.infection && e.infection.phase !== 'rise').map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z })));
  184 |       let victimId: number | undefined;
  185 |       for (let i = 0; i < 900 && victimId === undefined; i++) {
  186 |         const now = await turning();
  187 |         victimId = (now.find(openGround) ?? (i >= 720 ? now[0] : undefined))?.id;
  188 |         if (victimId === undefined) await step(10);
  189 |       }
  190 |       expect(victimId, 'A systemic pedestrian transformation is available for visual review').toBeDefined();
  191 |       // Observe the same victim (without moving it) until it is rising: glowing eyes, ash skin, its own clothes and hair.
  192 |       const observe = () => page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id), victimId!);
  193 |       let victim = await observe();
  194 |       for (let i = 0; i < 120 && victim?.infection && victim.infection.phase !== 'rise'; i++) { await step(2); victim = await observe(); }
  195 |       expect(victim!.infection?.phase, 'the victim was already risen when observed; widen the search').toBe('rise');
  196 |       await step(18); victim = await observe();
  197 |       expect(victim!.civilian, 'still mid-transformation (rising)').toBeDefined();
  198 |       await snap('l1-spread', victim!.transform, false, .75); shots.add('l1-spread');
  199 |       writeFileSync(`${output}/spread-victim.json`, JSON.stringify({ openGround: openGround(victim!.transform), ...victim }, null, 2) + '\n');
  200 |     }
  201 |     while (guard++ < 400) {
  202 |       const m = await mission();
  203 |       if (m.phase === 'cinematic' || m.phase === 'result') break;
  204 |       const active = Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0];
  205 |       if (!active) { await step(30); continue; }
  206 |       if (!assisted && await fightNearby(page)) continue;
  207 |       if (assisted && active === 'firestation' && !shots.has('l1-horde')) {
  208 |         await waitBeat(); await go(at('photo-l1-horde'), 1.5);
  209 |         // The residents of one house near the garage come out one by one (1.5-4 s apart, ~25 s for all ten) and bite their way up: photograph it arriving on the street (>= 12 within 16 m), not after it
  210 |         // has piled onto the immortal courier. Game camera at the widest zoom the player can choose.
  211 |         const crowd = () => page.evaluate(() => {
  212 |           const a = window.__SS__!, p = a.getState().player!.transform, live = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden);
  213 |           const d = (e: { transform: { x: number; z: number } }) => Math.hypot(e.transform.x - p.x, e.transform.z - p.z);
  214 |           return { within2m: live.filter(e => d(e) < 2).length, within8m: live.filter(e => d(e) < 8).length, within16m: live.filter(e => d(e) < 16).length, within25m: live.filter(e => d(e) < 25).length, live: live.length,
  215 |             bearingsDeg: live.filter(e => d(e) < 25).map(e => Math.round(Math.atan2(e.transform.z - p.z, e.transform.x - p.x) * 180 / Math.PI)) };
  216 |         });
  217 |         // PO rule 2026-10-07: the ten residents come out of one house 1.5-4 s apart (~25 s for all), so give the snowball up to 40 s.
```