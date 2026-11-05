import { Matrix4, Vector3 } from 'three';
import { boxOf, staticClipping } from '../../src/debug/scenelab/geometry';
import type { Game } from '../../src/Game';
import { SceneSession, readSpec, stopServer, writeJson } from './session';

/** Export the actual drawn hands/props and measure candidate grip translations in hand-local metres. */
const out = process.argv[2] ?? 'test-results/polish-26/grips';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
const results = [];
try {
  await session.open();
  for (const scene of ['ped-sit-all', 'ped-water-flowerbed', 'ped-zoo-staff']) {
    const spec = readSpec(`specs/scenes/catalog/${scene}.json`);
    await session.load(spec); await session.step(30);
    await session.screenshot(`${out}/${scene}.png`);
    const contacts = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      return game.view.labProbes().heldProps.map(c => {
        const p = c.geometry.getAttribute('position'), index = c.geometry.index;
        return { prop: c.prop, entity: c.entity, matrix: c.matrix.toArray(), hand: Array.from(c.hand),
          positions: Array.from({ length: index?.count ?? p.count }, (_, i) => {
            const v = index ? index.getX(i) : i; return [p.getX(v), p.getY(v), p.getZ(v)];
          }).flat() };
      });
    });
    for (const c of contacts) {
      const inverse = new Matrix4().fromArray(c.matrix).invert(), point = new Vector3(), hand = new Float32Array(c.hand);
      for (let i = 0; i < hand.length; i += 3) point.fromArray(hand, i).applyMatrix4(inverse).toArray(hand, i);
      const hits = (offset: number[]) => {
        const prop = new Float32Array(c.positions);
        for (let i = 0; i < prop.length; i++) prop[i] += offset[i % 3];
        return staticClipping([{ id: 'hand', assetId: 'hand', tris: hand, box: boxOf(hand) }, { id: 'prop', assetId: c.prop, tris: prop, box: boxOf(prop) }]).length;
      };
      const candidates = [];
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
        for (let mm = 0; mm <= 100; mm++) {
          const offset = [0, 0, 0]; offset[axis] = sign * mm / 1000;
          if (!hits(offset)) { candidates.push(offset); break; }
        }
      }
      results.push({ scene, prop: c.prop, entity: c.entity, before: hits([0, 0, 0]), candidates, hand: boxOf(hand) });
    }
  }
  writeJson(`${out}/offsets.json`, results); console.log(JSON.stringify(results, null, 2));
} finally { await session.close(); stopServer(); }
