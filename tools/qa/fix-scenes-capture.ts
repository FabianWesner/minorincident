/** Q-262..267 / Q-269 review, using the original tour setup and authored game camera. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { prepareStop, readyFrame, tour } from './ab-tour';
import { debugCampaign, type Level } from '../../src/sim/progression/Campaign';
const side = process.env.FIX_SIDE ?? 'after';
const tier: 'low' | 'high' = process.env.FIX_TIER === 'high' ? 'high' : 'low';
const filter = (process.env.FIX_FILTER ?? 'hats,l3-army-pullback,l4-tank-hold,l5-finale,l6-start,l8-finale,bars').split(',');
const out = resolve(process.env.FIX_OUT ?? 'test-results/fix-scenes', side, tier);
mkdirSync(out, { recursive: true });
const receipt: unknown[] = [];
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
