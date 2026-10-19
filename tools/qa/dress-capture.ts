/** Game-camera captures of a dressed level region (dress lanes): loads the real level, teleports the player, follows with the game camera.
 * Usage: SCENE_PORT=3452 sh tools/e2e-lock.sh tsx tools/qa/dress-capture.ts <shots.json> <outDir> [--backend webgl2|webgpu] [--tier high|low] [--zooms 1.5,1,0.5]
 * shots.json: [{ "id": "cellar-l4", "level": "L4", "progression": "L4-default", "at": [75.3, 1.2], "steps": 30, "pose": {...optional CameraPose} }]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { View } from '../../src/render/View';

const [shotsFile, out, ...rest] = process.argv.slice(2);
const opt = (name: string, fallback: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const backend = opt('backend', 'webgl2') as Backend, tier = opt('tier', 'high') as 'high' | 'low';
const zooms = opt('zooms', '1.5,1').split(',').map(Number);
interface Shot { id: string; level: string; progression?: string; checkpoint?: string; at: [number, number]; steps?: number; pose?: { position: [number, number, number]; target: [number, number, number] }; ready?: string }
const shots: Shot[] = JSON.parse(readFileSync(shotsFile, 'utf8'));
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
try {
  await session.open();
  let loaded = '';
  for (const shot of shots) {
    const key = `${shot.level}/${shot.progression ?? ''}/${shot.checkpoint ?? ''}`;
    if (key !== loaded) {
      await session.page.evaluate(async ({ level, progression, checkpoint, tier }) => {
        const a = window.__SS__!;
        await a.loadLevel(level, { seed: 1, ...(checkpoint ? { checkpoint } : {}), ...(progression ? { progression: progression as never } : {}) });
        a.settings.set({ quality: tier }); a.pause(); a.settings.set({ cameraShake: false });
        try { a.missions.begin(); } catch { /* no briefing */ }
      }, { level: shot.level, progression: shot.progression, checkpoint: shot.checkpoint, tier });
      loaded = key;
    }
    for (const zoom of zooms) {
      await session.page.evaluate(async ({ at, steps, pose }) => {
        const a = window.__SS__!;
        a.teleport('player', { x: at[0], z: at[1] });
        if (pose) a.camera.cinematic(pose as never, true); else a.camera.follow();
        await a.step(steps ?? 40);
      }, { at: shot.at, steps: shot.steps, pose: shot.pose });
      await session.page.evaluate(zoom => {
        const view = (window.__SCENE__ as unknown as { game: { view: { view: View } } }).game.view.view;
        view.zoom(Math.log(zoom / view.getState().targetZoom), true); window.__SS__!.step(40);
      }, zoom);
      await session.ready();
      const perf = await session.page.evaluate(() => { const p = window.__SS__!.perf(); return { backend: p.backend, tier: p.quality.tier, draws: p.drawCalls, triangles: p.triangles }; });
      const file = `${out}/${shot.id}-${backend}-${tier}-z${zoom}.jpg`;
      await session.page.screenshot({ path: file, type: 'jpeg', quality: 85 });
      rows.push({ file, ...perf });
      console.log(`${file}: ${perf.draws} draws / ${perf.triangles} tris`);
    }
  }
  if (session.errors.length) console.log('console errors', session.errors.slice(0, 5));
} finally { writeFileSync(`${out}/proof-${backend}-${tier}.json`, JSON.stringify(rows, null, 1)); await session.close(); stopServer(); }
