# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L1.spec.ts >> L1 v2 real-input playthrough >> T-E19-23 @E19 @E19-AC23 assisted visual capture: 9 photo spots for vision review
- Location: tests/e2e/levels/L1.spec.ts:43:41

# Error details

```
Error: A systemic pedestrian transformation is available for visual review

expect(received).toBeDefined()

Received: undefined
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
      - generic: Find something to defend yourself · 62 m
      - generic:
        - button "LEFT selected" [ref=e5] [cursor=pointer]:
          - generic [ref=e6]: ACTIVE · LMB
          - generic [ref=e7]: 0.0s
          - generic [ref=e8]: unarmed
          - generic [ref=e9]: ✓
        - button "RIGHT" [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: RMB · NEXT
          - generic [ref=e14]: RMB to equip
          - generic [ref=e15]: unarmed
      - generic: ▼
      - status: ☀ Clear
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
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
  113 |         // God mode prevents damage, but living bodies still block the assisted photo route.
  114 |         if ((await player()).weapons && await fightNearby(page, target)) await clickDestination();
  115 |         else if (i % 12 === 11) await clickDestination();
  116 |       }
  117 |       const around = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 4).map(e => ({ id: e.id, x: +e.transform.x.toFixed(2), z: +e.transform.z.toFixed(2), hp: e.health.current, state: e.infected?.state, mode: e.infected?.l1?.mode })); });
  118 |       throw new Error(`Could not travel to ${JSON.stringify(target)}; infected within 4 m ${JSON.stringify(around)} from ${JSON.stringify((await player()).transform)}; bicycle=${JSON.stringify(await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })))} `);
  119 |     };
  120 |     const interact = async () => { await page.keyboard.down('e'); await step(3); await page.keyboard.up('e'); await step(1); };
  121 |     /** Like a player, give up on an infected the strikes do not reach (e.g. across the lab fence): no HP lost in 3 tries. */
  122 |     const futile = new Map<number, { hp: number; tries: number }>();
  123 |     const fightNearby = async (page: Page, goal: { x: number; z: number }) => {
  124 |       const skip = [...futile].filter(([, f]) => f.tries >= 3).map(([id]) => id);
  125 |       const target = await page.evaluate(skip => {
  126 |         const a = window.__SS__!, p = a.getState().player!.transform;
  127 |         const near = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !skip.includes(e.id) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.6).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
  128 |         // Aim on RayCursor's courier floor, including the raised fire-station apron.
  129 |         return near ? { id: near.id, hp: near.health.current, ...a.input.project(near.transform, 'player') } : null;
  130 |       }, skip);
  131 |       if (!target) return false;
  132 |       const seen = futile.get(target.id);
  133 |       futile.set(target.id, { hp: target.hp, tries: seen && seen.hp <= target.hp ? seen.tries + 1 : 0 });
  134 |       await page.mouse.move(target.x, target.y);
  135 |       // WASD + cursor + J: keep moving toward the junction while batting the pursuer.
  136 |       const p = (await player()).transform, dx = goal.x - p.x, dz = goal.z - p.z;
  137 |       const x = dx - dz, y = dx + dz, threshold = Math.max(Math.abs(x), Math.abs(y)) * .4;
  138 |       const keys = [...(Math.abs(x) > threshold ? [x > 0 ? 'd' : 'a'] : []), ...(Math.abs(y) > threshold ? [y > 0 ? 's' : 'w'] : [])];
  139 |       for (const key of keys) await page.keyboard.down(key);
  140 |       await page.keyboard.down('j'); await step(24); await page.keyboard.up('j');
  141 |       for (const key of keys) await page.keyboard.up(key);
  142 |       return true;
  143 |     };
  144 |
  145 |     expect((await mission()).l1).toBeDefined();
  146 |     expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons)).toBeUndefined();
  147 |     await snap('l1-morning');
  148 |
  149 |     const mount = async () => {
  150 |       await waitBeat();
  151 |       const bike = await page.evaluate(() => window.__SS__!.query({ kind: 'bicycle' })[0]);
  152 |       await go(bike.transform, 1.4);
  153 |       if (!(await player()).riding) await interact();
  154 |       expect((await player()).riding, 'Courier mounts using real input').toBe(bike.id);
  155 |     };
  156 |     if (!assisted) await mount();
  157 |
  158 |     // Beat 2: the depot counter.
  159 |     await go(at('parcel-counter'), 1.2); await step(70);
  160 |     if (!(await mission()).completedObjectives.includes('pickup')) { await interact(); await step(4); }
  161 |     expect((await mission()).completedObjectives).toContain('pickup');
  162 |     await snap('l1-pickup');
  163 |
  164 |     // Remount the bike parked at the depot, ride to the forecourt and auto-dismount.
  165 |     if (!assisted) await mount();
  166 |     await go(at('lab-door'), 1.2);
  167 |     expect((await player()).riding).toBeUndefined(); await snap('l1-facility');
  168 |     await interact();
  169 |     for (let i = 0; i < 60 && !(await mission()).l1!.delivered; i++) await step(30);
  170 |     expect((await mission()).l1!.delivered).toBe(true);
  171 |     await expect(page.getByTestId('mission-subtitle')).toHaveText('Delivered ✓');
  172 |
  173 |     // Beat 5: 4 to 6 s of calm, then the accident.
  174 |     expect((await mission()).l1!.exitIds).toHaveLength(0);
  175 |     for (let i = 0; i < 20 && !(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'l1.smoke'))); i++) await step(30);
  176 |     await step(45); await snap('l1-accident');
  177 |     const order = await page.evaluate(() => window.__SS__!.events().filter(e => e.type.startsWith('l1.')).map(e => e.type));
  178 |     expect(order.slice(0, 5)).toEqual(['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams']);
  179 |
  180 |     // Beat 6: five infected exit; get away.
  181 |     for (let i = 0; i < 40 && (await mission()).l1!.exitIds.length === 0; i++) await step(30);
  182 |     expect((await mission()).l1!.exitIds).toHaveLength(5);
  183 |     await step(assisted ? 300 : 60); await snap('l1-escape', at('lab-door'));
  184 |
  185 |     // Beats 7 to 10: follow the objective, fight what blocks the way, interact at the garage, reach the fire station.
  186 |     const shots = new Set<string>(); let guard = 0;
  187 |     if (assisted) {
  188 |       // Follow a systemic victim for the spread photo: its location depends on the AI, not a scripted photo anchor. Prefer the
  189 |       // first bite on open ground (a body behind a fence or hedge is screened from the game camera); else the first one seen.
  190 |       // Observe spread before travel fills the unchanged director cap with street residents.
  191 |       const turning = () => page.evaluate(() => window.__SS__!.getState().entities.filter(e => e.infection && e.infection.phase !== 'rise').map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z })));
  192 |       let victimId: number | undefined;
  193 |       for (let i = 0; i < 900 && victimId === undefined; i++) {
  194 |         const now = await turning();
  195 |         victimId = (now.find(openGround) ?? (i >= 720 ? now[0] : undefined))?.id;
  196 |         if (victimId === undefined) await step(10);
  197 |       }
> 198 |       expect(victimId, 'A systemic pedestrian transformation is available for visual review').toBeDefined();
      |                                                                                               ^ Error: A systemic pedestrian transformation is available for visual review
  199 |       // Observe the same victim (without moving it) until it is rising: glowing eyes, ash skin, its own clothes and hair.
  200 |       const observe = () => page.evaluate(id => window.__SS__!.getState().entities.find(e => e.id === id), victimId!);
  201 |       let victim = await observe();
  202 |       for (let i = 0; i < 120 && victim?.infection && victim.infection.phase !== 'rise'; i++) { await step(2); victim = await observe(); }
  203 |       expect(victim!.infection?.phase, 'the victim was already risen when observed; widen the search').toBe('rise');
  204 |       await step(18); victim = await observe();
  205 |       expect(victim!.civilian, 'still mid-transformation (rising)').toBeDefined();
  206 |       await snap('l1-spread', victim!.transform, false, .75); shots.add('l1-spread');
  207 |       writeFileSync(`${output}/spread-victim.json`, JSON.stringify({ openGround: openGround(victim!.transform), ...victim }, null, 2) + '\n');
  208 |       for (const junction of [{ x: 66, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 30 }, { x: 26, z: 30 }]) await go(junction, 1.2);
  209 |       await go(at('garage-door'), 1.5);
  210 |     }
  211 |     while (guard++ < 400) {
  212 |       const m = await mission();
  213 |       if (m.phase === 'cinematic' || m.phase === 'result') break;
  214 |       const active = Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0];
  215 |       if (!active) { await step(30); continue; }
  216 |       if (assisted && active === 'firestation' && !shots.has('l1-horde')) {
  217 |         await waitBeat(); await go(at('photo-l1-horde'), 1.5);
  218 |         // The residents of one house near the garage come out one by one (1.5-4 s apart, ~25 s for all ten) and bite their way up: photograph it arriving on the street (>= 12 within 16 m), not after it
  219 |         // has piled onto the immortal courier. Game camera at the widest zoom the player can choose.
  220 |         const crowd = () => page.evaluate(() => {
  221 |           const a = window.__SS__!, p = a.getState().player!.transform, live = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden);
  222 |           const d = (e: { transform: { x: number; z: number } }) => Math.hypot(e.transform.x - p.x, e.transform.z - p.z);
  223 |           return { within2m: live.filter(e => d(e) < 2).length, within8m: live.filter(e => d(e) < 8).length, within16m: live.filter(e => d(e) < 16).length, within25m: live.filter(e => d(e) < 25).length, live: live.length,
  224 |             bearingsDeg: live.filter(e => d(e) < 25).map(e => Math.round(Math.atan2(e.transform.z - p.z, e.transform.x - p.x) * 180 / Math.PI)) };
  225 |         });
  226 |         // PO rule 2026-10-07: the ten residents come out of one house 1.5-4 s apart (~25 s for all), so give the snowball up to 40 s.
  227 |         // Snap as the crowd closes in around the courier (>= 8 within 8 m, >= 12 within 16 m), framed on the courier at the north kerb.
  228 |         for (let i = 0; i < 160; i++) { const c = await crowd(); if (c.within16m >= 12 && c.within8m >= 8) break; await step(15); }
  229 |         shots.add('l1-horde'); const scene = await crowd(); await snap('l1-horde', (await player()).transform, false, 1.45);
  230 |         writeFileSync(`${output}/horde-scene.json`, JSON.stringify(scene, null, 2) + '\n');
  231 |       }
  232 |       if (active === 'firestation') {
  233 |         // The bay opens east toward the game camera (PO 2026-10-07): approach 5 m outside along the door -> trigger axis.
  234 |         const door = at('fire-bay-door'), inside = at('fire-bay-trigger'), len = Math.hypot(inside.x - door.x, inside.z - door.z);
  235 |         const outside = { x: door.x - (inside.x - door.x) / len * 5, z: door.z - (inside.z - door.z) / len * 5 };
  236 |         if (!assisted && Math.hypot((await player()).transform.x - at('garage-bat').x, (await player()).transform.z - at('garage-bat').z) < 8) await go(at('garage-door'), 1.2);
  237 |         // Follow the street junctions instead of clicking diagonally across the fenced residential lots.
  238 |         // A fight/respawn can otherwise leave the long destination click on the wrong side of a garden wall.
  239 |         for (const junction of [{ x: 14, z: 30 }, { x: 14, z: -36 }, { x: 40.03, z: -36 }]) await go(junction, 1.2);
  240 |         await go(outside, 1);
  241 |         await step(20);
  242 |         expect((await mission()).phase).toBe('playing');
  243 |         expect((await mission()).l1!.beat).toBeFalsy();
  244 |         expect((await mission()).gates['fire-shutter']).toBe(true);
  245 |         expect((await mission()).l1!.say?.text).toBe('Get in!');
  246 |         if (assisted) {
  247 |           // Capture a fresh repeated invitation, rather than an expired bubble between calls.
  248 |           for (let i = 0; i < 8 && await page.evaluate(() => window.__SS__!.tick() - window.__SS__!.missions.state()!.l1!.say!.at > 30); i++) await step(30);
  249 |           await step(10); // Let the normal ten-tick speech fade-in finish.
  250 |           await expect(page.getByText('Get in!', { exact: true }).first()).toBeVisible();
  251 |           await page.evaluate(p => window.__SS__!.camera.cinematic({ position: [p.x + 18, 20, p.z + 18], target: [p.x, 0, p.z] }, true), door);
  252 |           await page.evaluate(() => window.__SS__!.screenshotReady());
  253 |           await page.screenshot({ path: `${output}/firestation-invitation.png` });
  254 |           await page.evaluate(() => window.__SS__!.camera.follow());
  255 |         }
  256 |       }
  257 |       if (active === 'weapon' && Math.hypot((await player()).transform.x - at('garage-door').x, (await player()).transform.z - at('garage-door').z) > 12) {
  258 |         for (const junction of [{ x: 66, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 30 }, { x: 26, z: 30 }]) await go(junction, 1.2);
  259 |       }
  260 |       const goal = at(goals[active]);
  261 |       await go(goal, active === 'weapon' ? 1.2 : active === 'firestation' ? .25 : 1.5);
  262 |       if (active === 'weapon') {
  263 |         await interact(); await step(40);
  264 |         if (!shots.has('l1-garage')) { shots.add('l1-garage'); await snap('l1-garage'); }
  265 |       }
  266 |       if (active === 'escape' && !shots.has('l1-spread')) { shots.add('l1-spread'); await snap('l1-spread'); }
  267 |       if (active === 'firestation' && !shots.has('l1-horde')) { shots.add('l1-horde'); await snap('l1-horde'); }
  268 |     }
  269 |     if (assisted) expect(shots.has('l1-spread') && shots.has('l1-horde')).toBe(true);
  270 |     expect((await mission()).completedObjectives).toEqual(['pickup', 'deliver', 'escape', 'weapon', 'firestation']);
  271 |     expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
  272 |     await step(2);
  273 |     await expect(page.getByTestId('mission-subtitle')).toHaveText(caption);
  274 |     if (!shots.has('l1-safe')) await snap('l1-safe', at('fire-bay-door'));
  275 |     for (let i = 0; i < 40 && (await mission()).phase !== 'result'; i++) await step(30);
  276 |     expect((await mission()).phase).toBe('result');
  277 |     await expect(page.getByTestId('mission-heading')).toHaveText(caption);
  278 |     await expect(page.getByTestId('result-delivered')).toHaveText('✓');
  279 |     writeFileSync(`${output}/${assisted ? 'assisted' : 'unassisted'}-result.json`, JSON.stringify(await mission(), null, 2) + '\n');
  280 |   });
  281 | });
  282 |
```
