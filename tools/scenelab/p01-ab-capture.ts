/** Run unchanged in the lane base and retirement worktrees through the shared browser pool. */
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import type { Game } from '../../src/Game';
import type { Matrix4 } from 'three';

const side = process.env.P01_AB_SIDE;
if (side !== 'before' && side !== 'after') throw new Error('P01_AB_SIDE must be before or after');
const scenes = [
  ['crowd-infected-20', 'tests/scenes/crowd-variety/infected-20.json', [0, 60]],
  ['crowd-l7-rocket', 'tests/scenes/l7-rocket/qa-l7-rocket-crowd.json', [30, 240]],
  ['corpses', 'tests/scenes/catalog/corpse-look-close.json', [80]],
  ['l4-breach', 'tests/scenes/l4-systems/gap.json', [27, 90, 450]],
  ['l8-zoo', 'specs/scenes/catalog/animal-zoo-healthy.json', [0, 60]],
  ['l10-mega-slam', 'tests/scenes/l10-mega-moves/l10-mega-slam.json', [40, 90, 144]],
] as const;
const out = resolve(process.env.P01_AB_OUT ?? 'docs/reports/p01-rigid-retire/pixels');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirtyHash = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--binary'], { maxBuffer: 1 << 26 })).digest('hex');
try {
for (const tier of ['high', 'low'] as const) {
  const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1280, height: 720 }, seed: 1 });
  // Pixel evidence covers the rendered canvas. Timing and debug DOM labels are excluded.
  session.screenshot = async path => {
    await session.ready(); mkdirSync(resolve(path, '..'), { recursive: true });
    if (process.env.P01_AB_DIAGNOSTICS) {
      const diagnostic = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const accessories = (game.view as unknown as { accessories: unknown }).accessories as { fits: Map<string, Matrix4>; accessoryFits: Map<string, Matrix4>; brows: Map<string, unknown>; skullLods: Map<string, number>; minimumHatY: Map<string, number>; lifts: Map<string, number>; children: import('three').InstancedMesh[] };
        return { fits: [...accessories.fits], accessoryFits: [...accessories.accessoryFits], brows: [...accessories.brows], skullLods: [...accessories.skullLods], minimumHatY: [...accessories.minimumHatY], lifts: [...accessories.lifts], draws: accessories.children.filter(mesh => mesh.count).map(mesh => ({ name: mesh.name, count: mesh.count, matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)) })), crowd: window.__SS__!.getState().render.crowd };
      });
      writeJson(path.replace('.png', '.diagnostic.json'), diagnostic);
    }
    return session.page.locator('canvas').first().screenshot({ path, type: 'png' });
  };
  const receipts: unknown[] = [];
  try {
    await session.open();
    for (const [name, file, shots] of scenes) {
      if (process.env.P01_AB_SCENES && !process.env.P01_AB_SCENES.split(',').includes(name)) continue;
      const result = await runSpec(session, readSpec(file), { file, out: `${out}/${side}/${tier}/${name}`, frames: Math.max(...shots), shots: [...shots], sheet: 0 });
      const images = shots.map(frame => { const path = `${out}/${side}/${tier}/${name}/shot-${String(frame).padStart(4, '0')}.png`; return { frame, path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }; });
      receipts.push({ name, file, revision, dirtyHash, backend: 'webgl2', tier, seed: 1, images, result });
      writeJson(`${out}/${side}/${tier}/receipts.json`, receipts);
      console.log(`${side}/${tier}/${name}: ${result.pass ? 'PASS' : 'FAIL'}`);
    }
    if (session.errors.length) throw new Error(JSON.stringify(session.errors));
  } finally { await session.close(); }
}
} finally { stopServer(); }
