/** Dedicated QA lane: serial real RAF ground review; no gameplay modifications. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';

const [backend = 'webgpu', tier = 'high', level = 'l9'] = process.argv.slice(2);
const key = `${level}-${backend}-${tier}`;
const out = 'docs/reports/qa-browser/flicker';
const raw = `/private/tmp/qa-browser-flicker/${key}`;
mkdirSync(out, { recursive: true }); mkdirSync(raw, { recursive: true });
const session = new SceneSession({ backend: backend as 'webgpu' | 'webgl2', tier: tier as 'high' | 'low', seed: 1 });
const receipt: Record<string, unknown> = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), backend, tier, level };
try {
  await session.open();
  await session.load(JSON.parse(readFileSync(`docs/reports/r12-l9flicker/${level === 'l9' ? 'l9-start' : 'l10-campus'}.json`, 'utf8')));
  if (level === 'l9') await session.step(1170);
  else { await session.page.evaluate(() => { window.__SCENE__.game.world.tick = 38160; }); await session.step(1); }
  await session.ready();
  receipt.state = await session.page.evaluate(() => window.__SS__!.getState().render);
  const state = receipt.state as { backend: string; quality: string };
  if (state.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl') || state.quality !== tier) throw Error(`Wrong renderer/tier: ${state.backend}/${state.quality}`);
  const camera = (receipt.state as { camera: { position: number[]; target: number[] } }).camera;
  receipt.effectiveZoom = Math.hypot(...camera.position.map((v, i) => v - camera.target[i])) / 19;
  receipt.depth = await session.page.evaluate(() => {
    const rows: unknown[] = [];
    window.__SCENE__.game.view.districts.parts.terrain.traverse(o => { if (o.isMesh) rows.push({ name: o.name, layer: o.material.userData.groundLayer, bias: o.material.polygonOffsetUnits, enabled: o.material.polygonOffset }); });
    return rows;
  });
  receipt.trackHits = await session.page.evaluate(async () => {
    const { Raycaster, Vector2 } = await import('/node_modules/three/build/three.webgpu.js');
    const view = window.__SCENE__.game.view, ray = new Raycaster(), meshes = [];
    ray.setFromCamera(new Vector2(220 / 1280 * 2 - 1, 1 - 660 / 720 * 2), view.camera);
    view.scene.traverse(o => { if (o.isMesh) { for (let p = o; p; p = p.parent) if (!p.visible) return; meshes.push(o); } });
    return ray.intersectObjects(meshes, false).slice(0, 8).map(h => ({ point: h.point.toArray(), name: h.object.name, layer: h.object.material.userData.groundLayer, bias: h.object.material.polygonOffsetUnits, enabled: h.object.material.polygonOffset }));
  });
  const frames = await session.page.evaluate(async ({ level }) => {
    const api = window.__SS__!, canvas = document.querySelector('canvas')!, frames = [];
    const at = level === 'l9' ? [-550, 0] : [2363.99, -75.39]; api.resume();
    for (let i = 0; i < 30; i++) {
      if (i === 15) {
        // Apply a small camera translation without setCamera's immediate extra
        // render, so the 30 RAF samples remain consecutive rendered frames.
        window.__SCENE__.camera = { mode: 'game', target: [at[0] + .15, at[1] + .1], zoom: level === 'l9' ? 1.14 : 1.3 };
        window.__SCENE__.applyCamera();
      }
      const now = await new Promise<number>(requestAnimationFrame);
      frames.push({ now, tick: api.tick(), rendered: api.perf().renderedFrames, jpeg: canvas.toDataURL('image/jpeg', .8).split(',')[1] });
    }
    api.pause(); return frames;
  }, { level });
  frames.forEach((f, i) => writeFileSync(`${raw}/frame-${String(i).padStart(2, '0')}.jpg`, Buffer.from(f.jpeg, 'base64')));
  receipt.frames = frames.map(({ jpeg: _jpeg, ...frame }) => frame);
  receipt.consecutive = frames.every((f, i) => !i || f.rendered === frames[i - 1].rendered + 1);
  const sites = level === 'l9' ? [[-550,7],[-450,0],[450,0],[-350,-330],[350,-330],[-300,240],[300,240],[-250,-30],[250,-30],[-365,-306],[-1,-337],[-9,-322],[182,-322],[271,-322],[-1,-342],[269,-318],[-379,132],[-232,250]] : [[2364,-75],[2250,-70],[2450,-70],[3740,-33],[3906,-39]];
  receipt.corners = [];
  for (const [i, [x, z]] of sites.entries()) {
    await session.page.evaluate(({ x, z, zoom }) => { window.__SS__!.teleport('player', { x, z }); window.__SCENE__.setCamera({ mode: 'game', target: [x, z], zoom }); }, { x, z, zoom: level === 'l9' ? 1.14 : 1.3 });
    await session.step(2); await session.ready();
    writeFileSync(`${raw}/corner-${i}.jpg`, await session.snapshot());
    (receipt.corners as unknown[]).push({ x, z, file: `corner-${i}.jpg` });
  }
  receipt.perf = await session.page.evaluate(() => window.__SS__!.perf());
  if (level === 'l10') {
    await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 1, checkpoint: 'cure-military', progression: 'L10-default' }); a.pause(); a.bot.stop(); a.camera.follow(); a.camera.zoom(1.3); a.missions.begin(); });
    await session.page.addStyleTag({ content: '#hud,.hud,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:visible!important}' });
    await session.ready();
    receipt.mission = await session.page.evaluate(() => ({ tick: window.__SS__!.tick(), mission: window.__SS__!.missions.state(), player: window.__SS__!.getEntity(1)!.transform, render: window.__SS__!.getState().render.backend }));
    writeFileSync(`${raw}/mission-checkpoint.jpg`, await session.snapshot());
  }
  console.log(`${key}: captured 30 RAF frames and ${sites.length} corners`);
} catch (error) { receipt.error = String(error); console.error(error); process.exitCode = 1; }
finally { receipt.errors = session.errors; writeFileSync(`${out}/${key}.json`, JSON.stringify(receipt, null, 2)); await session.close(); stopServer(); }
