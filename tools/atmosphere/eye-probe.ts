/** Reproduce the standing E25 night eye measurement while varying only bloom. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, port, origin } from '../scenelab/session';
const out = `docs/reports/atmosphere/eye-probe${process.env.ATMOSPHERE_BASELINE_DIST ? '-baseline' : ''}`;
let baselineServer: ReturnType<typeof spawn> | undefined;
const session = new SceneSession({ viewport: { width: 1600, height: 900 } });
const lum = (r: number, g: number, b: number) => {
  const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4;
  return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};
try {
  if (process.env.ATMOSPHERE_BASELINE_DIST) {
    if (await fetch(origin).then(() => true, () => false)) throw new Error(`Baseline port ${port} is occupied`);
    baselineServer = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--outDir', process.env.ATMOSPHERE_BASELINE_DIST, '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
    const deadline = Date.now() + 30_000;
    while (!await fetch(origin).then(r => r.ok, () => false)) {
      if (Date.now() > deadline) throw new Error('Baseline preview failed to start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  await session.open(); mkdirSync(out, { recursive: true });
  const heads = await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
    const spot = { x: 51, z: -32.5 }; a.teleport('player', spot);
    const ids = [0, 1, 2].map(i => a.spawn('infected.runner', { x: spot.x - 4 - i * .6, z: spot.z + 2.5 }, { state: 'idle', yaw: -Math.PI / 4 }));
    a.camera.follow(); await a.step(90); await a.screenshotReady();
    return ids.map(id => { const t = a.getEntity(id)!.transform; return { head: a.camera.project(t.x, t.y + .75, t.z), feet: a.camera.project(t.x, t.y - .7, t.z) }; });
  });
  const rows = [];
  for (const strength of [.25, .2, .16, .12, 0]) {
    await session.page.evaluate(strength => window.__SS__!.look.set({ version: 1, worldLook: { bloomStrength: strength }, palette: {} }), strength);
    await session.page.evaluate(() => window.__SS__!.screenshotReady());
    const image = PNG.sync.read(await session.page.locator('canvas').screenshot({ path: `${out}/bloom-${strength}.png` }));
    const eyes = heads.map(({ head, feet }) => {
      const x0 = Math.round((head[0] + 1) / 2 * image.width), y0 = Math.round((1 - head[1]) / 2 * image.height), y1 = Math.round((1 - feet[1]) / 2 * image.height), half = Math.max(8, Math.round((y1 - y0) * .45));
      let best = { luminance: -1, r: 0, g: 0, b: 0, redMargin: 0 };
      for (let y = y0 - half; y <= y1; y++) for (let x = x0 - half; x <= x0 + half; x++) {
        const i = (y * image.width + x) * 4, r = image.data[i], g = image.data[i + 1], b = image.data[i + 2], luminance = lum(r, g, b);
        if (luminance > best.luminance) best = { luminance, r, g, b, redMargin: r - Math.max(g, b) };
      }
      return best;
    });
    rows.push({ strength, eyes });
  }
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ rows, errors: session.errors }, null, 2) + '\n');
  console.log(JSON.stringify(rows));
} finally { await session.close(); stopServer(); baselineServer?.kill(); }
