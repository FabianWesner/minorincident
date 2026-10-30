import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer } from '../scenelab/session';

const tier = process.argv[2] === 'low' ? 'low' : 'high';
const out = resolve(`docs/reports/q257/visual/children-${tier}`); mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier, viewport: { width: 1400, height: 650 }, query: { skin: '1' } });
try {
  await session.open();
  await session.load({ name: 'q257-child-adult-ratios', ground: 'sidewalk', time: 'L1', dof: false, size: 30,
    actors: [
      { id: 'woman', kind: 'pedestrian', at: [-3, 0], look: { model: 'npc.civilian-woman-a', accessories: ['none'] }, state: 'idle' },
      { id: 'kid', kind: 'pedestrian', at: [-1, 0], look: { model: 'npc.civilian-kid', accessories: ['none'] }, state: 'idle' },
      { id: 'heroine', kind: 'courier', at: [3, 0], look: { model: 'female' }, state: 'idle' },
    ], camera: { mode: 'pose', position: [0, 1, 11], target: [0, 1, 0] } });
  const brother = await session.page.evaluate(() => {
    const { world, view } = (window.__SCENE__ as unknown as { game: { world: import('../../src/sim/world/SimWorld').SimWorld; view: { scene: import('three').Scene } } }).game;
    const id = world.npcs!.escorts.spawn({ x: 1, z: 0 }, true), child = world.entities.get(id)!;
    child.escort!.order = child.escort!.state = 'wait';
    view.scene.traverse(node => { if (node.name === 'ambient-gpu-life') node.visible = false; });
    return id;
  });
  await session.step(60); await session.ready();
  await session.page.evaluate(() => {
    const label = document.createElement('div'); label.textContent = 'q257 children: adult woman 1.454 m | child 1.191 m | brother 1.152 m | heroine 1.454 m';
    label.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#111d;color:white;padding:8px;font:16px sans-serif;z-index:9999'; document.body.append(label);
  });
  await session.page.screenshot({ path: resolve(out, 'lineup.jpg'), type: 'jpeg', quality: 95 });
  writeFileSync(resolve(out, 'receipts.json'), JSON.stringify({ brother, metrics: await session.metrics(), errors: session.errors }, null, 2) + '\n');
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
