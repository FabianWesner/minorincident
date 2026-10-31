/** Controlled main/after/PROD asset comparison in the unchanged q257 runtime. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetDef } from '../../src/assets/types';
import type { CameraSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../../tools/scenelab/session';

const [phase = 'after', tierArg = 'high'] = process.argv.slice(2);
const tier = tierArg === 'low' ? 'low' : 'high';
const revision = phase === 'before' ? 'c7e1c130c' : phase === 'prod' ? 'fd8f56ca3' : undefined;
const historical = (path: string) => execFileSync('git', ['show', `${revision}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
const out = resolve('docs/reports/q260/visual', `${phase}-${tier}`);
mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier, viewport: { width: 1280, height: 900 }, log: console.log });
const served: { path: string; sha256: string }[] = [];
const orbitOnly = process.env.Q260_ORBIT_ONLY === '1';
const receipts: { shot: string; spec: SceneSpec; metrics: unknown }[] = orbitOnly
  ? JSON.parse(readFileSync(`${out}/receipts.json`, 'utf8')).receipts.filter((receipt: { shot: string }) => receipt.shot !== 'orbit') : [];
try {
  await session.open();
  if (revision) {
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
    const prior = (JSON.parse(historical('src/assets/manifest.json').toString()) as AssetDef[]).find(row => row.id === 'inf.crawler')!;
    const bakes = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
    const priorBakes = JSON.parse(historical('src/assets/civilianBakes.json').toString()) as Record<string, string>;
    for (const key of Object.keys(bakes)) if (key.startsWith('inf.crawler:')) bakes[key] = priorBakes[key];
    manifest[manifest.findIndex(row => row.id === 'inf.crawler')] = prior;
    await session.page.route('**/src/assets/manifest.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(manifest)}` }));
    await session.page.route('**/src/assets/civilianBakes.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(bakes)}` }));
    await session.page.route(/\/assets\/.*\/inf\.crawler[^?]+/, async route => {
      const path = 'public' + new URL(route.request().url()).pathname;
      const body = historical(path);
      served.push({ path, sha256: createHash('sha256').update(body).digest('hex') });
      await route.fulfill({ contentType: 'application/octet-stream', body });
    });
    await session.page.reload();
    await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  }
  const lineup: SceneSpec = {
    name: 'q260-game15', ground: 'sidewalk', size: 30, time: 'L1', dof: false,
    actors: [
      { id: 'heroine', kind: 'courier', at: [-2.4, 0], yaw: 160, look: { model: 'female' }, state: 'idle' },
      { id: 'worker', kind: 'infected', at: [0, 0], yaw: 160, look: { model: 'inf.common-worker' }, state: 'idle' },
      { id: 'mom', kind: 'infected', at: [2.4, 0], yaw: 160, look: { model: 'inf.suburban-mom' }, state: 'idle' },
      { id: 'z', kind: 'infected', at: [0, 2.6], yaw: 160, archetype: 'infected.crawler', state: 'idle' },
    ], camera: { mode: 'game', target: [0, 0, 1], zoom: 1.5 },
  };
  if (!orbitOnly) {
    await session.load(lineup); await session.step(60); await session.ready();
    await session.page.screenshot({ path: `${out}/game15.jpg`, type: 'jpeg', quality: 94 });
    receipts.push({ shot: 'game15', spec: lineup, metrics: await session.metrics() });
  }
  const orbit: SceneSpec = {
    name: 'q260-orbit', ground: 'sidewalk', size: 20, time: 'L1', dof: false,
    actors: [{ id: 'z', kind: 'infected', at: [0, 0], yaw: 0, archetype: 'infected.crawler', state: 'idle' }],
    camera: { mode: 'orbit', target: [0, .25, 0], radius: 3, polar: 60, azimuth: 0 },
  };
  await session.load(orbit);
  const orbitFrames = [];
  for (let frame = 30; frame <= 360; frame += 30) {
    await session.step(30);
    await session.page.evaluate(frame => {
      const lab = window.__SCENE__ as unknown as { game: Game; actors: Map<string, { entity: number }>; setCamera: (camera: CameraSpec) => void };
      const actor = lab.actors.get('z')!;
      const entity = lab.game.world.entities.get(actor.entity)!;
      lab.setCamera({ mode: 'orbit', target: [entity.transform.x, .25, entity.transform.z], radius: 3, polar: 60, azimuth: frame });
    }, frame);
    orbitFrames.push({ frame, jpeg: await session.snapshot() });
  }
  await session.makeSheet(orbitFrames, `${out}/orbit.jpg`, 400, 650);
  receipts.push({ shot: 'orbit', spec: orbit, metrics: await session.metrics() });
  const motion: SceneSpec = {
    name: 'q260-crawl-attack-death', ground: 'sidewalk', size: 30, time: 'L1', dof: false, trace: true,
    actors: [
      { id: 'hero', kind: 'courier', at: [0, 0], yaw: 90, god: true, look: { model: 'female' }, state: 'idle' },
      { id: 'z', kind: 'infected', at: [4, 0], yaw: 270, archetype: 'infected.crawler', state: 'idle' },
    ],
    script: [{ frame: 20, actor: 'z', do: 'chase' }, { frame: 300, actor: 'z', do: { hit: { from: 'hero', heavy: true, amount: 999 } } }],
    camera: { mode: 'close', target: 'z', radius: 3, azimuth: 120 },
  };
  if (!orbitOnly) {
    await session.load(motion);
    const motionFrames = []; let previous = 0;
    for (const frame of [20, 60, 100, 150, 200, 240, 280, 299, 303, 310, 325, 345, 380, 420, 480]) {
      await session.step(frame - previous); previous = frame;
      motionFrames.push({ frame, jpeg: await session.snapshot() });
    }
    await session.makeSheet(motionFrames, `${out}/crawl-attack-death.jpg`, 400, 850);
    const motionMetrics = await session.metrics();
    receipts.push({ shot: 'crawl-attack-death', spec: motion, metrics: motionMetrics });
    if (!motionMetrics.pursuit.courierAttacks || motionMetrics.actors.z.state !== 'dead') throw Error('Motion fixture must actually attack and die');
  }
  writeFileSync(`${out}/receipts.json`, JSON.stringify({ phase, tier, revision: revision ?? 'worktree', comparison: 'Only crawler asset + dimensions/bake entries vary; current q257 runtime and other figures retained', served, errors: session.errors, receipts }, null, 2) + '\n');
  if (session.errors.length) throw Error(session.errors.join('\n'));
  if (revision && !served.some(row => row.path.endsWith('.bin.gz'))) throw Error('Historical crawler bake was not requested');
  console.log(`Captured ${phase} ${tier}: game zoom 1.5, full close orbit, crawl/attack/death.`);
} finally { await session.close(); stopServer(); }
