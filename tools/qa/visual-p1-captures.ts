/** One pooled, headless context at a time. Baseline modules are served from
 * temporary siblings in this worktree; no second checkout or server is used. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { SceneSession, stopServer, origin } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { PNG } from 'pngjs';
import { measureCourierShare } from '../scenelab/run';
import { createHash } from 'node:crypto';

const flag = (key: string) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? undefined : process.argv[i + 1]; };
const out = process.env.VISUAL_P1_OUT ?? 'test-results/visual-p1-1102/captures'; mkdirSync(out, { recursive: true });
const baseline = flag('phase') === 'after' ? 'HEAD' : 'e73c51a31';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDiff = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'src'])).digest('hex');
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(p => /\.(ts|css)$/.test(p));
const temporary = new Map<string, string>();
const fixtures = ['bounds-l7', 'vehicle-l2', 'canopy-l8', 'parts-l4-bus', 'parts-l4-apc', 'mailbox-l1', 'benches-l2'];
const rows: Record<string, unknown>[] = existsSync(`${out}/matrix.json`) ? JSON.parse(readFileSync(`${out}/matrix.json`, 'utf8')) : [];
async function arrowProbe(s: SceneSession, phase: string) {
  const saved = await s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game, m = game.world.missions!;
    return { id: m.state.marker!, anchor: { ...m.def.anchors[m.state.marker!] } };
  });
  const evidence = [];
  try {
    for (const distance of [50, 350, 700]) for (let direction = 0; direction < 8; direction++) {
      const info = await s.page.evaluate(async ({ distance, direction, id }) => {
        const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game, m = game.world.missions!, p = game.world.entities.get(1)!.transform;
        const anchor = m.def.anchors[id]; anchor.x = p.x + Math.cos(direction * Math.PI / 4) * distance; anchor.z = p.z + Math.sin(direction * Math.PI / 4) * distance;
        game.view.refreshMissionUI(); await window.__SS__!.screenshotReady();
        const q = game.view.camera.position.clone().set(anchor.x, 1.8, anchor.z).project(game.view.camera);
        const el = document.querySelector<HTMLElement>('.mission-marker')!, r = el.getBoundingClientRect();
        return { expected: q.z > 1 || q.z < -1 || Math.abs(q.x) > 1 || Math.abs(q.y) > 1, offscreen: el.dataset.offscreen, hidden: el.hidden, left: r.left, top: r.top, right: r.right, bottom: r.bottom, projection: q.toArray() };
      }, { distance, direction, id: saved.id });
      const clip = { x: Math.max(0, Math.floor(info.left)), y: Math.max(0, Math.floor(info.top)), width: Math.max(1, Math.min(1280, Math.ceil(info.right)) - Math.max(0, Math.floor(info.left))), height: Math.max(1, Math.min(720, Math.ceil(info.bottom)) - Math.max(0, Math.floor(info.top))) };
      const normal = PNG.sync.read(await s.page.screenshot({ clip }));
      await s.page.locator('.mission-marker').evaluate(el => { (el as HTMLElement).style.visibility = 'hidden'; });
      const hidden = PNG.sync.read(await s.page.screenshot({ clip }));
      await s.page.locator('.mission-marker').evaluate(el => { (el as HTMLElement).style.visibility = ''; });
      let pixels = 0; for (let i = 0; i < normal.data.length; i += 4) if (Math.abs(normal.data[i] - hidden.data[i]) + Math.abs(normal.data[i + 1] - hidden.data[i + 1]) + Math.abs(normal.data[i + 2] - hidden.data[i + 2]) > 30) pixels++;
      const pass = !info.expected || !info.hidden && info.offscreen === 'true' && pixels > 4 && info.left >= 0 && info.top >= 0 && info.right <= 1280 && info.bottom <= 720;
      evidence.push({ distance, direction, ...info, pixels, pass });
    }
  } finally {
    await s.page.evaluate(saved => { const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game; Object.assign(game.world.missions!.def.anchors[saved.id], saved.anchor); game.view.refreshMissionUI(); }, saved);
  }
  writeFileSync(`${out}/arrow-${phase}.json`, JSON.stringify(evidence, null, 2));
  if (phase === 'after' && evidence.some(row => !row.pass)) throw new Error('An offscreen objective arrow did not paint inside the viewport');
}
try {
  for (const backend of (['webgl2', 'webgpu'] as const).filter(x => !flag('backend') || x === flag('backend'))) for (const tier of (['low', 'high'] as const).filter(x => !flag('tier') || x === flag('tier'))) for (const phase of ['before', 'after'].filter(x => !flag('phase') || x === flag('phase'))) {
    const s = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
    try {
      await s.open();
      if (phase === 'before') {
        for (const path of changed) {
          const temp = `${dirname(path)}/__visual_before_${basename(path)}`;
          writeFileSync(temp, execFileSync('git', ['show', `${baseline}:${path}`])); temporary.set(path, temp);
        }
        for (const [path, temp] of temporary) await s.page.route(`**/${path}*`, async route => { const response = await route.fetch({ url: route.request().url().replace(path, temp) }); await route.fulfill({ response }); });
        await s.page.reload(); await s.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
        await s.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      }
      await s.page.evaluate('globalThis.__name = fn => fn');
      await s.page.addStyleTag({ content: '#hud:not([data-scene-hud]),.hud:not([data-scene-hud]){visibility:visible!important}' });
      for (const item of fixtures.filter(x => !flag('only') || flag('only')!.split(',').includes(x))) {
        if (item === 'bounds-l7' || item === 'vehicle-l2' || item === 'benches-l2' || item === 'canopy-l8') {
          const level = item === 'bounds-l7' ? 'L7' : item === 'canopy-l8' ? 'L8' : 'L2';
          await s.page.evaluate(async ({ level, item, tier }) => {
            const a = window.__SS__!; a.settings.set({ quality: tier });
            await a.loadLevel(level, { seed: 1, progression: `${level}-default` as import('../../src/sim/progression/Campaign').ProgressionPreset });
            a.missions.begin(); a.pause(); a.cheats.god(true); (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.inspect?.enable(false);
            const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            game.view.settings({ cameraShake: false, cheapDof: false });
            const p = item === 'bounds-l7' ? { x: 286.8, z: 15 } : item === 'vehicle-l2' ? { x: -70.5, z: 36.7 } : item === 'canopy-l8' ? { x: 105.9, z: -1 } : { x: -73.8, z: 42.7 };
            a.teleport(1, p);
            if (item === 'benches-l2') {
              // Include a child on the same authored seat path as the adults.
              const child = game.world.entities.get(game.world.missions!.state.l2!.benchIds[0])!;
              child.civilian!.adult = false; child.civilian!.model = 'npc.civilian-kid'; child.appearance!.asset = 'npc.civilian-kid';
              a.input.set({ move: { x: 0, z: -1 } }); await a.step(360); a.input.set({ move: { x: 0, z: 0 } });
              a.teleport(1, { x: -71, z: 41 });
            }
            game.view.view.reset(game.world.entities.get(1)!.transform);
            await a.step(item === 'bounds-l7' || item === 'canopy-l8' ? 2 : 90);
            // Clear the seated figures' sightline for this geometry inspection;
            // crews participated in the preceding physical shoulder-push run.
            if (item === 'benches-l2') for (const id of game.world.missions!.state.l2!.crewIds) game.world.entities.get(id)!.hidden = true;
          }, { level, item, tier });
        } else {
          const spec: SceneSpec = { name: item, seed: 1, ground: 'asphalt', size: 100, time: item === 'canopy-l8' ? 'L8-zoo' : item === 'mailbox-l1' ? 'L1' : 'L4', actors: [{ id: 'courier', kind: 'courier', at: [35, 30], look: { model: 'female' } }], camera: { mode: 'game', target: 'courier', zoom: .5 }, expect: { consoleErrors: 0, courierVisibleShareMin: .85 } };
          if (item === 'canopy-l8' || item === 'mailbox-l1') spec.props = [{ id: 'cover', asset: item === 'canopy-l8' ? 'prop.street-tree' : 'prop.mailbox-blue', at: [36.2, 31.2], yaw: 0 }];
          await s.load(spec);
          await s.page.evaluate(() => (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.inspect?.enable(false));
          if (item.startsWith('parts-l4')) await s.page.evaluate(async item => {
            const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            game.world.entities.create({ kind: 'setpiece', archetype: item.endsWith('bus') ? 'veh.evac-bus' : 'veh.military-apc', faction: 'neutral', transform: { x: 37, y: .7, z: 32, yaw: Math.PI / 2 }, health: { current: 1000, max: 1000 } });
            await window.__SS__!.screenshotReady();
          }, item);
          await s.step(3);
        }
        for (const zoom of [.5, 1.5]) {
          await s.page.evaluate(async zoom => { window.__SS__!.camera.zoom(zoom); await window.__SS__!.step(3); await window.__SS__!.screenshotReady(); }, zoom);
          await s.ready();
          const name = `${item}-${phase}-${backend}-${tier}-z${zoom}`;
          const share = await measureCourierShare(s);
          if (phase === 'after' && (item === 'vehicle-l2' || item === 'canopy-l8' || item.startsWith('parts-l4')) && (share.reference === 0 || share.share < .85)) throw new Error(`${name}: courier visible share ${share.share}`);
          const details = await s.page.evaluate(() => ({ state: window.__SS__!.getState().render, perf: window.__SS__!.perf() }));
          if (details.perf.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw new Error(`${name}: wrong backend ${details.perf.backend}`);
          await s.page.screenshot({ path: `${out}/${name}.png` });
          const metrics = item === 'bounds-l7' || item === 'vehicle-l2' || item === 'benches-l2' ? null : await s.metrics();
          const prior = rows.findIndex(r => r.name === name); if (prior >= 0) rows.splice(prior, 1);
          rows.push({ name, item, phase, backend, tier, zoom, baseline, revision, sourceDiff, url: origin, ...details, share, metrics, errors: [...s.errors] });
          writeFileSync(`${out}/matrix.json`, JSON.stringify(rows, null, 2)); console.log(name);
        }
        if (item === 'bounds-l7' && backend === 'webgl2' && tier === 'high') await arrowProbe(s, phase);
      }
      if (s.errors.length) throw new Error(s.errors.join('\n'));
    } finally { await s.close(); for (const temp of temporary.values()) if (existsSync(temp)) unlinkSync(resolve(temp)); temporary.clear(); }
  }
} finally { for (const temp of temporary.values()) unlinkSync(resolve(temp)); stopServer(); }
