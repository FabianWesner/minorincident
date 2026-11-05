import type { Game } from '../../src/Game';
import type { RoutineProps } from '../../src/render/npc/RoutineProps';
import { readSpec, SceneSession, stopServer, writeJson } from './session';

/** Close native cane grip; baseline suppresses only the newly fitted handle translation. */
const out = process.argv[2], baseline = process.argv[3] === 'baseline';
if (!out) throw new Error('Pass an output directory and optionally baseline');
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.load({ ...readSpec('specs/scenes/catalog/ped-sit-all.json'),
    camera: { mode: 'close', target: 's3', radius: 3, azimuth: 150 } });
  if (baseline) await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const npcs = g.view.labProbes().npcs as unknown as { civilians: { props: RoutineProps } };
    const props = npcs.civilians.props, held = props.held.bind(props);
    props.held = (prop, matrix, entity, hand, reach, gun, floor) => held(prop, matrix, entity, hand, prop === 'phone' ? reach : .025, gun, floor);
  });
  await session.step(30); await session.screenshot(`${out}/frame-30.png`);
  writeJson(`${out}/receipt.json`, { baseline, frame: 30, consoleErrors: session.errors });
  console.log(JSON.stringify({ baseline, consoleErrors: session.errors }));
} finally { await session.close(); stopServer(); }
