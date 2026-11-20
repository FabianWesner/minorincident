/** Audit actual generated crown card triangles against each placed sign. */
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh } from 'three';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { signIntersections } from './s181-signs-intersections';

const session = new SceneSession({ tier: 'high', backend: 'webgl2' });
try {
  await session.open();
  const data = await session.page.evaluate(async level => {
    const api = window.__SS__!; await api.loadLevel(level, { seed: 1 }); api.pause(); await api.screenshotReady();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    const districtView = (game.view as unknown as { districts: { parts: { signBatches: { district: string; origin: number[]; ids: string[]; indicesBySign: number[][]; geometry: { attributes: { position: { getX(i: number): number; getY(i: number): number; getZ(i: number): number } } } }[] }; foliage: { geometry: { attributes: { position: { array: ArrayLike<number> } }; index: { array: ArrayLike<number> } }; batches: { references: { matrix: { elements: number[] } }[] }[] } } }).districts;
    const signs = districtView.parts.signBatches.flatMap(batch => batch.ids.flatMap((id, i) => {
      const p = batch.geometry.attributes.position;
      const groups = [Array.from({ length: 4 }, (_, j) => i * 4 + j)];
      for (let j = 6; j < batch.indicesBySign[i].length; j += 6) {
        const indices = batch.indicesBySign[i].slice(j, j + 6);
        groups.push([indices[0], indices[1], indices[2], indices[5]]);
      }
      const result = groups.map((vertices, part) => ({ district: batch.district, id, part: part ? `support-${part - 1}` : 'board', vertices: vertices.map(j => [p.getX(j) + batch.origin[0], p.getY(j), p.getZ(j) + batch.origin[1]]) }));
      return result;
    }));
    const foliage = districtView.foliage;
    return { signs, positions: Array.from(foliage.geometry.attributes.position.array) as number[], indices: Array.from(foliage.geometry.index.array) as number[], matrices: foliage.batches.flatMap((batch) => batch.references.map((ref) => ref.matrix.elements as number[])) };
  }, process.argv[2] ?? 'L10');
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3)); geometry.setIndex(data.indices);
  const mesh = new Mesh(geometry); mesh.matrixAutoUpdate = false;
  for (const sign of data.signs) {
    let hits = 0; const crowns: number[] = [];
    data.matrices.forEach((matrix: number[], i: number) => {
      mesh.matrixWorld.copy(new Matrix4().fromArray(matrix));
      const count = signIntersections(mesh, sign.vertices).intersections;
      if (count) { hits += count; crowns.push(i); }
    });
    console.log(JSON.stringify({ ...sign, hits, crowns }));
  }
} finally { await session.close(); stopServer(); }
