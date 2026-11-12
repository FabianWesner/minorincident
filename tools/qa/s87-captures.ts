import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const out = 'test-results/s87-surfaceqa/captures';
mkdirSync(out, { recursive: true });
const findings = (JSON.parse(readFileSync('tests/nightly/ground-cover-roads.baseline.json', 'utf8')) as { findings: string[] }).findings;
const rows = [...new Map(findings.map(f => {
  const m = f.match(/^(L\d+)\/\S+ (\S+).* at \(([-\d.]+),([-\d.]+)\)/)!;
  return [`${m[1]}/${m[2]}`, { level: m[1], id: m[2], x: Number(m[3]), z: Number(m[4]) }];
})).values(), ...[
  [595,-8],[1065,82],[1241.91,28.03],[1745.16,-56.57],[3329.55,101.52],[3342.90,97.31],[3357.45,96.91],
].map(([x,z],i)=>({level:'L10',id:`fixed-crop-${i}`,x,z}))];
const session = new SceneSession({ tier: 'high', backend: 'webgl2' });
const receipts: unknown[] = [];
try {
  await session.open(); let level = '';
  for (const row of rows) {
    if (row.level !== level) { await session.inspectLevel(row.level); level = row.level; }
    const state = await session.page.evaluate(async ({x,z}) => {
      const a = window.__SS__!;
      a.inspect.enable(false); a.teleport('player', {x,z}); a.camera.follow(); a.camera.zoom(1);
      a.resume(); await new Promise(r=>setTimeout(r,350)); a.pause(); await a.screenshotReady();
      return a.getState().render;
    }, row);
    const file = `${out}/${row.level}-${row.id}.png`;
    await session.screenshot(file); receipts.push({...row,file,state});
    writeFileSync(`${out}/receipts.json`, JSON.stringify(receipts,null,2));
  }
} finally { await session.close(); stopServer(); }
