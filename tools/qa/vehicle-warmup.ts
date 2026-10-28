/** Shared-pool diagnostic: actual level warm-up, vehicle approach/boarding, or L7 bus fight.
 * SCENE_PORT=4382 sh tools/e2e-lock.sh npx tsx tools/qa/vehicle-warmup.ts L8 [runs=1]
 * WARMUP_OUT selects the evidence directory; WARMUP_PROFILE=1 adds a CPU profile.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Object3D } from 'three';
const level = process.argv[2] ?? 'L8', runs = Number(process.argv[3] ?? 1);
const out = process.env.WARMUP_OUT ?? 'test-results/vehicle-warmup';
const backend = (process.env.WARMUP_BACKEND ?? 'webgpu') as Backend;
mkdirSync(out, { recursive: true });
try {
  for (let run = 1; run <= runs; run++) {
    const session = new SceneSession({ backend, tier: 'low', viewport: { width: 1600, height: 900 }, query: { loadProfile: '2', testApi: '1' } });
    try {
      await session.open(); session.page.setDefaultTimeout(180_000);
      await session.page.evaluate('globalThis.__name = fn => fn');
      await session.page.evaluate(async level => {
        const a = window.__SS__!;
        await a.loadLevel(level, { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
      }, level);
      const cdp = await session.page.context().newCDPSession(session.page);
      if (process.env.WARMUP_PROFILE === '1') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      const result = await session.page.evaluate(async level => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const view = g.view as unknown as { vehicles?: Object3D; bicycle?: Object3D; character?: Object3D };
        const builds: { at: number; tick: number; material: string; object: string; asset?: string; subject: boolean }[] = [];
        const frames: { at: number; ms: number; tick: number; x: number; z: number; sim: number; update: number; render: number; builds: number; infected: number; heap: number }[] = [];
        const before = { ...a.perf().nodeBuildMaterials }, original = g.view.renderer.debug.onNodeBuilderCreated;
        let stop = false, previous = performance.now();
        g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
          original?.(builder, object);
          const draw = object as unknown as { object: Object3D; material: { name: string; type: string } };
          let subject = false, asset: string | undefined;
          for (let parent: Object3D | null = draw.object; parent; parent = parent.parent) {
            subject ||= parent === view.vehicles || parent === view.bicycle || parent === view.character;
            asset ??= parent.userData.assetId as string | undefined;
          }
          subject ||= !!asset?.startsWith('veh.') || draw.material.name.startsWith('vehicle:') || draw.material.name.startsWith('character:');
          builds.push({ at: performance.now(), tick: a.tick(), material: draw.material.name || draw.material.type, object: draw.object.name, asset, subject });
        };
        const sample = (at: number) => {
          if (stop) return;
          const player = g.world.entities.get(1)!;
          frames.push({ at, ms: at - previous, tick: a.tick(), x: player.transform.x, z: player.transform.z, sim: (g as unknown as { simMs: number }).simMs, update: g.view.updateCpuMs, render: g.view.renderCpuMs, builds: builds.length, infected: g.world.infected?.director.count ?? 0, heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0 });
          previous = at; requestAnimationFrame(sample);
        };
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const inventory = [...g.world.vehicles!.cars].map(([id, car]) => ({ id, def: car.physics.def.id, at: { ...car.entity.transform } }));
        const scripted = (g.view as unknown as { entityAssets?: { records: Map<number, { model: Object3D }> } }).entityAssets;
        const scriptedVehicles = [...scripted?.records ?? []].filter(([, record]) => (record.model.userData.assetId as string | undefined)?.startsWith('veh.'))
          .map(([id, record]) => ({ id, asset: record.model.userData.assetId as string }));
        requestAnimationFrame(sample);
        const marks: { name: string; at: number; tick: number }[] = [];
        const mark = (name: string) => marks.push({ name, at: performance.now(), tick: a.tick() });
        let boarded = false, bikeBoarded = false;
        try {
          a.resume();
          if (level === 'L7') {
            // Real final-horde population and rockets beside the authored evacuation bus.
            a.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']);
            await wait(1800);
            a.teleport(1, { x: -48, z: 46 });
            mark('bus-fight-start');
            for (let shot = 0; shot < 24; shot++) {
              if (shot === 8) { a.teleport(1, { x: -70.5, z: 47.5 }); mark('bus-door-fight'); }
              const player = g.world.entities.get(1)!;
              const enemy = g.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging)
                .sort((x, y) => Math.hypot(x.transform.x - player.transform.x, x.transform.z - player.transform.z) - Math.hypot(y.transform.x - player.transform.x, y.transform.z - player.transform.z))[0];
              if (enemy) a.input.set({ attackTarget: { id: enemy.id, side: 'RIGHT' }, right: { down: true, held: true, up: false } });
              await wait(750);
            }
            a.input.clear(); mark('bus-fight-end');
          } else {
            if (level === 'L4') {
              mark('convoy-start');
              for (let i = 0; i < 600 && g.world.missions?.state.l4?.seated; i++) await wait(200);
              if (g.world.missions?.state.l4?.seated) throw Error('L4 convoy did not unload in two minutes');
              mark('convoy-unloaded');
              const spectacle = (g.world.missions!.l4 as unknown as { spectacle: { startTank(): void; startHeli(): void } }).spectacle;
              spectacle.startTank(); spectacle.startHeli(); mark('authored-war-vehicles-introduced');
              await wait(300);
              for (const [id, record] of scripted?.records ?? []) if ((record.model.userData.assetId as string | undefined)?.startsWith('veh.') && !scriptedVehicles.some(vehicle => vehicle.id === id)) scriptedVehicles.push({ id, asset: record.model.userData.assetId as string });
            }
            for (const [id, car] of g.world.vehicles!.cars) {
              const p = car.entity.transform, def = car.physics.def, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
              if (g.world.vehicles!.active !== null) {
                boarded ||= g.world.vehicles!.active === id; mark('already-driving');
                a.input.set({ drive: { throttle: 1, steer: 0 } }); await wait(2500); a.input.clear();
                for (const amount of [300, 300, 400]) { g.world.vehicles!.damage(id, amount); await wait(500); mark(`damage:${car.entity.health.current}`); }
                continue;
              }
              for (const distance of [55, 25, def.width / 2 + .55]) {
                a.teleport(1, { x: p.x + c * def.doorX + s * distance, z: p.z - s * def.doorX + c * distance });
                mark(`${def.id}:approach:${distance}`); await wait(distance === def.width / 2 + .55 ? 150 : 600);
              }
              if (g.world.vehicles!.active !== id) { a.pause(); a.input.set({ interact: true }); await a.step(1); a.input.clear(); a.resume(); }
              await wait(1800);
              boarded ||= g.world.vehicles!.active === id; mark(`${def.id}:boarded:${g.world.vehicles!.active === id}`);
              if (g.world.vehicles!.active === id && !car.entity.vehicle!.floor) { a.pause(); a.input.set({ interact: true }); await a.step(1); a.input.clear(); a.resume(); await wait(1100); }
            }
            const bike = g.world.vehicles!.bicycle.entity;
            if (bike) {
              a.teleport(1, { x: bike.transform.x + .5, z: bike.transform.z });
              if (!g.world.vehicles!.bicycle.riding) { a.pause(); a.input.set({ interact: true }); await a.step(1); a.input.clear(); a.resume(); }
              await wait(1200); bikeBoarded = g.world.vehicles!.bicycle.riding; mark(`bicycle:boarded:${bikeBoarded}`);
            }
            for (const vehicle of scriptedVehicles) {
              const entity = g.world.entities.get(vehicle.id); if (!entity) continue;
              for (const distance of [55, 25, 4]) {
                a.teleport(1, { x: entity.transform.x, z: entity.transform.z + distance });
                mark(`${vehicle.asset}:approach:${distance}`); await wait(300);
              }
            }
          }
          await wait(500);
        } finally { a.pause(); a.input.clear(); stop = true; g.view.renderer.debug.onNodeBuilderCreated = original; }
        return { level, backend: a.perf().backend, quality: a.getState().render.quality, inventory, scriptedVehicles, boarded, bikeBoarded, marks, before, after: { ...a.perf().nodeBuildMaterials }, builds, frames, attacks: a.events(0).filter(event => event.type === 'combat.attack'), lateSubjectBuilds: builds.filter(build => build.subject), over200: frames.filter(frame => frame.ms > 200), maxMs: Math.max(...frames.map(frame => frame.ms)) };
      }, level);
      if (process.env.WARMUP_PROFILE === '1') writeFileSync(`${out}/${level}-${backend}-${run}.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
      writeFileSync(`${out}/${level}-${backend}-${run}.json`, JSON.stringify({ ...result, errors: session.errors }, null, 2));
      console.log(JSON.stringify({ level, backend, run, vehicles: result.inventory, scriptedVehicles: result.scriptedVehicles, boarded: result.boarded, bikeBoarded: result.bikeBoarded, attacks: result.attacks.length, frames: result.frames.length, maxMs: result.maxMs, over200: result.over200, lateSubjectBuilds: result.lateSubjectBuilds, errors: session.errors }));
      assert.deepEqual(session.errors, []);
      if (process.env.WARMUP_ASSERT === '1') {
        assert.deepEqual(result.lateSubjectBuilds, [], 'No courier/vehicle node builds after level warm-up');
        if (level === 'L8' || level === 'L9') assert.ok(result.boarded, 'APC driver exercised');
        if (level === 'L1') assert.ok(result.bikeBoarded, 'Bicycle rider exercised');
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
