/** Q-262..267 / Q-269 review, using the original tour setup and authored game camera. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { prepareStop, readyFrame, tour } from './ab-tour';
import { debugCampaign, type Level } from '../../src/sim/progression/Campaign';
const side = process.env.FIX_SIDE ?? 'after';
const tier: 'low' | 'high' = process.env.FIX_TIER === 'high' ? 'high' : 'low';
const filter = (process.env.FIX_FILTER ?? 'hats,l3-army-pullback,l4-tank-hold,l5-finale,l6-start,l8-finale,bars').split(',');
const out = resolve(process.env.FIX_OUT ?? 'test-results/fix-scenes', side, tier);
mkdirSync(out, { recursive: true });
const receipt: unknown[] = existsSync(out + '/receipt.json') ? JSON.parse(readFileSync(out + '/receipt.json', 'utf8')).filter((row: {name: string}) => !filter.includes(row.name)) : [];
let failed = false;
try {
  for (const name of filter) {
    const session = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 1280, height: 720 }, log: () => {} });
    try {
      console.log(`[fix-scenes] ${side}/${tier}/${name} loading`);
      await session.open(); await session.page.addInitScript('globalThis.__name = fn => fn'); await session.page.evaluate('globalThis.__name = fn => fn');
      let captureTarget: [number, number, number] | null = null;
      if (name === 'hats') {
        await session.load(readSpec(resolve('specs/scenes/catalog/ped-hats-glasses-close.json')));
        await session.step(30);
      } else if (name === 'bars') {
        await session.page.evaluate(async tier => {
          const a = window.__SS__!;
          a.settings.set({ quality: tier }); await a.loadLevel('L10', { seed: 1 }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
          const p = a.getState().player!.transform;
          for (let i = 0; i < 10; i++) (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.world.infected!.spawn('infected.dog', { x: p.x + 3 + (i % 4) * .9, z: p.z - 1.3 + Math.floor(i / 4) * .9 });
          await a.step(2);
        }, tier);
      } else {
        const stop = tour.find(s => s.id === name)!;
        if (!stop) throw new Error(`Unknown stop ${name}`);
        const save = debugCampaign(Number(stop.level.slice(1)) <= 4 ? 10 : Number(stop.level.slice(1)) as Level, null);
        save.settings.quality = tier; save.seed = 1; save.character = 'female';
        const proof = await session.page.evaluate(prepareStop, { stop, seed: 1, save, zoom: 1, tier });
        receipt.push({ name, proof }); captureTarget = proof.target;
        if (name === 'l3-army-pullback') {
          const formation = await session.page.evaluate(async ({protect, stage}) => {
            const a = window.__SS__!, g = (window.__SCENE__ as unknown as {game: import('../../src/Game').Game}).game;
            if (stage) {
              a.cheats.killAll(); // Isolate resting formation from hostile knockback; retain every corpse.
              const members = [...g.world.entities.iterate()].filter(e => e.civilian?.ally?.follow && e.health.current > 0 && !e.infection);
              members.sort((a, b) => Math.hypot(a.transform.x - 174, a.transform.z) - Math.hypot(b.transform.x - 174, b.transform.z));
              const template = members[0]; if (!template) throw new Error('No living officer to stage');
              while (members.length < 12) {
                const id = g.world.npcs!.civilians.spawn('officer', {x:168.3,z:-1.2}, {model:template.civilian!.model,waypoints:[{x:168.3,z:-1.2}]}, false);
                const e = g.world.entities.get(id)!; e.civilian!.ally = structuredClone(template.civilian!.ally!); e.civilian!.l1 = structuredClone(template.civilian!.l1!); e.appearance = structuredClone(template.appearance); if(e.appearance)e.appearance.entityId=id; e.faction = template.faction; members.push(e);
              }
              members.forEach((e, i) => { Object.assign(e.transform, {x:168.3 + i % 4 * .6,z:-1.2 + Math.floor(i / 4) * .8,y:6.4}); const c=e.civilian!;c.floorY=5.7;c.state='calm';c.story=null;c.ally!.targetId=0;c.ally!.run=null;c.ally!.follow!.slot=i;g.world.spatial.set(e.id,e.transform.x,e.transform.z); });
            }
            if (protect) for (const e of g.world.entities.iterate()) if (e.civilian?.ally?.follow && e.health.current > 0) e.health.current = e.health.max = 100000;
            const npcs = g.world.npcs!, move = npcs.move, goals = new Map<number, {x:number;z:number}>();
            npcs.move = function(e, target, ...rest) { if (e.civilian?.ally?.follow) goals.set(e.id, {x:target.x,z:target.z}); return move.call(this, e, target, ...rest); };
            try { await a.step(stage ? 600 : 180); } finally { npcs.move = move; }
            return { protected: protect, staged: stage, goals: [...goals], members: [...g.world.entities.iterate()].filter(e => e.civilian?.ally?.follow).map(e => ({id:e.id,at:e.transform,hp:e.health.current})) };
          }, {protect:process.env.FIX_PROTECT_SQUAD === '1',stage:process.env.FIX_STAGE_SQUAD === '1'});
          receipt.push({name, formation});
        }
      }
      for (const zoom of [1, 1.5]) {
        await session.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom);
        const state = await session.page.evaluate(readyFrame, { target: captureTarget, zoom, ticks: 0, stopId: name });
        await session.ready();
        await session.page.evaluate(async () => { const g = (window.__SCENE__ as unknown as {game: import('../../src/Game').Game}).game; g.view.renderer.nextNodeFrame(); g.view.update(1); await g.view.renderer.finishWarmUp(); });
        await session.page.screenshot({ path: `${out}/${name}-z${zoom}.jpg`, type: 'jpeg', quality: 86 });
        const audit = await session.page.evaluate(() => {
          const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
          const civilians = [...g.world.entities.iterate()].filter(e => e.civilian?.ally || e.civilian?.survivor).map(e => ({ id: e.id, at: e.transform, hidden: e.hidden, state: e.civilian?.state, ally: e.civilian?.ally, passengerOf: e.passengerOf }));
          const transparent: unknown[] = [], crowdMaterials: unknown[] = [];
          g.view.scene.traverse(node => { const mesh = node as import('three').Mesh; if (mesh.isMesh && mesh.visible) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m.transparent || m.opacity < 1) transparent.push({ name: node.name, material: m.name, opacity: m.opacity }); });
          g.view.scene.traverse(node => { const m = node as import('three').Mesh; if (m.isMesh && m.geometry.hasAttribute('_clip_frame')) for (const material of Array.isArray(m.material) ? m.material : [m.material]) crowdMaterials.push({ name: node.name, transparent: material.transparent, opacity: material.opacity, depthWrite: material.depthWrite, fade: (material as unknown as {fade?: {value:number}}).fade?.value }); });
          const hatMatrices: unknown[] = []; g.view.scene.traverse(node => { const m = node as import('three').InstancedMesh; if (m.isInstancedMesh && node.name.startsWith('acc.hat') && m.count) hatMatrices.push({ name: node.name, matrices: Array.from(m.instanceMatrix.array).slice(0, m.count * 16) }); }); return { crowdMaterials, hatMatrices, civilians, transparent, corpseLayout: a.debug.corpseLayout(), builds: a.perf().nodeBuildMaterials, hud: document.querySelector('.mission-objective')?.textContent, mission: a.missions.state(), render: a.getState().render };
        });
        receipt.push({ name, zoom, state, audit });
        if (name === 'bars' && side === 'after' && (audit.render.healthBars?.count ?? 0) > 5) failed = true;
      }
      if (name === 'hats') {
        await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as {game: import('../../src/Game').Game}).game; g.view.scene.traverse(node => { const m = node as import('three').Mesh; if (m.isMesh && node.name.startsWith('acc.')) for (const material of Array.isArray(m.material) ? m.material : [m.material]) material.visible = false; }); });
        await session.ready(); await session.page.screenshot({path: out + '/hats-no-accessories.jpg',type:'jpeg'});
      }
      const warm = await session.page.evaluate(() => ({ ...window.__SS__!.perf().nodeBuildMaterials }));
      await session.page.evaluate(async () => { await window.__SS__!.step(120); await window.__SS__!.screenshotReady(); });
      const late = await session.page.evaluate(warm => Object.entries(window.__SS__!.perf().nodeBuildMaterials).filter(([key, n]) => n > (warm[key] ?? 0)), warm);
      receipt.push({ name, lateBuilds: late, errors: session.errors });
      if (late.length || session.errors.length) failed = true;
      if (name === 'l8-finale') {
        await session.page.evaluate(async () => { await window.__SS__!.step(1800); await window.__SS__!.screenshotReady(); });
        const boarding = await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as {game: import('../../src/Game').Game}).game, zoo = g.world.missions!.l8!; return { complete: g.world.vehicles!.groupBoarded(zoo.state.carId, zoo.passengers()), count: zoo.passengers().length }; });
        receipt.push({ name, boarding }); if (!boarding.complete) failed = true;
        await session.page.screenshot({path: out + '/l8-queue-settled.jpg', type:'jpeg', quality:86});
      }
      console.log(`[fix-scenes] ${side}/${tier}/${name} captured; late builds=${late.length}, errors=${session.errors.length}`);
    } catch (error) {
      failed = true; receipt.push({ name, error: String(error), errors: session.errors });
      console.error(`[fix-scenes] ${side}/${tier}/${name} FAIL ${String(error).slice(0, 300)}`);
    } finally { await session.close(); writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2)); }
  }
} finally { stopServer(); }
process.exitCode = failed ? 1 : 0;
