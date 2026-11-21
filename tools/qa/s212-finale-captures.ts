import { resolve } from 'node:path';
import { SceneSession, stopServer } from '../scenelab/session';

const out = resolve('docs/reports/s212-l10finale');
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 }, query: { zoom: '1' } });
const beats = [
  ['beat-0-hangar', 2750], ['beat-1-evac-road', 2880], ['beat-2-quarantine-gate', 3010],
  ['beat-3-billboard', 3076], ['beat-4-dry-field', 3185], ['beat-5-convoy-7', 3260],
  ['beat-6-overpass-mega', 3340], ['beat-7-underpass', 3390], ['beat-8-field-hospital', 3502],
  ['beat-9-final-approach', 3650],
] as const;
try {
  await session.open();
  await session.inspectLevel('L10');
  const cells = [];
  for (const [i, [name, x]] of beats.entries()) {
    await session.page.evaluate(({ x }) => {
      window.__SS__!.pause();
      window.__SS__!.camera.zoom(1);
      window.__SS__!.inspect.setCamera({ position: [x - 17, 13, 115], target: [x, 1, 95] });
    }, { x });
    await session.screenshot(`${out}/${name}.png`);
    cells.push({ frame: i, jpeg: await session.snapshot() });
  }
  console.log(JSON.stringify(await session.makeSheet(cells, `${out}/finale-beats.jpg`, 480, 900)));
} finally { await session.close(); stopServer(); }
