import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';

/** L10 start playthrough through R1 (crash outskirts) and R2 (residential fringe) with the follow (game) camera.
 *  SCENE_PORT=3489 sh tools/e2e-lock.sh tsx tools/qa/l10-start-play.ts [--tier high|low] [--backend webgl2|webgpu] [--zoom 1] [--to 1257] [--out dir]
 *  The player walks real click-to-move hops east along the road (god mode on, so the walk is not cut short by a death);
 *  every hop writes a game-camera JPEG into a contact sheet and logs player position, facing vs velocity and nearby entity counts. */
const args = process.argv.slice(2), flag = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const tier = flag('tier', 'high') as 'high' | 'low', backend = flag('backend', 'webgl2') as Backend, to = Number(flag('to', '1257')), zoom = Number(flag('zoom', '1')), ck = flag('checkpoint', '');
const out = flag('out', `test-results/qa-l10-play/${tier}-${backend}-z${zoom}`); mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 }, query: { test: '1' } });
try {
  await session.open();
  const p = session.page;
  await p.evaluate(async ck => { await window.__SS__!.loadLevel('L10', { seed: 32, ...(ck ? { checkpoint: ck } : {}) }); window.__SS__!.pause(); window.__SS__!.cheats.god(true); window.__SS__!.camera.follow(); }, ck);
  await p.mouse.move(480, 270);
  if (zoom !== 1) for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, zoom < 1 ? 120 : -120); await p.evaluate(() => window.__SS__!.step(8)); }
  const cells: { frame: number; jpeg: Buffer }[] = [], log: unknown[] = [];
  let prev: { x: number; z: number } | null = null, stuck = 0;
  for (let hop = 0; hop < 120; hop++) {
    const s = await p.evaluate(() => { const g = window.__SS__!.getState(), pl = g.player!; return { x: pl.transform.x, z: pl.transform.z, yaw: pl.transform.yaw, vx: (pl as unknown as { velocity?: { x: number; z: number } }).velocity?.x ?? 0, vz: (pl as unknown as { velocity?: { x: number; z: number } }).velocity?.z ?? 0, hp: pl.health, terrain: JSON.stringify(window.__SS__!.perf().terrain), tick: g.tick, ckpt: window.__SS__!.missions.state()?.checkpoint, zombies: window.__SS__!.query({ team: 'infected' } as never).length }; });
    log.push(s);
    if (s.x >= to) break;
    stuck = prev && Math.hypot(s.x - prev.x, s.z - prev.z) < 1 ? stuck + 1 : 0; prev = s;
    // step past a blocker: nudge sideways when stuck
    const tz = stuck >= 2 ? s.z + (stuck % 2 ? 10 : -10) : s.z;
    await p.evaluate(({ x, z }) => { window.__SS__!.input.set({ moveTarget: { x, z }, pointerGround: true, navigation: true } as never); }, { x: s.x + 14, z: tz });
    await p.evaluate(() => window.__SS__!.step(150));
    cells.push({ frame: s.tick, jpeg: await session.snapshot() });
    if (hop % 4 === 0) await session.screenshot(`${out}/hop-${String(hop).padStart(3, '0')}.png`);
  }
  for (let i = 0; i * 16 < cells.length; i++) await session.makeSheet(cells.slice(i * 16, i * 16 + 16), `${out}/sheet-${i}.jpg`, 480, 700);
  writeFileSync(`${out}/log.json`, JSON.stringify({ log, consoleErrors: session.errors }, null, 1));
  console.log(JSON.stringify({ out, hops: cells.length, last: log[log.length - 1], errors: session.errors.length }));
} catch (e) { console.error(e); process.exitCode = 1; } finally { await session.close(); await stopServer(); }
