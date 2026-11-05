import { levelSixMission } from '../../src/levels/L6/mission';
import type { Game } from '../../src/Game';
import type { Box3, Matrix4, InstancedMesh } from 'three';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { runSpec } from './run';
import { SceneSession, stopServer, writeJson } from './session';

const mode = process.argv[2] ?? 'hair', out = process.argv[3] ?? `test-results/polish-26/${mode}-before`;
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
const styles = ['short-crop', 'ponytail', 'bun', 'afro', 'side-part', 'long-straight'];
const pose = levelSixMission(() => ({ x: 0, z: 0, radius: 1 })).cinematics.night;
const spec: SceneSpec = mode === 'l6' ? {
  name: 'polish-26-l6-ending', ground: 'district', time: 'L6',
  layout: { level: 'L6', district: 'D-SUBWAY', bbox: [[240, -5], [288, 32]] },
  actors: [{ id: 'courier', kind: 'courier', at: [273, 15] }, ...[0, 1, 2, 3].map(i => ({
    id: `survivor-${i}`, kind: 'pedestrian' as const, at: [269 + i * 1.1, 17] as [number, number], state: 'idle' as const,
  }))], camera: { mode: 'pose', position: pose.position, target: pose.target }, frames: 1, shots: [0, 1], expect: { consoleErrors: 0 },
} : {
  name: 'polish-26-hair', ground: 'sidewalk', size: 24, time: 'L4', trace: true,
  actors: [{ id: 'courier', kind: 'courier', at: [-4, 6] }, ...styles.map((style, i) => ({
    id: style, kind: 'pedestrian' as const, at: [-5 + i * 2, 0] as [number, number], state: 'idle' as const,
    look: { model: i % 2 ? 'npc.civilian-man-a' : 'npc.civilian-woman-b', accessories: [`acc.hair-${style}`], handProp: null },
  }))], camera: { mode: 'close', target: [0, .9, 0], radius: 13, azimuth: 80 },
  script: styles.flatMap(style => [{ frame: 30, actor: style, do: { infect: { instant: true } } }, { frame: 120, actor: style, do: { corpse: true as const } }]),
  frames: 240, shots: [0, 60, 240], expect: { consoleErrors: 0 },
};
try {
  await session.open(); const result = await runSpec(session, spec, { out, sheet: mode === 'hair' ? 30 : 1 });
  if (mode === 'hair') writeJson(`${out}/fits.json`, await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const a = (g.view as unknown as { accessories: { accessoryFits: Map<string, Matrix4>; batches: Map<string, InstancedMesh>; brows: Map<string, unknown> } }).accessories;
    return { brows: [...a.brows], fits: [...a.accessoryFits].filter(([key]) => key.startsWith('acc.hair')).map(([key, matrix]) => {
      const mesh = a.batches.get(`${key.split('/')[0]}:lod0`)!; if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = (mesh.geometry.boundingBox as Box3).clone().applyMatrix4(matrix);
      return { key, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
    }) };
  }));
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed, errors: session.errors }));
} finally { await session.close(); stopServer(); }
