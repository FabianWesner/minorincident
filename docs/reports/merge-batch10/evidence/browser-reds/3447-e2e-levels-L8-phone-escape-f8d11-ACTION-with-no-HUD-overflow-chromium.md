# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L8.spec.ts >> phone escape input >> T-E30-18-mobile @E30-AC18 touch stick reaches the APC ACTION with no HUD overflow
- Location: tests/e2e/levels/L8.spec.ts:114:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 120000ms exceeded.
```

# Page snapshot

```yaml
- generic [active]:
  - generic:
    - generic:
      - text: N ▲
      - generic "Objective direction": ➜
    - button "Pause" [ref=e2] [cursor=pointer]: Ⅱ
    - button "Home" [ref=e3] [cursor=pointer]
    - generic:
      - generic "Vehicle durability":
        - meter "durability":
          - generic: Armor 0 / 1000
      - generic:
        - generic "Survivor portrait"
        - generic:
          - meter "health":
            - generic: 100 / 100
        - generic "Corgi · hiding": 🐕
      - button "North-up minimap, range 30 meters" [expanded] [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: "N"
        - generic [ref=e8]: ▲
      - button "Bring the survivors to the armored vehicle and board · 5 m" [ref=e15] [cursor=pointer]
      - status: ☀ Clear
  - generic:
    - button "Touch left" [ref=e17] [cursor=pointer]:
      - generic: BOOST
    - button "Touch right" [ref=e18] [cursor=pointer]:
      - generic: DRIFT
    - button "ACTION" [ref=e19] [cursor=pointer]
```

# Test source

```ts
  40  |   const breachTick = calmClock.start + 3600;
  41  |   expect(breachTick).toBe(3600); expect(calmClock.tick).toBeLessThan(breachTick - 1);
  42  |   await step(breachTick - 1 - calmClock.tick);
  43  |   expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBe(breachTick - 1);
  44  |   expect(await page.evaluate(() => window.__SS__!.getState().l8!.breachedAt)).toBe(0);
  45  |   await step(1); const breach = await page.evaluate(() => window.__SS__!.getState().l8!);
  46  |   expect(breach.breachedAt).toBe(3600); expect(new Set(breach.arrivals.map(a => a.outlet)).size).toBe(4);
  47  |   // Physical key movement is computed from the same isometric axes as other real-input campaign gates.
  48  |   for (let i = 0; i < 1500; i++) {
  49  |     const obs = await page.evaluate(() => {
  50  |       const a = window.__SS__!, state = a.getState(), p = state.player!.transform;
  51  |       if (state.scenario !== 'L8') return null;
  52  |       const car = a.getEntity(state.l8!.carId)!, yaw = car.transform.yaw, def = { doorX: .71, width: 2.95 };
  53  |       const door = { x: car.transform.x + Math.cos(yaw) * def.doorX + Math.sin(yaw) * (def.width / 2 + .55), z: car.transform.z - Math.sin(yaw) * def.doorX + Math.cos(yaw) * (def.width / 2 + .55) };
  54  |       const friends = state.l8!.roster.map(id => a.getEntity(id)!).filter(e => e.health.current > 0 && !e.infected && e.passengerOf === undefined);
  55  |       const enemy = a.query({}).filter(e => e.infected && !e.hidden && !e.emerging && e.health.current > 0 && a.input.visible(e.transform) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 15).sort((a,b) => Math.hypot(a.transform.x - p.x,a.transform.z - p.z) - Math.hypot(b.transform.x - p.x,b.transform.z - p.z))[0];
  56  |       return { p, door, car: car.transform, carHP: car.health.current, hp: state.player!.health.current, phase: a.missions.state()!.phase, weapons: state.player!.weapons, tick: state.tick, active: car.vehicle!.driver === 1, friends: friends.map(e => e.transform), enemy: enemy?.transform };
  57  |     });
  58  |     if (!obs) break;
  59  |     if (i % 100 === 0) writeFileSync(`${out}/real-progress.json`, JSON.stringify(obs, null, 2));
  60  |     if (obs.enemy) {
  61  |       const ndc = await page.evaluate(at => window.__SS__!.camera.project(at.x, at.y, at.z), obs.enemy), view = page.viewportSize()!;
  62  |       await page.mouse.move((ndc[0] + 1) * view.width / 2, (1 - ndc[1]) * view.height / 2);
  63  |       await page.keyboard.down('Shift'); await page.keyboard.press('2'); await page.keyboard.up('Shift'); await step(1);
  64  |       await page.mouse.down(); await step(20); await page.mouse.up(); continue;
  65  |     }
  66  |     if (obs.active || (Math.hypot(obs.p.x - obs.door.x, obs.p.z - obs.door.z) > 10 && obs.friends.some(p => Math.hypot(p.x - obs.p.x, p.z - obs.p.z) > 12))) { await step(12); continue; }
  67  |     const target = Math.hypot(obs.p.x - obs.door.x, obs.p.z - obs.door.z) < 10 && obs.p.z < obs.door.z - .5 ? { x: obs.p.x, z: obs.door.z + 1 } : obs.door;
  68  |     const dx = target.x - obs.p.x, dz = target.z - obs.p.z;
  69  |     if (Math.hypot(obs.door.x - obs.p.x, obs.door.z - obs.p.z) < .6) { await shot('real-escape'); await page.keyboard.press('e'); await step(12); continue; }
  70  |     const keys = Math.abs(dx) > Math.abs(dz) ? dx > 0 ? ['s','d'] : ['w','a'] : dz > 0 ? ['s','a'] : ['w','d'];
  71  |     for (const key of keys) await page.keyboard.down(key);
  72  |     await step(Math.min(12, Math.max(2, Math.floor(Math.max(Math.abs(dx), Math.abs(dz)) * 10))));
  73  |     for (const key of keys) await page.keyboard.up(key);
  74  |   }
  75  |   await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L9', undefined, { timeout: 120_000 });
  76  |   await page.evaluate(() => window.__SS__!.pause());
  77  |   const destination = await page.evaluate(() => window.__SS__!.getState());
  78  |   expect(destination.entities.find(e => e.id === breach.carId)!.vehicle!.driver).toBe(1);
  79  |   expect(destination.progression!.campaign!.results!.L8.rescued).toBeGreaterThanOrEqual(8);
  80  |   const carriedCorgi = destination.entities.find(e => e.id === initialCorgi!.id)!;
  81  |   expect(carriedCorgi, 'the same protected dog arrives aboard the crossing APC').toBeDefined();
  82  |   expect(carriedCorgi.companion).toBeDefined(); expect(carriedCorgi.passengerOf).toBe(breach.carId);
  83  |   expect(carriedCorgi.health.current).toBe(carriedCorgi.health.max);
  84  |   expect(carriedCorgi.infected).toBeUndefined(); expect(carriedCorgi.infection).toBeUndefined();
  85  |   writeFileSync(`${out}/real-input.json`, JSON.stringify(destination, null, 2)); await shot('real-l9-arrival');
  86  | });
  87  | 
  88  | test('T-E30-19 @E30-AC19 game camera calm, internal breach and same-id animal turn captures', async ({ page }) => {
  89  |   test.setTimeout(600_000); mkdirSync(out, { recursive: true }); await boot(page);
  90  |   await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.cheats.god(true); a.missions.begin(); });
  91  |   const capture = async (name: string, pos: { x: number; z: number }) => {
  92  |     await page.evaluate(async pos => { const a = window.__SS__!; a.teleport(1, pos); await a.step(1); a.camera.cinematic({ position: [pos.x + 19, 23, pos.z + 19], target: [pos.x, .5, pos.z] }, true); await a.screenshotReady(); }, pos);
  93  |     await page.screenshot({ path: `${out}/${name}.png` });
  94  |   };
  95  |   await capture('calm', { x: -60, z: -20 });
  96  |   const animals = await page.evaluate(() => window.__SS__!.getState().l8!.animals);
  97  |   await page.evaluate(() => window.__SS__!.step(3635)); await capture('breach', { x: -99, z: 32 }); await page.evaluate(() => window.__SS__!.teleport(1, { x: 0, z: 70 }));
  98  |   let converting = 0;
  99  |   for (let i = 0; i < 300; i++) {
  100 |     const state = await page.evaluate(ids => ids.map(id => window.__SS__!.getEntity(id)!), animals);
  101 |     const animal = state.find(e => e.infection);
  102 |     if (animal) { converting = animal.id; await capture('animal-turning', animal.transform); writeFileSync(`${out}/animal-turning.json`, JSON.stringify(animal, null, 2)); break; }
  103 |     await page.evaluate(() => window.__SS__!.step(30));
  104 |   }
  105 |   expect(converting).toBeGreaterThan(0);
  106 |   await page.evaluate(() => window.__SS__!.step(240));
  107 |   const infected = await page.evaluate(id => window.__SS__!.getEntity(id)!, converting);
  108 |   expect(infected.infected).toBeTruthy(); await capture('animal-infected', infected.transform);
  109 |   writeFileSync(`${out}/animal-infected.json`, JSON.stringify(infected, null, 2));
  110 | });
  111 | 
  112 | test.describe('phone escape input', () => {
  113 |   test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  114 |   test('T-E30-18-mobile @E30-AC18 touch stick reaches the APC ACTION with no HUD overflow', async ({ page, context }) => {
  115 |     test.setTimeout(600_000); await boot(page, '/?test=1&renderer=webgl&dpr=1&quality=low&audio=muted&ui=1');
  116 |     await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 1, progression: 'L8-default' }); a.pause(); a.missions.begin(); await a.step(3600); });
  117 |     const cdp = await context.newCDPSession(page);
  118 |     for (let i = 0; i < 300; i++) {
  119 |       const obs = await page.evaluate(() => {
  120 |         const a = window.__SS__!, state = a.getState(); if (state.scenario !== 'L8') return null;
  121 |         const p = state.player!.transform, car = a.getEntity(state.l8!.carId)!, yaw = car.transform.yaw;
  122 |         const door = { x: car.transform.x + Math.cos(yaw) * .71 + Math.sin(yaw) * 2.025, z: car.transform.z - Math.sin(yaw) * .71 + Math.cos(yaw) * 2.025 };
  123 |         const dx = door.x - p.x, dz = door.z - p.z, distance = Math.hypot(dx, dz), next = distance > 1 ? { x: p.x + dx / distance * 3, z: p.z + dz / distance * 3 } : door;
  124 |         const origin = a.input.project(p), target = a.input.project(next);
  125 |         return { distance, screen: { x: target.x - origin.x, y: target.y - origin.y }, active: car.vehicle!.driver === 1 };
  126 |       });
  127 |       if (!obs) break;
  128 |       if (obs.active) { await stepZoo(page, 60); continue; }
  129 |       if (obs.distance < .6) {
  130 |         await page.touchscreen.tap(100, 350); await stepZoo(page, 1);
  131 |         await expect(page.getByTestId('touch-interact')).toBeEnabled(); await page.getByTestId('touch-interact').tap();
  132 |         await stepZoo(page, 60); continue;
  133 |       }
  134 |       const length = Math.hypot(obs.screen.x, obs.screen.y) || 1;
  135 |       await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 450, id: 1 }] });
  136 |       await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80 + obs.screen.x / length * 60, y: 450 + obs.screen.y / length * 60, id: 1 }] });
  137 |       await stepZoo(page, Math.min(30, Math.max(2, Math.floor(obs.distance * 8))));
  138 |       await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  139 |     }
> 140 |     await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L9', undefined, { timeout: 120_000 });
      |                ^ TimeoutError: page.waitForFunction: Timeout 120000ms exceeded.
  141 |     expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  142 |     mkdirSync(out, { recursive: true }); await page.screenshot({ path: `${out}/touch-l9-arrival.png` });
  143 |   });
  144 | });
  145 | 
```