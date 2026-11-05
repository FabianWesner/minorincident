/** Q-307/Q-309/Q-311: shared-pool game-camera and real-input evidence. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const mode = process.argv[2] ?? 'perf';
const variant = process.argv[3] ?? 'after';
const tier = process.argv[4] === 'high' ? 'high' : 'low';
const backend = process.argv[5] === 'webgl2' ? 'webgl2' : 'webgpu';
const out = `test-results/uat-gates/${variant}-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier, viewport: { width: 1280, height: 800 }, query: { level: 'L7', ui: '1', loadProfile: '2' } });
const data: Record<string, unknown> = {};
const save = () => writeFileSync(`${out}/${mode}.json`, JSON.stringify({ ...data, errors: s.errors }, null, 2));
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = fn => fn');
  await s.page.evaluate(async ({ tier, mode }) => {
    const a = window.__SS__!;
    a.settings.set({ quality: tier as 'high' | 'low', cameraShake: false });
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    await g.loadLevel('L7', { seed: 1, progression: 'L7-default', setup: w => {
      const roster = w.l7Encounters!.state.roster, wanted = mode === 'perf' ? 28 : 19;
      for (const row of roster.splice(wanted)) { w.spatial.delete(row.id); w.entities.delete(row.id); }
      while (roster.length < wanted) {
        const slot = roster.length, source = w.entities.get(roster[slot % 2].id)!;
        const { id: sourceId, ...copy } = structuredClone(source); void sourceId;
        const e = w.entities.create({ ...copy, transform: { ...copy.transform, x: 278 + slot % 3 * .7, z: 12.5 + Math.floor(slot / 3) * .55 } });
        e.civilian!.path = []; e.civilian!.goal = -1;
        e.civilian!.survivor!.slot = slot; e.civilian!.survivor!.key = `uat-${slot}`;
        roster.push({ ...roster[0], id: e.id, key: `uat-${slot}` }); w.solids.admit(e, 'uat.roster');
      }
    } });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    await a.screenshotReady();
    if (mode === 'perf') { a.settings.set({ muted: false }); g.audio.graph.output.gain.value = 0; await a.audio.unlock(); }
  }, { tier, mode });
  data.start = await s.page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const d = g.view as unknown as { districts: { lodBatches: { id: string; refs: import('three').Object3D[] }[] } };
    return { perf: a.perf(), player: a.getEntity(1)!.transform, pedestrians: g.world.l7Encounters!.state.roster.length,
      gate: d.districts.lodBatches.filter(e => e.id === 'int.metro-exit').map(e => ({ refs: e.refs.map(r => ({ position: r.position.toArray(), yaw: r.userData.doorYaw })) })),
      companions: [...g.world.entities.iterate()].filter(e => e.companion).map(e => ({ id: e.id, at: e.transform })) };
  });
  const click = async (x: number, z: number, y = 3.9) => {
    const p = await s.page.evaluate(({ x, z, y }) => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.view.project(x, y, z);
      return { x: (p[0] + 1) * innerWidth / 2, y: (1 - p[1]) * innerHeight / 2 };
    }, { x, z, y });
    assert.ok(p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 800, `point off screen ${JSON.stringify(p)}`);
    return p;
  };
  if (mode === 'perf') {
    await s.page.evaluate(() => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      const run = { start: performance.now(), tick: a.tick(), loaded: { ...a.perf().nodeBuildMaterials }, gaps: [] as { ms: number; at: number; tick: number; render: number; sim: number }[], builds: [] as unknown[], active: true, previous: 0 };
      (window as unknown as { uatPerf: typeof run }).uatPerf = run;
      const renderer = g.view.renderer, previous = renderer.debug.onNodeBuilderCreated;
      renderer.debug.onNodeBuilderCreated = (builder, object) => {
        previous?.(builder, object);
        const draw = object as unknown as { object: import('three').Object3D; material: import('three').Material };
        run.builds.push({ at: performance.now() - run.start, tick: a.tick(), object: draw.object.name, material: draw.material.name, type: draw.material.type });
      };
      const frame = (now: number) => {
        if (!run.active) return;
        const p = a.perf();
        if (run.previous) run.gaps.push({ ms: now - run.previous, at: now - run.start, tick: a.tick(), render: p.renderCpuMs, sim: p.simMs });
        run.previous = now; requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame); a.resume();
    });
    const pickup = await click(276, 15); await s.page.mouse.click(pickup.x, pickup.y);
    await s.page.waitForFunction(() => window.__SS__!.events(0).some(e => e.type === 'pickup.collected' && 'actionId' in e && e.actionId === 'weapon.rocket-launcher'), null, { timeout: 15000 });
    data.pickup = await s.page.evaluate(() => ({ tick: window.__SS__!.tick(), player: window.__SS__!.getEntity(1)!.transform }));
    await s.page.keyboard.press('Digit7');
    const target = await click(261, 15); await s.page.mouse.move(target.x, target.y);
    await s.page.keyboard.down('Shift'); await s.page.mouse.down();
    await s.page.waitForFunction(() => window.__SS__!.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.rocket-launcher').length >= 5, null, { timeout: 15000 });
    await s.page.mouse.up(); await s.page.keyboard.up('Shift');
    await s.page.waitForTimeout(1800);
    data.result = await s.page.evaluate(() => {
      const a = window.__SS__!;
      const run = (window as unknown as { uatPerf: { start: number; tick: number; loaded: Record<string, number>; gaps: { ms: number; at: number; tick: number; render: number; sim: number }[]; builds: unknown[]; active: boolean } }).uatPerf;
      run.active = false; a.pause();
      const after = a.perf(), sorted = run.gaps.map(f => f.ms).sort((a,b) => a-b);
      return { ...run, max: sorted.at(-1), p95: sorted[Math.floor(sorted.length * .95)], over100: run.gaps.filter(f => f.ms > 100),
        lateMaterials: Object.fromEntries(Object.entries(after.nodeBuildMaterials).filter(([key, count]) => count !== (run.loaded[key] ?? 0))), after,
        events: a.events(run.tick).filter(e => ['pickup.collected','combat.attack','combat.exploded','explosion'].includes(e.type)), player: a.getEntity(1)!.transform };
    });
    await s.page.screenshot({ path: `${out}/perf-end.jpg`, type: 'jpeg', quality: 85 });
    const result = data.result as { max: number; p95: number; over100: unknown[]; lateMaterials: object };
    console.log(`${variant} ${backend} ${tier}: ${JSON.stringify({ max: result.max, p95: result.p95, over100: result.over100, lateMaterials: result.lateMaterials })}`);
  }
  if (mode === 'gate') {
    for (const zoom of [1, 1.5]) {
      await s.page.evaluate(async zoom => {
        const a = window.__SS__!; a.teleport(1, { x: 261, z: 15.9 }); a.camera.zoom(zoom);
        await a.step(2); await a.screenshotReady();
      }, zoom);
      await s.page.screenshot({ path: `${out}/northgate-z${zoom}.jpg`, type: 'jpeg', quality: 88 });
    }
    if (variant !== 'main') {
      await s.page.evaluate(async () => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const roster = w.l7Encounters!.state.roster;
        for (const row of roster.splice(19)) w.entities.delete(row.id);
        a.teleport(1, { x: 263, z: 15.9 });
        roster.forEach((row, i) => a.teleport(row.id, { x: 265 + Math.floor(i / 5) * .65, z: 15.9 + (i % 5 - 2) * .65 }));
        for (const e of w.entities.iterate()) if (e.companion) a.teleport(e.id, { x: 264, z: 16.5 });
        a.camera.zoom(1.5); await a.step(2); await a.screenshotReady();
      });
      await s.page.screenshot({ path: `${out}/group-start.jpg`, type: 'jpeg', quality: 88 });
      const trace = [];
      for (const x of [256, 249, 243]) {
        const point = await click(x, 15.9); await s.page.mouse.click(point.x, point.y);
        for (let i = 0; i < 4; i++) trace.push(await s.page.evaluate(async () => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          await a.step(120);
          return { tick: a.tick(), player: a.getEntity(1)!.transform, followers: w.l7Encounters!.state.roster.map(r => a.getEntity(r.id)!.transform),
            companions: [...w.entities.iterate()].filter(e => e.companion).map(e => e.transform), rescues: w.trapRescue?.rescues ?? 0 };
        }));
        await s.page.evaluate(() => window.__SS__!.screenshotReady());
        await s.page.screenshot({ path: `${out}/group-x${x}.jpg`, type: 'jpeg', quality: 88 });
      }
      data.walk = trace; save();
      const end = trace.at(-1)!;
      assert.ok(end.player.x < 249, 'courier crossed Northgate');
      assert.ok(end.followers.every(p => p.x < 258), 'all 19 survivors crossed Northgate');
      assert.ok(end.companions.length && end.companions.every(p => p.x < 258), 'corgi crossed Northgate');
      assert.equal(end.rescues, 0, 'ordinary locomotion without rescue');
      console.log(`${tier}: courier, corgi and ${end.followers.length} survivors crossed`);
    }
  }
  if (mode === 'rockets') {
    await s.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.setLoadout(['weapon.rocket-launcher'], ['weapon.kick']);
      a.teleport(1, { x: 233.94, z: 19.68 }); a.camera.zoom(1.5);
      a.settings.set({ vfx: true, muted: false, cameraShake: false }); g.audio.graph.output.gain.value = 0; await a.audio.unlock();
      const actions = (g.view as unknown as { actions: { projectiles: import('three').Mesh[] } }).actions;
      for (const m of actions.projectiles) m.onAfterRender = () => { m.userData.draws = (m.userData.draws ?? 0) + 1; };
      await a.step(2); await a.screenshotReady();
    });
    const shots = [];
    for (let n = 0; n < (process.env.UAT_ONE === '1' ? 1 : 5); n++) {
      const control = n % 2 ? 'wasd-aim' : 'classic';
      const target = { x: 226 + n * .4, z: 16 + n * .5 };
      const tick = await s.page.evaluate(async control => {
        const a = window.__SS__!; void control; void a;
        for (let i = 0; i < 40; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
        await a.screenshotReady(); return a.tick();
      }, control);
      const point = await click(target.x, target.z);
      await s.page.mouse.move(point.x, point.y);
      if (control === 'classic') await s.page.keyboard.down('Shift');
      await s.page.mouse.down(); await s.page.evaluate(() => window.__SS__!.step(1)); await s.page.mouse.up();
      if (control === 'classic') await s.page.keyboard.up('Shift');
      const flight = await s.page.evaluate(async tick => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
        for (let i = 0; i < 50 && !w.combat!.projectiles.length; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
        for (let i = 0; i < 14; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
        await a.screenshotReady();
        return { tick: a.tick(), scheme: (window.__SCENE__ as unknown as { game: Game }).game.input.scheme,
          active: w.combat!.projectiles.map(p => ({ x: p.x, y: p.y, z: p.z, destination: p.destination })),
          attacks: a.events(tick).filter(e => e.type === 'combat.attack'),
          meshes: (g.view as unknown as { actions: { projectiles: import('three').Mesh[]; projectileExhausts: import('three').Mesh[] } }).actions.projectiles.slice(0, 1).map(m => ({ visible: m.visible, parent: m.parent?.visible, draws: m.userData.draws, culled: m.frustumCulled, auto: m.matrixAutoUpdate, range: m.geometry.drawRange, position: m.position.toArray(), world: m.getWorldPosition(m.position.clone()).toArray(), pixel: g.view.project(m.position.x, m.position.y, m.position.z), scale: m.scale.toArray(), material: { type: (m.material as import('three').Material).type, toneMapped: (m.material as import('three').Material).toneMapped, opacity: (m.material as import('three').Material).opacity, visible: (m.material as import('three').Material).visible } })) };
      }, tick);
      await s.page.screenshot({ path: `${out}/shot-${n + 1}-flight.jpg`, type: 'jpeg', quality: 88 });
      const impact = await s.page.evaluate(async tick => {
        const a = window.__SS__!;
        for (let i = 0; i < 180; i++) {
          const e = a.events(tick).find(e => e.type === 'combat.exploded');
          if (e) {
            for (let j = 0; j < 2; j++) { a.vfx.stepRender(1 / 60); await a.step(1); }
            await a.screenshotReady();
            return { event: e, effects: a.perf().effects, events: a.events(tick).filter(e => ['explosion','combat.exploded','combat.hit'].includes(e.type)), audio: a.audio.snapshot() };
          }
          a.vfx.stepRender(1 / 60); await a.step(1);
        }
        throw new Error('rocket vanished without an impact');
      }, tick);
      await s.page.screenshot({ path: `${out}/shot-${n + 1}-impact.jpg`, type: 'jpeg', quality: 88 });
      shots.push({ n: n + 1, control, target, flight, impact }); data.shots = shots; save();
      assert.equal(flight.attacks.length, 1, 'one real-input discharge');
      assert.ok(flight.active.length, 'rocket visible during flight');
      assert.ok(impact.effects!.blasts.fireballs > 0, 'impact has fireballs');
      assert.equal(impact.effects!.blasts.poolOverwrites.fireballs, 0);
      console.log(`${backend} ${tier} shot ${n + 1}: ${JSON.stringify(impact.event)}`);
    }
  }
  if (mode === 'sweep') {
    const levels = [
      { level: 'L6', spots: [['shelter-shutter', 0, -13], ['west-entry', -10, -14], ['east-entry', 10, -14],
        ['gate-90', 90, 15], ['gate-150', 150, 15], ['gate-210', 210, 15],
        ['hatch-54', 54, 13], ['hatch-78', 78, 17], ['hatch-126', 126, 13], ['hatch-162', 162, 17], ['hatch-198', 198, 13], ['hatch-228', 228, 17],
        ['exit-stairs', 249, 15], ['exit-gate', 261, 15.9]] },
      { level: 'L7', spots: [['northgate', 261, 15.9], ['west-yard-south', -78, -30], ['west-yard-north', -78, 35],
        ['sealed-yard-south', 30, -25], ['sealed-yard-north', 30, 30], ['harbor-frontages', 0, -40], ['city-frontages', 40, 0],
        ['lake-passage', -30, 58], ['corridor-east', -30, 50], ['corridor-west', -68, 50], ['bus', -70, 47.5]] },
    ] as const;
    const audit = [];
    for (const { level, spots } of levels) {
      await s.page.evaluate(async ({ level, tier }) => {
        const a = window.__SS__!;
        await a.loadLevel(level, { seed: 1, progression: level === 'L6' ? 'L6-default' : 'L7-default' });
        a.pause(); a.missions.begin(); a.cheats.god(true); a.settings.set({ quality: tier as 'high' | 'low' }); a.camera.follow();
        if (level === 'L6') { a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); }
      }, { level, tier });
      audit.push(await s.page.evaluate(level => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world, d = w.districts!.districts[0];
        return { level, candidates: d.decay.placements.filter(p => /fence|gate|door|metro|hatch/.test(p.assetId)).map(p => ({ id: p.id, asset: p.assetId, at: p.position,
          colliders: d.decay.colliders.filter(c => c.id === p.id || c.id.startsWith(`${p.id}/`)).map(c => ({ id: c.id, aabb: c.aabb, walkable: c.walkable })) })),
          gates: w.missions?.state.l6?.gates, hatches: [54,78,126,162,198,228].map((x, i) => {
            const z = i % 2 ? 18.35 : 11.65;
            return { x, z, blockers: d.decay.colliders.filter(c => !c.walkable && c.aabb.min[0] < x + .75 && c.aabb.max[0] > x - .75 && c.aabb.min[2] < z + .15 && c.aabb.max[2] > z - .15).map(c => ({ id: c.id, aabb: c.aabb })) };
          }) };
      }, level));
      for (const zoom of [1, 1.5]) for (const [name, x, z] of spots) {
        await s.page.evaluate(async ({ x, z, zoom }) => { const a = window.__SS__!; a.teleport(1, { x, z }); a.camera.zoom(zoom); await a.step(2); await a.screenshotReady(); }, { x, z, zoom });
        await s.page.screenshot({ path: `${out}/sweep-${level}-${name}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
      }
      if (level === 'L6') {
        const walks = [];
        for (const x of [78, 228]) {
          await s.page.evaluate(async x => {
            const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
            a.teleport(1, { x, z: 17 });
            const entry = w.missions!.state.l6!.entries!.find(e => e.door === (x === 78 ? 5 : 7))!;
            entry.closedAt = w.tick || 1; entry.remaining = 0;
            a.camera.zoom(1); await a.step(1); await a.screenshotReady();
          }, x);
          const at = await s.page.evaluate(x => window.__SS__!.input.project({ x, z: 21 }), x);
          await s.page.mouse.click(at.x, at.y);
          walks.push(await s.page.evaluate(async x => { const a = window.__SS__!; await a.step(180); return { x, player: a.getEntity(1)!.transform }; }, x));
        }
        data.hatchWalks = walks;
      }
    }
    data.audit = audit;
  }
  if (mode === 'functional') {
    const results = [];
    for (const kind of ['click', 'contact', 'range'] as const) {
      const result = await s.page.evaluate(async kind => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        a.input.clear(); a.setLoadout(['weapon.rocket-launcher'], ['weapon.kick']); a.settings.set({ aimAssist: 'Off' });
        a.teleport(1, { x: 233.94, z: 19.68 }); await a.step(40);
        const p = { ...a.getEntity(1)!.transform }, endpoint = { x: p.x + (kind === 'range' ? 35 : 12), z: p.z };
        const centre = kind === 'contact' ? { x: p.x + 6, z: p.z } : endpoint;
        const adjacent = { x: centre.x, z: centre.z - 2.5 };
        const splash = w.spawnDummy('infected.dummy', adjacent, { hp: 1000 }); a.teleport(splash, adjacent);
        const direct = kind === 'contact' ? w.spawnDummy('infected.dummy', centre, { hp: 1000 }) : undefined;
        if (direct) a.teleport(direct, centre);
        const before = { ...a.getEntity(splash)!.transform }, tick = a.tick();
        a.input.set({ aim: { x: 1, z: 0 }, ...(kind === 'range' ? {} : { aimPoint: endpoint }), left: { down: true, held: false, up: false } });
        await a.step(1); a.input.clear();
        for (let i = 0; i < 180; i++) {
          a.vfx.stepRender(1 / 60); await a.step(1);
          if (a.events(tick).some(e => e.type === 'combat.exploded')) break;
        }
        const event = a.events(tick).find(e => e.type === 'combat.exploded');
        const hp = a.getEntity(splash)!.health.current, at = a.getEntity(splash)!.transform;
        const result = { kind, endpoint, centre, event, hp, knockback: Math.hypot(at.x - before.x, at.z - before.z),
          explosion: a.events(tick).filter(e => e.type === 'explosion'), effects: a.perf().effects };
        w.spatial.delete(splash); w.entities.delete(splash); if (direct) { w.spatial.delete(direct); w.entities.delete(direct); }
        return result;
      }, kind);
      results.push(result); data.functional = results; save();
      assert.ok(result.event && result.explosion.length === 1, `${kind}: one visible-blast event`);
      assert.ok(result.hp < 1000, `${kind}: splash damages adjacent target`);
      assert.ok(result.knockback > 0, `${kind}: splash displaces adjacent target`);
      if (result.event?.type === 'combat.exploded' && kind !== 'contact') assert.ok(Math.hypot(result.event.position.x - result.endpoint.x, result.event.position.z - result.endpoint.z) < .3, `${kind}: exact endpoint`);
      console.log(`${tier} ${kind}: hp ${result.hp}, knockback ${result.knockback}`);
    }
  }
  if (mode === 'l6exit') {
    await s.page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
      a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
      a.teleport(1, { x: 261, z: 15.9 }); await a.step(2); await a.screenshotReady();
    });
    for (const zoom of [1, 1.5]) {
      await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(2); await a.screenshotReady(); }, zoom);
      await s.page.screenshot({ path: `${out}/l6-exit-z${zoom}.jpg`, type: 'jpeg', quality: 88 });
    }
    data.l6exit = await s.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const d = g.view.labProbes().districts as unknown as { lodBatches: { id: string; refs: import('three').Object3D[] }[] };
      return { gateAt: g.world.missions!.state.l6!.gateAt, refs: d.lodBatches.filter(e => e.id === 'int.metro-exit').flatMap(e => e.refs.map(r => r.userData.doorYaw?.exitGate)) };
    });
    const exit = data.l6exit as { gateAt: number; refs: number[] };
    assert.equal(exit.gateAt, 0); assert.ok(exit.refs.length && exit.refs.every(yaw => Math.abs(yaw - Math.PI * .55) < .001), 'late-streamed L6 exit opens before the group exits');
  }
  if (mode === 'hatch') {
    await s.page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
      a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1);
      a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop');
      a.teleport(1, { x: 78, z: 17.45 }); await a.step(2); await a.screenshotReady();
    });
    await s.page.keyboard.down('KeyE'); await s.page.evaluate(() => window.__SS__!.step(30)); await s.page.keyboard.up('KeyE');
    data.closedHatch = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      await a.screenshotReady(); return { entry: w.missions!.state.l6!.entries!.find(e => e.door === 5), player: a.getEntity(1)!.transform };
    });
    save(); await s.page.screenshot({ path: `${out}/hatch-78-locked.jpg`, type: 'jpeg', quality: 88 });
    const closed = data.closedHatch as { entry: { closedAt: number } };
    assert.ok(closed.entry.closedAt > 0, 'ordinary E input locked the hatch');
    const p = await s.page.evaluate(() => window.__SS__!.input.project({ x: 78, z: 21 })); await s.page.mouse.click(p.x, p.y);
    data.hatchCrossing = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      await a.step(180); await a.screenshotReady(); return { entry: w.missions!.state.l6!.entries!.find(e => e.door === 5), player: a.getEntity(1)!.transform };
    });
    await s.page.screenshot({ path: `${out}/hatch-78-crossed.jpg`, type: 'jpeg', quality: 88 });
    await s.page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 78, z: 17.45 }); await a.step(1); });
    await s.page.keyboard.down('KeyA'); await s.page.keyboard.down('KeyS'); await s.page.evaluate(() => window.__SS__!.step(60));
    await s.page.keyboard.up('KeyA'); await s.page.keyboard.up('KeyS');
    data.hatchKeyboard = await s.page.evaluate(async () => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      await a.screenshotReady(); return { entry: w.missions!.state.l6!.entries!.find(e => e.door === 5), player: a.getEntity(1)!.transform };
    });
    await s.page.screenshot({ path: `${out}/hatch-78-wasd.jpg`, type: 'jpeg', quality: 88 });
    console.log(JSON.stringify({ closed: data.closedHatch, clicked: data.hatchCrossing, keyboard: data.hatchKeyboard }));
  }
} finally { save(); await s.close(); stopServer(); }
