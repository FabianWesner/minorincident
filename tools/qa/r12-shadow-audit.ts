/** Manual headless native-backend shadow audit. Keeps one labelled sheet and a compact receipt. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer, type Backend } from '../scenelab/session';
import { timeOfDay } from '../../src/data/timeOfDay';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { FieldLight } from '../../src/render/LightField';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = 'docs/reports/r12-shadow', scratchPath = 'test-results/r12-shadow-cells.json';
const resume = process.env.R12_RESUME === '1' && existsSync(`${out}/measurements.json`);
const previous = resume ? JSON.parse(readFileSync(`${out}/measurements.json`, 'utf8')) as { rows: object[]; failures: string[] } : undefined;
const cells: { label: string; jpeg: string }[] = resume && existsSync(scratchPath) ? JSON.parse(readFileSync(scratchPath, 'utf8')) : [];
const rows: object[] = previous?.rows ?? [];
mkdirSync(out, { recursive: true });
const baselineRef = 'a0d4f7ba^';
const original = execFileSync('git', ['show', `${baselineRef}:src/render/Lighting.ts`], { encoding: 'utf8' });
const ast = ts.createSourceFile('Lighting.ts', original, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(ts.isClassDeclaration)!;
const methods = declaration.members.filter(ts.isMethodDeclaration).filter(m => ['setHeroLight', 'setShadowSource'].includes(m.name.getText(ast)));
const baseline = ts.transpileModule(`class Baseline { ${methods.map(m => ts.createPrinter().printNode(ts.EmitHint.Unspecified, m, ast)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nreturn Baseline;';
const fixture: SceneSpec = { name: 'shadow-dominance', seed: 1, time: 'night', ground: 'asphalt', size: 42, dof: false,
  props: [{ id: 'weak', asset: 'prop.street-lamp', at: [-4, -1] }, { id: 'strong', asset: 'prop.street-lamp', at: [4, 1] }],
  actors: [{ id: 'courier', kind: 'courier', at: [0, 0], yaw: 135 }, { id: 'corgi', kind: 'corgi', at: [-1, 2] }, { id: 'nearby', kind: 'infected', archetype: 'infected.runner', at: [1, -2], state: 'idle' }],
  camera: { mode: 'game', target: 'courier', zoom: 1 } };
const lin = (v: number) => v <= 10 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
const lum = (p: PNG, x: number, y: number) => { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return .2126 * lin(p.data[i]) + .7152 * lin(p.data[i + 1]) + .0722 * lin(p.data[i + 2]); };
const failures: string[] = previous?.failures ?? [];
let session: SceneSession | undefined;
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
      preset: l.preset, quality: window.__SS__!.getState().render.quality, zoom: g.view.view.getState().targetZoom };
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
    const s = session = new SceneSession({ backend, tier }); await s.open();
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
        const lamp = g.world.lightPower!.lamps.get(right.id)!; lamp.powered = false; lamp.startedAt = -1;
        l.set('night');
      }, { baseline, presets: timeOfDay, phase });
      await s.step(60);
      await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; for (const lamp of g.world.lightPower!.lamps.values()) { lamp.powered = true; lamp.startedAt = -1; } });
      await s.step(60);
      for (const zoom of [1, 1.5]) {
        await s.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom);
        const label = `${phase} ${backend}/${tier} z${zoom}`;
        const beauty = await capture(s, label);
        {
          const selected = rows.at(-1) as { position: number[]; refreshed: number };
          if (phase === 'after' && (selected.position[0] < 0 || selected.refreshed !== 1)) failures.push(`${label}: dominant right lamp not active`);
          const points = await s.page.evaluate(() => [-1, 1].map(side => Array.from({ length: 25 }, (_, i) => { const d = 1 + Math.floor(i / 5) * .4, across = (i % 5 - 2) * .15; return window.__SCENE__!.project([side * d * .9701 - across * .2425, .03, side * d * .2425 + across * .9701]); })));
          await s.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.view.labProbes().character!.traverse(o => { o.userData.r12Cast = o.castShadow; o.castShadow = false; }));
          const absent = await capture(s, `${label} no-caster`, false);
          await s.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.view.labProbes().character!.traverse(o => { o.castShadow = o.userData.r12Cast; delete o.userData.r12Cast; }));
          const darkness = points.map(mask => mask.reduce((v, p) => v + Math.max(0, 1 - lum(beauty, p.x, p.y) / Math.max(.001, lum(absent, p.x, p.y))), 0) / mask.length);
          rows.push({ label: `${label} ground shadow`, away: darkness[0], towards: darkness[1] });
          if (phase === 'after' && !(darkness[0] > darkness[1] + .05)) failures.push(`${label}: shadow does not point away from right lamp`);
        }
      }
      if (phase === 'before') await s.page.evaluate(() => { const l = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { lighting: Lighting }).lighting as unknown as Record<string, unknown>; Object.assign(l, l.qaRestore); delete l.qaRestore; });
    }
    if (process.env.R12_MATRIX !== '0') {
      const scenes = ['catalog/atmosphere-l5', 'catalog/qa-l6-po-headlamp', 'catalog/qa-l6-exit-approach', 'catalog/qa-l7-entry-night-exit', 'l8-district/walk', 'catalog/night-read-l9-road', 'catalog/night-read-l10-r1', 'catalog/world-fill-l8-driveout'];
      for (const name of scenes) {
        const spec = readSpec(`tests/scenes/${name}.json`); delete spec.script;
        // Hold the authored location for the zoom/backend matrix.
        for (const actor of spec.actors ?? []) if (actor.state && typeof actor.state === 'object' && 'walk' in actor.state) actor.state = { idle: true };
        await s.load(spec); await s.step(30);
        for (const zoom of [1, 1.5]) { await s.page.evaluate(zoom => window.__SS__!.camera.zoom(zoom), zoom); await capture(s, `${spec.name} ${backend}/${tier} z${zoom}`, zoom === 1.5); }
      }
    }
    if (s.errors.length) failures.push(...s.errors);
    await writeSheet(s); await s.close(); session = undefined; stopServer();
    console.log(`${backend}/${tier}: ${rows.length} receipts, ${failures.length} failures`);
  }
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ baselineRef, rows, failures }, null, 2) + '\n');
  mkdirSync('test-results', { recursive: true }); writeFileSync(scratchPath, JSON.stringify(cells));
  await session?.close(); stopServer();
}
if (failures.length) throw Error(failures.join('\n'));
