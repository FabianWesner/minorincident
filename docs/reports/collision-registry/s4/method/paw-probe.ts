import { writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const s = new SceneSession({ backend: 'webgpu', tier: 'high', viewport: { width: 960, height: 540 } });
try {
  await s.open(); await s.load(readSpec('specs/scenes/catalog/corgi-firestation-apron.json'));
  const rows = await s.page.evaluate(async () => {
    // Diagnostic only: compare the existing fixed-point probe with actual drawn vertices.
    // @ts-expect-error private Scene Lab diagnostic access
    const lab = window.__SCENE__, game = lab.game, world = lab.world;
    const dog = [...world.entities.iterate()].find((e: { companion?: unknown }) => e.companion);
    const root = game.view.labProbes().npcs.heroRoot(dog.id), point = root.position.clone();
    const rows = [];
    for (let f = 0; f < 480; f++) {
      await lab.step(1); const floor = world.districts.pavingHeight(dog.transform.x, dog.transform.z);
      for (const name of ['legFL', 'legFR', 'legBL', 'legBR']) {
        const leg = root.getObjectByName(name); let bottom = Infinity;
        root.updateMatrixWorld(true);
        leg.traverse((n: { isMesh?: boolean; geometry: { attributes: { position: { count: number } } }; matrixWorld: unknown }) => {
          if (!n.isMesh) return;
          const p = n.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) bottom = Math.min(bottom, point.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).y);
        });
        const probe = lab.paw(leg);
        rows.push({ frame: f + 1, name, floor, rootY: root.position.y, bottom, probeY: probe[1], realSink: floor - bottom, probeSink: floor - probe[1] });
      }
    }
    return rows;
  });
  writeFileSync('/tmp/collision-s4-paw-probe.json', JSON.stringify(rows));
  console.log(JSON.stringify({ real: rows.toSorted((a, b) => b.realSink - a.realSink).slice(0, 5), probe: rows.toSorted((a, b) => b.probeSink - a.probeSink).slice(0, 5) }));
} finally { await s.close(); stopServer(); }
