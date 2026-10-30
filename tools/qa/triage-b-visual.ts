/** Focused visual backlog receipts. Uses production Scene Lab and the shared headless pool. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const mode = process.argv[2] ?? 'vfx', label = process.argv[3] ?? 'before';
const tier = process.env.TRIAGE_TIER === 'low' ? 'low' : 'high';
const backend = process.env.TRIAGE_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const out = resolve(`docs/reports/triage-b/captures/${label}-${backend}-${tier}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: mode === 'boarding' ? { ui: '1' } : {} });
try {
  if (mode === 'variant') {
    await session.open();
    await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause(); a.cheats.god(true); });
    await session.page.addStyleTag({ content: '[data-testid=mission-button]{visibility:visible!important}' });
    if (await session.page.getByTestId('mission-button').isVisible()) await session.page.getByTestId('mission-button').click();
    await session.page.evaluate(() => window.__SS__!.pause());
    await session.ready();
    await session.page.screenshot({ path: `${out}/variant-female.png` });
    await session.page.evaluate(() => window.__SS__!.survivor.select('male'));
    await session.page.evaluate(async () => { for (let i = 0; i < 120; i++) await new Promise(requestAnimationFrame); });
    // Deliberately no screenshotReady(): that would prepare the missing variant
    // and conceal the live debug-selection bug.
    await session.page.screenshot({ path: `${out}/variant-male.png` });
    const character = await session.page.evaluate(() => window.__SS__!.getState().render.character);
    writeFileSync(`${out}/variant.json`, JSON.stringify({ character, errors: session.errors }, null, 2));
  } else if (mode === 'boarding') {
    await session.open();
    const staged = await session.page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L8', { seed: 1 }); a.pause(); a.cheats.god(true);
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world, mission = w.missions!, zoo = mission.l8!;
      mission.state.phase = 'playing'; mission.state.steps.escape.status = 'completed'; mission.state.steps.depart.status = 'active';
      zoo.state.breachedAt = w.tick || 1;
      const ring = { x: mission.def.anchors.exit.x, z: mission.def.anchors.exit.z }; a.teleport(1, ring); a.camera.follow();
      const passengers = zoo.passengers();
      for (const [i, id] of passengers.entries()) {
        const e = w.entities.get(id)!; e.transform.x = ring.x + (i ? 3 + i : 25); e.transform.z = ring.z + 4;
      }
      document.documentElement.setAttribute('data-scene-hud', '');
      document.querySelector('.hud')?.setAttribute('data-scene-hud', '');
      await a.step(1); await a.screenshotReady();
      return { passengers, ring };
    });
    await session.page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); });
    await session.page.screenshot({ path: `${out}/boarding.png` });
    const text = await session.page.getByTestId('objective-text').evaluate(e => e.parentElement!.textContent);
    writeFileSync(`${out}/boarding.json`, JSON.stringify({ staged, text, errors: session.errors }, null, 2));
    console.log(text);
  } else if (mode === 'world') {
    const truck = readSpec(resolve('tests/scenes/catalog/qa-l7-entry-rocket.json'));
    const tunnel = readSpec(resolve('tests/scenes/catalog/l6-tunnel-walkway.json'));
    const arrow: SceneSpec = { name: 'l9-arrow', seed: 31, ground: 'district', time: 'L9-crossing', dof: false,
      layout: { district: 'D-CROSSING', bbox: [[-470, -45], [-400, 45]] },
      vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [-439, 0], driven: true, floor: true, health: 1000 }],
      camera: { mode: 'game', target: 'apc', zoom: 1 }, frames: 1, shots: [0, 1] };
    for (const spec of [truck, tunnel, arrow]) {
      await session.open(); const dir = `${out}/${spec.name}`; mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/spec.json`, JSON.stringify(spec, null, 2));
      const result = await runSpec(session, spec, { out: dir });
      writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2));
      console.log(`${spec.name}: ${result.pass ? 'pass' : 'FAIL'}`); await session.close();
    }
  } else if (mode === 'vfx') {
    const blood = readSpec(resolve('tests/scenes/catalog/polish-blood-ground.json'));
    const slam = readSpec(resolve('tests/scenes/catalog/telegraph-alpha-slam.json'));
    const rocket = readSpec(resolve('tests/scenes/l7-rocket/qa-l7-rocket-alpha.json'));
    blood.name = 'blood'; blood.time = 'L6'; blood.frames = 120; blood.sheet = 10;
    blood.shots = [0, 10, 20, 60, 120]; blood.camera = { mode: 'game', target: [0, 0], zoom: .5 };
    slam.name = 'slam'; slam.time = 'L10-night'; slam.frames = 75; slam.sheet = 5;
    rocket.name = 'pointblank-rocket'; rocket.time = 'L6'; rocket.actors![1].at = [2, 0]; rocket.frames = 100; rocket.sheet = 5;
    rocket.camera = { mode: 'game', target: [0, 0], zoom: 1 };
    rocket.shots = [0, 5, ...Array.from({ length: 15 }, (_, i) => i + 13), 30, 50, 100];
    for (const spec of [blood, slam, rocket]) {
      await session.open();
      const dir = `${out}/${spec.name}`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/spec.json`, JSON.stringify(spec, null, 2));
      const result = await runSpec(session, spec, { out: dir });
      writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2));
      console.log(`${spec.name}: ${result.pass ? 'pass' : 'FAIL'}`);
      await session.close();
    }
  } else if (mode === 'corpses') {
    for (const time of ['L4', 'L8-zoo'] as const) {
      await session.open();
      const spec: SceneSpec = { name: `corpse-pairs-${time}`, seed: 32, ground: 'grass', time, dof: false, size: 40,
        actors: [{ id: 'courier', kind: 'courier', at: [-7, 4], god: true },
          ...['npc.civilian-man-a', 'npc.civilian-woman-a', 'npc.national-guard'].flatMap((model, i) => [
            { id: `healthy-${i}`, kind: 'pedestrian' as const, at: [i * 3 - 3, -1] as [number, number], look: { model }, state: 'idle' as const },
            { id: `infected-${i}`, kind: 'pedestrian' as const, at: [i * 3 - 3, 2] as [number, number], look: { model }, state: 'idle' as const }])],
        camera: { mode: 'game', target: [0, 0], zoom: 1 }, trace: true };
      await session.load(spec);
      await session.page.evaluate('globalThis.__name = fn => fn');
      const identities = await session.page.evaluate(() => {
        const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game, w = game.world;
        const rows: unknown[] = [];
        for (let i = 0; i < 3; i++) lab.command(`infected-${i}`, { infect: { instant: true } });
        for (const e of w.entities.iterate()) if (e.id !== 1 && (e.civilian || e.infected)) {
          e.health.current = 0;
          // Healthy casualties retain the production NPC finished-state path;
          // only settled infected use the frozen-corpse flag.
          if (e.civilian) { e.civilian.state = 'finished'; e.civilian.entered = w.tick - 150; e.civilian.story = null; delete e.corpse; }
          if (e.infected) { e.infected.state = 'dead'; e.infected.deadAt = w.tick - 150; e.infected.recoverAt = -1; e.corpse = true; }
          if (e.locomotion) { e.locomotion.vx = 0; e.locomotion.vz = 0; }
          rows.push({ id: e.id, x: e.transform.x, z: e.transform.z, model: e.civilian?.model ?? e.appearance?.asset, faction: e.faction, infected: !!e.infected });
        }
        return rows;
      });
      await session.step(120); await session.ready();
      const dir = `${out}/${spec.name}`; mkdirSync(dir, { recursive: true });
      for (const zoom of [.5, 1, 1.5]) {
        await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: [0, 0], zoom }), zoom);
        await session.ready(); await session.screenshot(`${dir}/z${zoom}.png`);
      }
      writeFileSync(`${dir}/receipt.json`, JSON.stringify({ spec, identities, metrics: await session.metrics(), errors: session.errors }, null, 2));
      console.log(`${spec.name}: captured ${identities.length} bodies`);
      await session.close();
    }
  } else throw new Error(`Unknown mode ${mode}`);
} finally { await session.close(); stopServer(); }
