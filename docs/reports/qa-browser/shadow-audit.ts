/** Manual headless native-backend shadow audit. Keeps one labelled sheet and a compact receipt. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer, type Backend } from '../../../tools/scenelab/session';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { launchBrowser } from '../../../tools/browser-pool/client';
import type { Game } from '../../../src/Game';
import type { Lighting } from '../../../src/render/Lighting';
import type { FieldLight } from '../../../src/render/LightField';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';

const out = 'docs/reports/qa-browser/shadow', scratchPath = '/private/tmp/qa-browser-shadow-cells.json';
const resume = process.env.R12_RESUME === '1' && existsSync(`${out}/measurements.json`);
const previous = resume ? JSON.parse(readFileSync(`${out}/measurements.json`, 'utf8')) as { rows: object[]; failures: string[]; completed?: string[] } : undefined;
const cells: { label: string; jpeg: string }[] = resume && existsSync(scratchPath) ? JSON.parse(readFileSync(scratchPath, 'utf8')) : [];
const rows: object[] = previous?.rows ?? [];
const completed = previous?.completed ?? [];
mkdirSync(out, { recursive: true });
const baselineRef = 'a0d4f7ba^';
const original = execFileSync('git', ['show', `${baselineRef}:src/render/Lighting.ts`], { encoding: 'utf8' });
const ast = ts.createSourceFile('Lighting.ts', original, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(ts.isClassDeclaration)!;
const methods = declaration.members.filter(ts.isMethodDeclaration).filter(m => ['setHeroLight', 'setShadowSource'].includes(m.name.getText(ast)));
const baseline = ts.transpileModule(`class Baseline { ${methods.map(m => ts.createPrinter().printNode(ts.EmitHint.Unspecified, m, ast)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nreturn Baseline;';
const fixture: SceneSpec = { name: 'shadow-dominance', seed: 1, time: 'night', ground: 'asphalt', size: 42, dof: false,
  props: [{ id: 'weak', asset: 'prop.street-lamp', at: [-4, -1] }, { id: 'strong', asset: 'prop.street-lamp', at: [4, 1] }],
  actors: [{ id: 'courier', kind: 'courier', at: [-2, 0], yaw: 135 }, { id: 'corgi', kind: 'corgi', at: [-1, 2] }, { id: 'nearby', kind: 'infected', archetype: 'infected.runner', at: [1, -2], state: 'idle' }],
  camera: { mode: 'game', target: 'courier', zoom: 1 } };
const lin = (v: number) => v <= 10 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
const lum = (p: PNG, x: number, y: number) => { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return .2126 * lin(p.data[i]) + .7152 * lin(p.data[i + 1]) + .0722 * lin(p.data[i + 2]); };
const hue = (c: number[]) => {
  const hi = Math.max(...c), lo = Math.min(...c), d = hi - lo;
  if (!d) return 0;
  const sector = hi === c[0] ? (c[1] - c[2]) / d : hi === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  return (sector * 60 + 360) % 360;
};
const failures: string[] = previous?.failures ?? [];
let session: SceneSession | undefined;
let alternateBrowser: import('@playwright/test').Browser | undefined;
async function capture(s: SceneSession, label: string, sheet = true) {
  await s.ready();
  const r = await s.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, l = (g.view as unknown as { lighting: Lighting }).lighting;
    g.view.renderer.nextNodeFrame(); g.view.update(1);
    const profile = Object.entries(g.view.renderer.profile ?? {}).filter(([k]) => k !== 'shadows');
    const thumb = document.createElement('canvas'); thumb.width = 320; thumb.height = 188;
    thumb.getContext('2d')!.drawImage(g.view.renderer.domElement, 260, 100, 760, 500, 0, 0, 320, 188);
    return { png: g.view.renderer.domElement.toDataURL('image/png').split(',')[1], tick: g.world.tick, perf: window.__SS__!.perf().lighting,
      thumbnail: thumb.toDataURL('image/jpeg', .72).split(',')[1],
      draws: profile.reduce((sum, [, v]) => sum + v.drawCalls, 0), triangles: profile.reduce((sum, [, v]) => sum + v.triangles, 0),
      selected: l.heroLight, position: l.spot.position.toArray(), target: l.spot.target.position.toArray(), sunWeight: l.sun.shadow.intensity, spotWeight: l.spot.shadow.intensity,
      refreshed: Number(l.sun.visible && l.sun.shadow.autoUpdate) + Number(l.spot.visible && l.spot.shadow.autoUpdate), backend: g.view.renderer.selectedBackend,
      level: g.world.scenario, preset: l.preset, quality: window.__SS__!.getState().render.quality, zoom: window.qaNativeMoon ? g.view.view.getState().targetZoom : window.__SCENE__.camera.zoom, rigZoom:g.view.view.getState().targetZoom, camera:g.view.view.getState() };
  });
  const { png, thumbnail, ...receipt } = r;
  rows.push({ label, ...receipt });
  if (r.refreshed > 1) failures.push(`${label}: two refreshed maps`);
  if (r.backend !== (s.options.backend === 'webgpu' ? 'webgpu' : 'webgl')) failures.push(`${label}: backend fallback to ${r.backend}`);
  if (r.draws > (s.options.tier === 'high' ? 600 : 300) || r.triangles > (s.options.tier === 'high' ? 1_500_000 : 500_000)) failures.push(`${label}: E18 geometry budget exceeded`);
  if (sheet) cells.push({ label, jpeg: thumbnail });
  return PNG.sync.read(Buffer.from(png, 'base64'));
}
async function writeSheet(s: SceneSession) {
  const scratch = await s.page.context().newPage();
  try {
    const b64 = await scratch.evaluate(async cells => {
      const canvas = document.createElement('canvas'), cols = 4, w = 320, h = 210;
      canvas.width = cols * w; canvas.height = Math.ceil(cells.length / cols) * h;
      const g = canvas.getContext('2d')!; g.fillStyle = '#10151e'; g.fillRect(0, 0, canvas.width, canvas.height);
      for (const [i, cell] of cells.entries()) {
        const img = new Image(); img.src = `data:image/jpeg;base64,${cell.jpeg}`; await img.decode();
        const x = i % cols * w, y = Math.floor(i / cols) * h;
        g.drawImage(img, x, y + 22, w, h - 22);
        g.fillStyle = '#ffe9ac'; g.font = '12px monospace'; g.fillText(cell.label, x + 5, y + 15);
      }
      let quality = .78, url = canvas.toDataURL('image/jpeg', quality);
      while (url.length * .75 > 380 * 1024 && quality > .3) { quality -= .08; url = canvas.toDataURL('image/jpeg', quality); }
      return url.split(',')[1];
    }, cells);
    writeFileSync(`${out}/shadow-sheet.jpg`, Buffer.from(b64, 'base64'));
  } finally { await scratch.close(); }
}
try {
  for (const backend of (process.env.R12_BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[]) for (const tier of (process.env.R12_TIERS ?? 'high,low').split(',') as ('high' | 'low')[]) {
    const s = session = new SceneSession({ backend, tier });
    if (process.env.R12_CHROME === '1') alternateBrowser = await launchBrowser({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    await s.open(alternateBrowser);
    await s.page.evaluate('globalThis.__name = fn => fn');
    await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game, reset = g.clock.reset.bind(g.clock); g.clock.reset = () => { reset(); g.clock.pause(); }; g.clock.resume = () => {}; g.clock.pause(); });
    for (const phase of backend === 'webgl2' && tier === 'high' ? ['before', 'after'] : ['after']) {
      await s.load(fixture);
      await s.page.evaluate(({ baseline, presets, phase }) => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, l = (g.view as unknown as { lighting: Lighting }).lighting, q = l as unknown as Record<string, unknown>;
        if (phase === 'before') {
          const C = new Function('timeOfDay', baseline)(presets) as { prototype: Record<string, unknown> };
          q.qaRestore = { setHeroLight: q.setHeroLight, setShadowSource: q.setShadowSource };
          for (const name of ['setHeroLight', 'setShadowSource']) q[name] = C.prototype[name];
          for (const name of ['promotionPosition', 'promotionTarget', 'heroTarget']) q[name] = l.spot.position.clone();
        }
        const lights = (l.field as unknown as { statics: FieldLight[] }).statics;
        const right = lights.find(v => v.x > 0)!;
        if (!right?.id || lights.length !== 2) throw Error('Expected two native street-lamp pools');
        right.r *= 2.5; right.g *= 2.5; right.b *= 2.5;
        l.set('night');
      }, { baseline, presets: timeOfDay, phase });
      await s.step(60);
      const walk = await s.page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, l = (g.view as unknown as { lighting: Lighting }).lighting;
        const start = g.world.entities.get(1)!.transform.x, frames: { id: string | null; sun: number; spot: number; maps: number }[] = [];
        for (let frame = 0; frame < 60; frame++) {
          g.world.setInput({ move: { x: 1, z: 0 }, walk: true }); g.world.update(); g.view.advance(1 / 60); g.view.renderer.nextNodeFrame(); g.view.update(1);
          frames.push({ id: l.heroLight, sun: l.sun.shadow.intensity, spot: l.spot.shadow.intensity, maps: Number(l.sun.visible && l.sun.shadow.autoUpdate) + Number(l.spot.visible && l.spot.shadow.autoUpdate) });
          if (frame % 10 === 0) await new Promise<void>(r => requestAnimationFrame(() => r()));
        }
        g.world.setInput({ move: { x: 0, z: 0 } });
        return { start, end: g.world.entities.get(1)!.transform.x, frames };
      });
      rows.push({ label: `${phase} ${backend}/${tier} real walk`, ...walk });
      if (walk.end - walk.start < 1.9 || walk.frames.some(f => f.maps > 1)) failures.push(`${phase} ${backend}/${tier}: walk or map budget failed`);
      await s.step(30);
      for (const zoom of [1, 1.5]) {
        await s.page.evaluate(zoom => { if(!window.qaNativeMoon) window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom}); else window.__SS__!.camera.zoom(zoom); }, zoom);
        const label = `${phase} ${backend}/${tier} z${zoom}`;
        const beauty = await capture(s, label);
        {
          const selected = rows.at(-1) as { position: number[]; refreshed: number };
          if (phase === 'after' && (selected.position[0] < 0 || selected.refreshed !== 1)) failures.push(`${label}: dominant right lamp not active`);
          const points = await s.page.evaluate(() => { const hero = (window.__SCENE__ as unknown as { game: Game }).game.world.entities.get(1)!.transform; return [-1, 1].map(side => Array.from({ length: 25 }, (_, i) => { const d = 1 + Math.floor(i / 5) * .4, across = (i % 5 - 2) * .15; return window.__SCENE__!.project([hero.x + side * d * .9701 - across * .2425, .03, hero.z + side * d * .2425 + across * .9701]); })); });
          await s.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.view.labProbes().character!.traverse(o => { o.userData.r12Cast = o.castShadow; o.castShadow = false; }));
          const absent = await capture(s, `${label} no-caster`, false);
          await s.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.view.labProbes().character!.traverse(o => { o.castShadow = o.userData.r12Cast; delete o.userData.r12Cast; }));
          const darkness = points.map(mask => mask.reduce((v, p) => v + Math.max(0, 1 - lum(beauty, p.x, p.y) / Math.max(.001, lum(absent, p.x, p.y))), 0) / mask.length);
          const qualified = points[0].filter(p => 1 - lum(beauty, p.x, p.y) / Math.max(.001, lum(absent, p.x, p.y)) >= .35);
          const shadowHue = qualified.length ? hue([0, 1, 2].map(c => qualified.reduce((sum, p) => sum + beauty.data[(Math.round(p.y) * beauty.width + Math.round(p.x)) * 4 + c], 0) / qualified.length)) : null;
          rows.push({ label: `${label} ground shadow`, away: darkness[0], towards: darkness[1], qualifyingPixels: qualified.length, shadowHue });
          if (phase === 'after' && !(darkness[0] > darkness[1] + .05)) failures.push(`${label}: shadow does not point away from right lamp`);
          if (phase === 'after' && (shadowHue === null || shadowHue < 230 || shadowHue > 290)) failures.push(`${label}: E25 shadow hue outside 230–290 degrees`);
        }
      }
      if (phase === 'before') await s.page.evaluate(() => { const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting as unknown as Record<string, unknown>; Object.assign(l, l.qaRestore); delete l.qaRestore; });
    }
    if (backend === 'webgl2' && process.env.R12_MATRIX !== '0') {
      await s.load({ name: 'forty-lights', size: 300, ground: 'asphalt', time: 'night', dof: false, actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'follow', actor: 'courier', zoom: 1 } });
      await s.ready();
      const walk = await s.page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game, l = (g.view as unknown as { lighting: Lighting }).lighting;
        const fields: FieldLight[] = Array.from({ length: 40 }, (_, i) => ({ id: `walk-${i}`, x: i * 3, y: 3.4, z: 3.5, radius: 5, aimX: 0, aimZ: 0, stretch: 1, r: 1, g: .9, b: .7, on: true, hero: true, flicker: 0, strobe: false, seed: i }));
        for (const f of fields) g.world.lightPower!.register({ id: f.id!, group: 'walk', x: f.x, y: f.y!, z: f.z, range: 10, breakable: true }, true);
        l.field.setStatic(fields); l.set('night');
        const gl = (g.view.renderer.backend as unknown as { gl: WebGL2RenderingContext }).gl, pixel = new Uint8Array(16);
        const width = g.view.renderer.domElement.width, height = g.view.renderer.domElement.height;
        const linear = (v: number) => v <= 10 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
        const previous = new Map<number, { frame: number; value: number }>(), changes: number[] = [], fades: number[] = [];
        let maxDelta = 0, maps = 0, lastId: string | null = null, fadeAt = -1, maxChangesPerSecond = 0;
        for (let frame = 0; frame < 3600; frame++) {
          g.world.setInput({ move: { x: 1, z: 0 }, walk: true }); g.world.update(); g.view.advance(1 / 60); g.view.renderer.nextNodeFrame(); g.view.update(1);
          const state = l.getState();
          maps = Math.max(maps, Number(l.sun.visible && l.sun.shadow.autoUpdate) + Number(l.spot.visible && l.spot.shadow.autoUpdate));
          if (state.heroLight !== lastId) { if (lastId !== null) fadeAt = frame; lastId = state.heroLight; changes.push(frame); }
          if (fadeAt >= 0 && state.promotionBlend >= 1) { fades.push((frame - fadeAt) / 60 * 1000); fadeAt = -1; }
          maxChangesPerSecond = Math.max(maxChangesPerSecond, changes.filter(f => frame - f < 60).length);
          for (const [i, f] of fields.entries()) {
            const q = g.view.project(f.x, .05, f.z), sx = (q[0] + 1) * width / 2 - .5, sy = (1 - q[1]) * height / 2 - .5;
            const x = Math.floor(sx), y = Math.floor(sy), tx = sx - x, ty = sy - y;
            if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4 || q[2] < -1 || q[2] > 1) continue;
            gl.readPixels(x, height - 2 - y, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            const v = [0, 4, 8, 12].map(j => .2126 * linear(pixel[j]) + .7152 * linear(pixel[j + 1]) + .0722 * linear(pixel[j + 2]));
            const value = (v[2] * (1 - tx) + v[3] * tx) * (1 - ty) + (v[0] * (1 - tx) + v[1] * tx) * ty;
            const before = previous.get(i);
            if (before?.frame === frame - 1 && before.value > .001) maxDelta = Math.max(maxDelta, Math.abs(value - before.value) / before.value);
            previous.set(i, { frame, value });
          }
          if (frame % 60 === 0) await new Promise<void>(r => requestAnimationFrame(() => r()));
        }
        g.world.setInput({ move: { x: 0, z: 0 } });
        return { distance: g.world.entities.get(1)!.transform.x, maps, changes: changes.length, maxChangesPerSecond, fadeMs: fades, maxPoolFrameDelta: maxDelta };
      });
      rows.push({ label: `60s forty-lamp walk ${backend}/${tier}`, ...walk });
      if (walk.distance < 119 || walk.maps > 1 || walk.changes !== 40 || walk.maxChangesPerSecond > 2 || walk.fadeMs.length !== 39 || walk.fadeMs.some(ms => ms < 299 || ms > 318) || walk.maxPoolFrameDelta > .15) failures.push(`${backend}/${tier}: E25 walk/crossfade gate failed`);
    }
    if (process.env.R12_MATRIX !== '0') {
      const scenes = ['catalog/atmosphere-l5', 'catalog/qa-l6-po-headlamp', 'catalog/qa-l6-exit-approach', 'catalog/qa-l7-entry-night-exit', 'l8-district/walk', 'catalog/night-read-l9-road', 'catalog/night-read-l10-r1', 'catalog/world-fill-l8-driveout'];
      for (const name of scenes) {
        const spec = readSpec(`tests/scenes/${name}.json`); delete spec.script;
        if (name.endsWith('world-fill-l8-driveout')) spec.actors = [{ id: 'beam-target', kind: 'infected', archetype: 'infected.runner', at: [-534, 1], state: 'idle' }];
        // Hold the authored location for the zoom/backend matrix.
        for (const actor of spec.actors ?? []) if (actor.state && typeof actor.state === 'object' && 'walk' in actor.state) actor.state = { idle: true };
        await s.load(spec); await s.step(30);
        for (const zoom of [1, 1.5]) {
          await s.page.evaluate(zoom => { if(!window.qaNativeMoon) window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom}); else window.__SS__!.camera.zoom(zoom); }, zoom); await capture(s, `${spec.name} ${backend}/${tier} z${zoom}`, zoom === 1.5);
          if (name.endsWith('world-fill-l8-driveout') && !(rows.at(-1) as { selected: string | null }).selected?.startsWith('vehicle-')) failures.push(`${backend}/${tier}: driven headlights not promoted`);
        }
      }
      const practicals: SceneSpec[] = [readSpec('tests/scenes/catalog/spec-audit-b-light-lab.json'), { ...fixture, name: 'fire-source', props: [], actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, { id: 'corgi', kind: 'corgi', at: [-1, 2] }], script: [{ frame: 0, effect: { fire: [3, 1], radius: 1.2, duration: 20 } }] }];
      for (const spec of practicals) {
        await s.load(spec); await s.step(60);
        for (const zoom of [1, 1.5]) {
          await s.page.evaluate(zoom => { if(!window.qaNativeMoon) window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom}); else window.__SS__!.camera.zoom(zoom); }, zoom); await capture(s, `${spec.name} ${backend}/${tier} z${zoom}`, zoom === 1.5);
          if (!(rows.at(-1) as { selected: string | null }).selected) failures.push(`${spec.name} ${backend}/${tier}: practical shadow missing`);
        }
      }
      await s.load({name:'isolated-headlights',size:100,ground:'asphalt',time:'night',dof:false,vehicles:[{id:'apc',asset:'vehicle.military-apc',at:[0,0],yaw:0,path:[[30,0]],driven:true}],actors:[{id:'beam-target',kind:'infected',archetype:'infected.runner',at:[12,0],state:'idle'}],camera:{mode:'game',target:'apc',zoom:1.5},frames:0});
      const driveSources=[];for(let frame=0;frame<120;frame++){await s.step(1);if(frame%10===0)driveSources.push(await s.page.evaluate(()=>{const g=window.__SCENE__.game,l=g.view.lighting;return{tick:g.world.tick,id:l.heroLight,lighting:{changes:l.getState().promotionChanges,blend:l.getState().promotionBlend,maps:Number(l.sun.visible&&l.sun.shadow.autoUpdate)+Number(l.spot.visible&&l.spot.shadow.autoUpdate)},car:g.world.entities.get(g.world.vehicles.active).transform};}));}
      await capture(s,`isolated headlights ${backend}/${tier}`);rows.push({label:`moving headlights ${backend}/${tier}`,samples:driveSources});
      if(!driveSources.some(v=>v.id?.startsWith('vehicle-')))failures.push(`${backend}/${tier}: isolated moving headlights never promoted`);
      // Source lifecycle fixtures use the production power and transient paths.
      await s.load(fixture);await s.step(60);
      await s.page.evaluate(()=>{const g=window.__SCENE__.game,l=g.view.lighting;for(const group of new Set([...l.lamps.state.lamps.values()].map(v=>v.group)))l.lamps.state.setGroup(group,false);});
      await s.step(60);await capture(s,`powered-off ${backend}/${tier}`);
      if((rows.at(-1) as {selected:string|null}).selected)failures.push(`${backend}/${tier}: powered-off source retained`);
      await s.load({...fixture,props:[],actors:[{id:'courier',kind:'courier',at:[0,0]},{id:'corgi',kind:'corgi',at:[-1,2]}]});
      await s.page.evaluate(()=>window.__SCENE__.game.view.lightField.addTransient({x:3,z:1},'#ff9944',30,8,.8,true));await s.step(30);await capture(s,`transient-live ${backend}/${tier}`);
      const transientLive=(rows.at(-1) as {selected:string|null}).selected;
      await s.step(90);await capture(s,`transient-expired ${backend}/${tier}`);
      if(!transientLive||(rows.at(-1) as {selected:string|null}).selected)failures.push(`${backend}/${tier}: transient lifecycle gate failed`);
      if (tier === 'low') {
        await s.page.evaluate(async () => {
          window.qaNativeMoon=true; await window.__SS__!.loadLevel('L7', { seed: 1 }); window.__SS__!.pause(); window.__SS__!.cheats.god(true);
          const g = (window.__SCENE__ as unknown as { game: Game }).game, l = (g.view as unknown as { lighting: Lighting }).lighting;
          const origin = g.world.entities.get(1)!.transform, nav = g.world.infected!.nav;
          let dark: { x: number; z: number } | null = null;
          for (let radius = 0; radius <= 40 && !dark; radius += 5) for (let i = 0; i < 16 && !dark; i++) {
            const p = { x: origin.x + Math.cos(i / 8 * Math.PI) * radius, z: origin.z + Math.sin(i / 8 * Math.PI) * radius };
            if (nav.clear(p.x, p.z, .5, true) && !l.field.heroAt(p.x, p.z)) dark = p;
          }
          if (!dark) throw Error('No open dark native L7 probe spot');
          window.__SS__!.teleport('player', dark); g.view.unfreeze(); g.view.view.follow(); await window.__SS__!.step(60);
        });
        for (const zoom of [1, 1.5]) {
          await s.page.evaluate(zoom => { if(!window.qaNativeMoon) window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom}); else window.__SS__!.camera.zoom(zoom); }, zoom); await capture(s, `native L7 moon ${backend}/${tier} z${zoom}`, zoom === 1.5);
          const r = rows.at(-1) as { selected: string | null; sunWeight: number; refreshed: number };
          if (r.selected || r.sunWeight !== 1 || r.refreshed !== 1) failures.push(`${backend}/${tier}: native L7 moon fallback missing`);
        }
      }
    }
    if (s.errors.length) failures.push(...s.errors);
    await writeSheet(s); await s.close(); await alternateBrowser?.close(); alternateBrowser = undefined; session = undefined; stopServer();
    completed.push(`${backend}/${tier}`);
    console.log(`${backend}/${tier}: ${rows.length} receipts, ${failures.length} failures`);
  }
} catch (error) {
  failures.push(String(error).split('\n')[0]); throw error;
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ baselineRef, browser: process.env.R12_CHROME === '1' ? 'chrome' : 'headless-shell', matrix: process.env.R12_MATRIX !== '0', completed, rows, failures }, null, 2) + '\n');
  mkdirSync('test-results', { recursive: true }); writeFileSync(scratchPath, JSON.stringify(cells));
  await session?.close(); await alternateBrowser?.close(); stopServer();
}
if (failures.length) throw Error(failures.join('\n'));
