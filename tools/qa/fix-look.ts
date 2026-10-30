/** Matched visual receipts for the fix-look brief. Shared headless browser leases. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';

const [label = 'before', tierArg = 'high', only = 'all'] = process.argv.slice(2);
const tier = tierArg === 'low' ? 'low' : 'high';
const root = `docs/reports/fix-look/captures/${label}-${tier}`;
const wanted = (id: string) => only === 'all' || only.split(',').includes(id);
const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1280, height: 720 } });
const rows: unknown[] = [];
async function shots(id: string, camera?: SceneSpec['camera']) {
  const dir = `${root}/${id}`; mkdirSync(dir, { recursive: true });
  await session.ready();
  await session.page.evaluate(() => {
    const w = window as unknown as { __fixLookBuilds: number; __fixLookWrapped?: boolean };
    w.__fixLookBuilds = 0;
    if (!w.__fixLookWrapped) {
      for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const compile = type.prototype.compileShader;
        type.prototype.compileShader = function(shader) { w.__fixLookBuilds++; return compile.call(this, shader); };
      }
      w.__fixLookWrapped = true;
    }
  });
  const cells = [];
  for (const zoom of [1, 1.5]) {
    await session.page.evaluate(async ({ zoom, camera }) => {
      const a = window.__SS__!;
      if (camera) a.camera.follow();
      a.camera.zoom(zoom);
      if (camera) window.__SCENE__!.setCamera(camera.mode === 'game' || camera.mode === 'follow' ? { ...camera, zoom } : camera);
      await a.step(1); await a.screenshotReady();
    }, { zoom, camera });
    const jpeg = await session.snapshot(); writeFileSync(`${dir}/z${zoom}.jpg`, jpeg);
    cells.push({ frame: zoom * 10, jpeg });
    rows.push({ id, zoom, errors: [...session.errors], state: await session.page.evaluate(id => {
      const a = window.__SS__!, p = a.perf();
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const light = (game.view as unknown as { lighting: Lighting }).lighting;
      return { camera: a.getState().render.camera, quality: a.getState().render.quality,
        rim: light.rim.value, corpseRim: light.corpseRim.value,
        ...(id === 'q145' ? { metro: game.world.missions?.state.l5,
          followers: [...game.world.entities.iterate()].filter(e => e.civilian?.survivor).map(e => ({ id: e.id, at: e.transform, mode: e.civilian!.survivor!.mode })) } : {}),
        perf: { backend: p.backend, drawCalls: p.drawCalls, triangles: p.triangles },
        shaderBuildsAfterWarmup: (window as unknown as { __fixLookBuilds: number }).__fixLookBuilds };
    }, id) });
  }
  await session.makeSheet(cells, `${dir}/sheet.jpg`, 640, 500);
  console.log(`${label} ${tier} ${id}: captured`);
}
async function fixture(id: string, file: string, frames: number, amend?: (s: SceneSpec) => void) {
  if (!wanted(id)) return;
  await session.open();
  const spec = readSpec(file); amend?.(spec);
  await session.load(spec);
  if (id === 'q215' && label === 'before') await session.page.evaluate(async () => {
    const path = '/src/data/timeOfDay.ts';
    const { timeOfDay } = await import(path) as { timeOfDay: { L5: { rim: number } } };
    timeOfDay.L5.rim = .25;
    ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting.rim.value = .25;
  });
  if (id === 'q175') await session.page.evaluate(() => window.__SCENE__!.command('animal', { special: 'zebra.kick', target: 'courier' }));
  await session.step(frames); await shots(id, spec.camera); await session.close();
}
try {
  for (const [id, level] of [['q35', 'L5'], ['q142', 'L7']] as const) if (wanted(id)) {
    await session.open();
    await session.page.evaluate(async level => {
      const a = window.__SS__!; await a.loadLevel(level, { seed: 1 }); a.pause();
      a.missions.begin(); a.pause(); a.cheats.god(true); a.camera.follow(); await a.step(11);
    }, level);
    await shots(id); await session.close();
  }
  await fixture('q92', 'specs/scenes/catalog/qa-l3-ramp-west.json', 40);
  await fixture('q92-east', 'specs/scenes/catalog/qa-l3-ramp-east.json', 40);
  await fixture('q35-l4', 'specs/scenes/catalog/dress-l8-cellar-l4.json', 60, s => { s.camera = { mode: 'game', target: 'courier', zoom: 1 }; });
  await fixture('q145', 'tests/scenes/catalog/l5-po-metro-ingress.json', 330);
  await fixture('q215', 'specs/scenes/qa-l5-group.json', 90, s => {
    s.camera = { mode: 'game', target: 'courier', zoom: 1 }; s.weather = 'fog'; s.weatherWarmup = 60;
  });
  for (const time of ['L4', 'L8-zoo', 'L10-night'] as const) if (wanted('q247')) {
    await session.open();
    const spec: SceneSpec = { name: `q247-${time}`, seed: 32, ground: 'grass', time, dof: false, size: 40,
      actors: [{ id: 'courier', kind: 'courier', at: [-7, 4], god: true },
        ...['npc.civilian-man-a', 'npc.civilian-woman-a', 'npc.national-guard'].flatMap((model, i) => [
          { id: `healthy-${i}`, kind: 'pedestrian' as const, at: [i * 3 - 3, -1] as [number, number], look: { model }, state: 'idle' as const },
          { id: `infected-${i}`, kind: 'pedestrian' as const, at: [i * 3 - 3, 2] as [number, number], look: { model }, state: 'idle' as const }])],
      camera: { mode: 'game', target: [0, 0], zoom: 1 } };
    await session.load(spec);
    if (label === 'before') await session.page.evaluate(() => {
      ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting.corpseRim.value = 0;
    });
    await session.page.evaluate(() => {
      const lab = window.__SCENE__!, w = (lab as unknown as { game: Game }).game.world;
      for (let i = 0; i < 3; i++) lab.command(`infected-${i}`, { infect: { instant: true } });
      for (const e of w.entities.iterate()) if (e.id !== 1 && (e.civilian || e.infected)) {
        e.health.current = 0;
        if (e.civilian) { e.civilian.state = 'finished'; e.civilian.entered = w.tick - 150; e.civilian.story = null; delete e.corpse; }
        if (e.infected) { e.infected.state = 'dead'; e.infected.deadAt = w.tick - 150; e.infected.recoverAt = -1; e.corpse = true; }
        if (e.locomotion) { e.locomotion.vx = 0; e.locomotion.vz = 0; }
      }
    });
    await session.step(120); await shots(`q247-${time}`, spec.camera); await session.close();
  }
  if (wanted('q248')) {
    // Full district generation keeps placement rejection identical to actual play.
    await session.open();
    await session.page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
      a.missions.begin(); a.pause(); a.cheats.god(true); a.camera.follow();
    });
    for (const [i, at] of [[640, 0], [930, 80], [1560, 100], [2150, -75], [2700, 45]].entries()) {
      await session.page.evaluate(async at => {
        const a = window.__SS__!; a.teleport('player', { x: at[0], z: at[1] }); a.camera.follow(); await a.step(240);
      }, at);
      await shots(`q248-r${i + 1}`);
    }
    await session.close();
  }
  await fixture('q175', 'tests/scenes/zoo-s3/qa-zoo-zebra-kick.json', 90, s => { s.camera = { mode: 'game', target: 'animal', zoom: 1 }; });
  if (wanted('q175')) {
    await session.open();
    const spec = readSpec('tests/scenes/zoo-s3/qa-zoo-zebra-kick.json');
    spec.camera = { mode: 'close', target: 'animal', radius: 3, azimuth: 45 };
    await session.load(spec);
    await session.page.evaluate(() => window.__SCENE__!.command('animal', { special: 'zebra.kick', target: 'courier' }));
    const cells = []; const dir = `${root}/q175-close`; mkdirSync(dir, { recursive: true });
    for (let frame = 0; frame <= 180; frame += 10) {
      if (frame) await session.step(10);
      const jpeg = await session.snapshot(); cells.push({ frame, jpeg });
      writeFileSync(`${dir}/f${frame}.jpg`, jpeg);
    }
    await session.makeSheet(cells, `${dir}/sheet.jpg`, 400, 1000); await session.close();
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/receipt-${only}.json`, JSON.stringify({ label, tier, rows, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
