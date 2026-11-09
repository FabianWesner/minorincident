/** One short pooled capture packet: production tour plus its unchanged healthy primate population. */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { launchBrowser } from '../browser-pool/client';
import { provenance } from './accept/probe';

// E2E_SERIAL admission lets the offline preparation and its capture share one
// short reservation after the load-time lane's quiet measurements finish.
if (process.argv.includes('--prepare') || process.argv.includes('--verify')) {
  for (const command of [
    ...(process.argv.includes('--prepare') ? [[process.execPath, '--import', 'tsx', 'tools/assets/build-l8-monkeys.ts']] : []),
    ['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'],
    [process.execPath, '--import', 'tsx', 'tools/assets/validate.ts', '--ids', 'amb.monkey,inf.monkey'],
    [process.execPath, '--import', 'tsx', 'tools/qa/l8-habitats.ts'],
  ]) execFileSync(command[0], command.slice(1), { stdio: 'inherit' });
}
if (process.argv.includes('--audit')) execFileSync(process.execPath, ['--import', 'tsx', 'tools/qa/l8-habitats.ts'], { stdio: 'inherit' });

const socket = createServer();
await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
const address = socket.address(); assert(address && typeof address !== 'string');
process.env.SCENE_PORT = String(address.port);
await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
const { SceneSession, stopServer } = await import('../scenelab/session');
const out = 'docs/reports/p1-l8apes'; mkdirSync(out, { recursive: true });
const files = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
const hashes = Object.fromEntries(Object.entries(files).filter(([id]) => /^(amb|inf)\.monkey:/.test(id)).map(([id, path]) => [id, { path, sha256: createHash('sha256').update(readFileSync(`public${path}`)).digest('hex') }]));
const captures: unknown[] = [];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const quality of ['low', 'high'] as const) {
    const session = new SceneSession({ backend: 'webgl2', tier: quality, seed: 1808, viewport: { width: 1600, height: 900 }, query: { ui: '1' } });
    try {
      await session.open(browser);
      const requestedResources: string[] = [];
      session.page.context().on('request', request => { if (request.url().includes('monkey')) requestedResources.push(request.url()); });
      await session.page.addStyleTag({ content: '#hud,.hud{visibility:visible!important}.menus,.pause-button{display:none!important}' });
      await session.page.evaluate(async quality => {
        const ss = window.__SS__!; await ss.loadLevel('L8', { seed: 1808, progression: 'L8-default' });
        ss.settings.set({ quality }); ss.missions.begin(); ss.pause(); ss.bot.start('complete');
        // Ordinary production input, advanced deterministically to the PO's calm-tour tick.
        for (let n = 0; n < 3211; n += 120) await ss.step(Math.min(120, 3211 - n));
        ss.bot.stop();
      }, quality);
      const tourPlayer = await session.page.evaluate(() => window.__SS__!.getEntity(1)!.transform);
      for (const subject of ['tour', 'primate-yard'] as const) for (const zoom of [1, 1.5]) {
        await session.page.evaluate(async ({ subject, zoom, tourPlayer }) => {
          const ss = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          ss.teleport('player', subject === 'tour' ? tourPlayer : { x: -8.5, z: 25.95 });
          game.view.view.reset(game.world.entities.get(1)!.transform); ss.camera.zoom(zoom);
          if (subject === 'primate-yard') {
            const camera = game.view.view.getState(), target: [number, number, number] = [-15.2, .3, 26];
            const position = camera.position.map((v, i) => v - camera.target[i] + target[i]) as [number, number, number];
            ss.camera.cinematic({ position, target }, true);
          }
          await ss.screenshotReady();
        }, { subject, zoom, tourPlayer });
        const name = `${quality}-${subject}-z${zoom}.png`;
        await session.screenshot(`${out}/${name}`);
        const state = await session.page.evaluate(() => {
          const ss = window.__SS__!, state = ss.getState(), zoo = state.l8!, perf = ss.perf();
          return { tick: ss.tick(), player: ss.getEntity(1)!.transform, quality: state.render.quality, backend: state.render.backend, camera: state.render.camera,
            perf: { drawCalls: perf.drawCalls, triangles: perf.triangles, lighting: perf.lighting },
            breached: ss.missions.state()!.states.breached, animals: zoo.animals.map(id => { const e = ss.getEntity(id)!; return { id, species: e.civilian?.zooAnimal, at: e.transform, healthy: !!e.civilian && !e.infection && !e.infected, activity: e.civilian?.animalActivity?.kind ?? 'idle/walk' }; }),
            resources: performance.getEntriesByType('resource').map(r => r.name).filter(url => url.includes('monkey')) };
        });
        assert.equal(state.quality, quality); assert.equal(state.tick, 3211); assert(!state.breached && state.animals.every(a => a.healthy));
        captures.push({ file: name, subject, zoom, ...state, requestedResources: [...new Set(requestedResources)], errors: [...session.errors] });
      }
      assert(requestedResources.some(url => url.endsWith(files['amb.monkey:lod1:infected'])), `capture did not consume the rebuilt production monkey delivery: ${JSON.stringify(requestedResources)}`);
      assert.deepEqual(session.errors, []);
    } finally { await session.close(); }
  }
  writeFileSync(`${out}/captures.json`, JSON.stringify({ ...provenance(), method: 'Pooled headless WebGL2/Metal. Production L8 and complete-policy input to tick 3211. The yard shots move only the paused courier/camera; animal state and positions are unchanged.', hashes, captures }, null, 2) + '\n');
  console.log(JSON.stringify({ captures: captures.length, out }));
} finally { await browser.close(); stopServer(); }
