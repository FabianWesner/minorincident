import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { policeEngagementM } from '../../src/data/cameraFraming';

/** Reproduce the police approach at desktop and phone framing, including exact shot/visibility evidence.
 * Run headless through: SCENE_PORT=3387 sh tools/e2e-lock.sh npx tsx tools/scenelab/police-range.ts */
const spec = readSpec(resolve('docs/scenes/police-range/approach.json'));
for (const [name, width, height] of [['desktop', 960, 540], ['phone', 390, 844], ['phone-landscape', 844, 390]] as const) {
  const session = new SceneSession({ viewport: { width, height } }), out = resolve(`test-results/police-range/${name}`);
  try {
    await session.open();
    session.page.setDefaultTimeout(120_000);
    const capture = await runSpec(session, spec, { out });
    const metrics = await session.metrics();
    const track = metrics.actors.approaching.track?.flatMap(row => row.at ? [{ frame: row.frame, x: row.at[0], z: row.at[1] }] : []) ?? [];
    // The courier and camera stay at the origin in this fixture. Project the recorded positions
    // and shot endpoints from the captured run, so the evidence describes these exact images.
    const evidence = await session.page.evaluate(({ width, height, track }) => {
      const api = window.__SS__!, player = api.getEntity(1)!;
      let firstVisible = -1, firstAttack = -1;
      const attacks: { frame: number; visible: boolean; shot: boolean; point: { x: number; y: number }; distanceM: number }[] = [];
      for (const row of track) {
        const point = api.input.project(row);
        if (point.x > 0 && point.x < width && point.y > 0 && point.y < height) { firstVisible = row.frame; break; }
      }
      for (const event of api.events(0)) {
        if (event.type !== 'ally.attack' || event.role !== 'officer' || !event.to) continue;
        const point = api.input.project(event.to);
        if (firstAttack < 0) firstAttack = event.tick;
        attacks.push({ frame: event.tick, visible: point.x > 0 && point.x < width && point.y > 0 && point.y < height, shot: true, point, distanceM: Math.hypot(event.to.x - player.transform.x, event.to.z - player.transform.z) });
      }
      return { firstVisible, firstAttack, attacks };
    }, { width, height, track });
    const pass = capture.pass && evidence.firstVisible >= 0 && evidence.firstAttack > evidence.firstVisible && evidence.attacks.some(a => a.shot) && evidence.attacks.every(a => a.visible && a.distanceM <= policeEngagementM);
    writeJson(`${out}/engagement.json`, { pass, ...evidence, consoleErrors: session.errors });
    console.log(JSON.stringify({ name, pass, firstVisible: evidence.firstVisible, firstAttack: evidence.firstAttack, shots: evidence.attacks.filter(a => a.shot).length }));
    if (!pass || session.errors.length) process.exitCode = 1;
  } catch (error) {
    writeJson(`${out}/error.json`, { error: String(error), stack: error instanceof Error ? error.stack : null, consoleErrors: session.errors });
    console.log(JSON.stringify({ name, pass: false, error: String(error) })); process.exitCode = 1;
  } finally { await session.close(); }
}
stopServer();
