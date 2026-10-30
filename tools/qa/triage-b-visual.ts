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
const out = resolve(process.env.FIX_FLOW_OUT ?? `docs/reports/triage-b/captures/${label}-${backend}-${tier}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: mode === 'boarding' || mode === 'fix-flow' ? { ui: '1' } : {} });
try {
  if (mode === 'fix-flow') {
    await captureFixFlow();
  } else if (mode === 'variant') {
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

/** Matched production HUD and gameplay fixtures for the fix-flow brief; no campaign saves are written. */
async function captureFixFlow(): Promise<void> {
  const selected = process.env.FIX_FLOW_CASES?.split(',') ?? ['results', 'corridor', 'bus', 'apc', 'apc-wait', 'navigation', 'epilogue', 'shotgun', 'shotgun-native', 'corpses'];
  for (const name of selected) {
    await session.open();
    const dir = `${out}/${name}`; mkdirSync(dir, { recursive: true });
    if (name.startsWith('shotgun') || name === 'corpses') {
      const spec: SceneSpec = name.startsWith('shotgun') ? {
        name, seed: 1, ground: 'asphalt', time: 'L5', dof: false, size: 30,
        actors: [{ id: 'courier', kind: 'courier', at: [-3, 0], god: true, loadout: ['weapon.shotgun', 'weapon.fire-axe'], state: { attack: 'victim', seconds: .25, side: 'LEFT', inPlace: true } },
          { id: 'victim', kind: 'infected', at: [0, 0], archetype: 'infected.runner', state: 'idle', look: { model: 'npc.civilian-man-b' } }],
        camera: { mode: 'game', target: [0, 0], zoom: 1 }, frames: 40, trace: true, expect: { consoleErrors: 0 },
      } : {
        name, seed: 1, ground: 'asphalt', time: 'L4', dof: false, size: 30,
        actors: [{ id: 'courier', kind: 'courier', at: [-4, 3], god: true },
          { id: 'body', kind: 'infected', at: [0, 0], archetype: 'infected.runner', state: 'idle', look: { model: 'npc.civilian-man-b' } },
          { id: 'living', kind: 'infected', at: [3, 0], archetype: 'infected.runner', state: 'idle', look: { model: 'npc.civilian-woman-b' } },
          { id: 'large-living', kind: 'infected', at: [6, -4], archetype: 'infected.runner', state: 'idle' },
          { id: 'alpha', kind: 'infected', at: [3, -4], archetype: 'infected.alpha', state: 'idle' },
          { id: 'healthy', kind: 'pedestrian', at: [1, 4], look: { model: 'npc.civilian-man-b' }, state: 'idle' },
          { id: 'healthy-living', kind: 'infected', at: [4, 4], archetype: 'infected.runner', state: 'idle' }],
        camera: { mode: 'game', target: [0, 0], zoom: 1 }, expect: { consoleErrors: 0 },
      };
      if (name === 'shotgun-native') { delete spec.actors![1].look; spec.actors![1].archetype = 'infected.alpha'; }
      writeFileSync(`${dir}/fixture.json`, JSON.stringify(spec, null, 2));
      if (name.startsWith('shotgun')) {
        await session.page.evaluate(() => {
          const lab = window.__SCENE__!, load = lab.load.bind(lab), step = lab.step.bind(lab);
          const diagnostic = lab as typeof lab & { flowBuilds: { baseline: number; late: number } };
          diagnostic.flowBuilds = { baseline: 0, late: 0 };
          lab.load = async spec => { const result = await load(spec); await lab.ready(); diagnostic.flowBuilds = { baseline: window.__SS__!.perf().nodeBuilds, late: 0 }; return result; };
          lab.step = async frames => { const result = await step(frames); diagnostic.flowBuilds.late = window.__SS__!.perf().nodeBuilds - diagnostic.flowBuilds.baseline; return result; };
        });
        for (const zoom of [1, 1.5]) {
          spec.camera = { mode: 'game', target: [0, 0], zoom };
          await runSpec(session, spec, { out: `${dir}/z${zoom}`, shots: [6, 7, 10, 14, 40], sheet: 2 });
          const builds = await session.page.evaluate(() => (window.__SCENE__ as unknown as { flowBuilds: { baseline: number; late: number } }).flowBuilds);
          await session.step(140);
          const settled = await session.page.evaluate(() => (window.__SCENE__ as unknown as { flowBuilds: { baseline: number; late: number } }).flowBuilds);
          await session.screenshot(`${dir}/z${zoom}/settled.png`);
          writeFileSync(`${dir}/z${zoom}/builds.json`, JSON.stringify({ impact: builds, settled, throughFrame: 180 }));
        }
      } else {
        await session.load(spec);
        const builds = await session.page.evaluate(async () => {
          const lab = window.__SCENE__!;
          await lab.ready();
          const baseline = window.__SS__!.perf().nodeBuilds;
          const g = (lab as unknown as { game: Game }).game, actors = (await lab.metrics()).actors;
          const healthy = g.world.entities.get(actors.healthy.entity)!;
          healthy.health.current = 0; healthy.civilian!.state = 'finished'; healthy.civilian!.entered = g.world.tick;
          lab.command('body', { corpse: true }); lab.command('alpha', { corpse: true });
          await lab.step(180); await lab.ready();
          const feet = g.view.labProbes().drawnCorpses();
          for (const [dead, living] of [['body', 'living'], ['alpha', 'large-living'], ['healthy', 'healthy-living']]) {
            const body = feet.find(p => p.id === actors[dead].entity) ?? g.world.entities.get(actors[dead].entity)!.transform;
            let nearest = .05, center = { x: body.x, z: body.z };
            g.view.scene.traverse(node => {
              if (dead === 'healthy') return;
              const mesh = node as import('three').InstancedMesh;
              if (!mesh.instanceMatrix || !mesh.name.startsWith('corpses:')) return;
              mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox!;
              const c = [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2];
              const a = mesh.instanceMatrix.array;
              for (let i = 0; i < mesh.count; i++) { const o = i * 16, d = Math.hypot(a[o + 12] - body.x, a[o + 14] - body.z); if (d >= nearest) continue;
                nearest = d; center = { x: a[o] * c[0] + a[o + 4] * c[1] + a[o + 8] * c[2] + a[o + 12], z: a[o + 2] * c[0] + a[o + 6] * c[1] + a[o + 10] * c[2] + a[o + 14] };
              }
            });
            const live = g.world.entities.get(actors[living].entity)!;
            Object.assign(live.transform, center); live.combat!.staggerUntil = g.world.tick + 600;
          }
          g.world.tick++; g.view.update(1);
          return { baseline, late: window.__SS__!.perf().nodeBuilds - baseline };
        });
        for (const zoom of [1, 1.5]) {
          await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: [0, 0], zoom }), zoom);
          await session.screenshot(`${dir}/z${zoom}.png`);
        }
        writeFileSync(`${dir}/metrics.json`, JSON.stringify({ ...await session.metrics(), builds }, null, 2));
      }
    } else {
      const level = name === 'results' ? 'L6' : name.startsWith('apc') ? 'L8' : name === 'epilogue' || name === 'navigation' ? 'L10' : 'L7';
      const staged = await session.page.evaluate(async ({ level, name, tier }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier === 'low' ? 'low' : 'high' }); await a.loadLevel(level, { seed: 1 }); a.pause(); a.cheats.god(true);
        const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, m = w.missions!, s = m.state;
        g.ui.show(null);
        for (const step of Object.values(s.steps)) step.status = 'pending';
        s.phase = 'playing';
        if (name === 'results') {
          s.l6!.phase = 'done';
          s.l6!.survivors.forEach((r, i) => { r.status = i < 11 ? 'out' : 'dead'; });
          s.result = { ...s.stats, ...m.l6!.result() }; s.phase = 'result';
          const result = s.result;
          w.progression ??= { pickups: [] }; w.progression.campaign ??= {} as NonNullable<typeof w.progression>['campaign'];
          w.progression.campaign!.results = { L5: { ...result, rescued: 5, survivors: result.survivors!.slice(0, 5) }, L6: result };
        } else if (name === 'bus' || name === 'corridor') {
          const roster = w.l7Encounters!.state.roster;
          for (const r of roster.slice(3)) w.entities.get(r.id)!.hidden = true;
          roster.splice(3);
          const keys = ['shelter-0', 'dale', 'shelter-2'];
          const at = name === 'bus' ? (w.l7Departure as unknown as { door: { x: number; z: number } }).door : m.def.anchors['l7-corridor-east'];
          const ring = at ?? Object.values(m.def.anchors)[0];
          a.teleport(1, ring);
          roster.forEach((r, i) => { r.key = keys[i]; const e = w.entities.get(r.id)!; e.civilian!.survivor!.key = keys[i]; e.civilian!.survivor!.slot = i; Object.assign(e.transform, { x: ring.x + (name === 'corridor' ? 25 : 8) + i * 3, z: ring.z + 4 }); });
          s.steps[name === 'bus' ? 'departure' : 'corridor'].status = 'active';
        } else if (name.startsWith('apc')) {
          const zoo = m.l8!; s.steps.depart.status = 'active'; zoo.state.breachedAt = w.tick || 1;
          const ring = m.def.anchors.exit; a.teleport(1, ring);
          zoo.passengers().forEach((id, i) => { const e = w.entities.get(id)!; Object.assign(e.transform, { x: ring.x + 8 + i * 2, z: ring.z + 4 }); if (e.civilian?.survivor && i === 1) e.civilian.survivor.key = 'shelter-0'; });
          if (name === 'apc-wait') {
            s.steps.depart.status = 'pending'; zoo.state.breachedAt = 0; zoo.state.startedAt = w.tick - 360;
            w.vehicles!.active = zoo.state.carId; w.entities.get(zoo.state.carId)!.vehicle!.driver = 1;
          }
        } else if (name === 'navigation') {
          s.steps['dispersal-complex'].status = 'active'; s.steps['dispersal-complex'].started = w.tick - 360;
          a.teleport(1, { x: 3314.9, z: -90.9 });
        } else {
          s.steps.epilogue.status = 'active'; s.states['cure-released'] = true;
          m.l10!.cure.release(); s.cureFront!.elapsed = 30 * 60; s.cureFront!.radius = 300;
          s.epilogue = { phase: 'playable', phaseTicks: 0, survivors: [], approaching: [], groupsAuthored: true };
          a.teleport(1, m.def.anchors['cure-console']);
        }
        const active = m.def.steps.find(step => s.steps[step.id].status === 'active');
        s.marker = active?.anchor ?? null;
        document.documentElement.setAttribute('data-scene-hud', ''); document.querySelector('.hud')?.setAttribute('data-scene-hud', '');
        a.camera.follow(); g.view.update(1); g.ui.hud.update(); await a.screenshotReady();
        const ui = (g.view as unknown as { missionUI: { campaignSummary(): string } }).missionUI;
        const campaignSummary = name === 'results' ? ui.campaignSummary() : null;
        let summaryCases;
        if (name === 'results') {
          const campaign = w.progression!.campaign!, results = campaign.results, result = s.result!;
          campaign.results = { ...results, L2: { ...result, rescued: 3, survivors: undefined } };
          const withUnidentifiedEvents = ui.campaignSummary();
          campaign.results = { L2: { ...result, rescued: 3, survivors: undefined } }; s.result = { ...result, survivors: undefined };
          summaryCases = { withUnidentifiedEvents, withoutIdentities: ui.campaignSummary() };
          campaign.results = results; s.result = result;
        }
        const quality = a.getState().render.quality;
        if (quality !== tier) throw new Error(`HUD quality ${quality}, requested ${tier}`);
        return { level, quality, result: s.result ? { rescued: s.result.rescued, survivorsIn: s.result.survivorsIn, survivorsLost: s.result.survivorsLost, survivors: s.result.survivors } : null, campaignSummary, summaryCases };
      }, { level, name, tier });
      for (const zoom of [1, 1.5]) {
        await session.page.evaluate(zoom => { const a = window.__SS__!; a.camera.zoom(zoom); a.camera.follow(); }, zoom);
        await session.screenshot(`${dir}/z${zoom}.png`);
      }
      const hud = await session.page.evaluate(() => ({ tracker: document.querySelector('[data-testid=objective-text]')?.parentElement?.textContent, result: document.querySelector('[data-testid=mission-result]')?.textContent, cue: document.querySelector('.hud-pin-cue')?.outerHTML }));
      writeFileSync(`${dir}/receipt.json`, JSON.stringify({ staged, hud, errors: session.errors }, null, 2));
    }
    console.log(`${name}: captured ${tier}`);
    await session.close();
  }
}
