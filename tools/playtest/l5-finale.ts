/** l5-finale (PO 11-01 "Check the camera view and needed movements at the end of L5. It's a bit strange."):
 * play the Metro finale by real input (WASD + mouse aim toward the destination ring), from the L5 survivor-5
 * checkpoint, and record a frame every 15 ticks (0.25 s) until the L6 handover. Paused + stepped, so frame
 * cadence does not depend on GPU speed. Sim state is read for the log only; steering uses the screen projection
 * of the only drawn destination (the Metro ring), like a player following the marker.
 *   npx tsx tools/playtest/l5-finale.ts --backend webgpu --quality low --zoom 1.5 --out test-results/l5-finale/x */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import { dodgeWalkKeys } from './input';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const backend = arg('backend', 'webgpu'), quality = arg('quality', 'low'), zoom = Number(arg('zoom', '1.5'));
const out = arg('out', `test-results/l5-finale/${backend}-${quality}-z${zoom}`);
const start = arg('start', '20,-40').split(',').map(Number) as [number, number];
const maxFrames = Number(arg('frames', '220'));
mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 4877), origin = `http://127.0.0.1:${port}`;
const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
let server: ReturnType<typeof spawn> | null = null;
try { await fetch(origin); } catch {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner', ...(process.env.L5_DIST ? ['--outDir', process.env.L5_DIST] : [])], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* starting */ } await hold(250); }
}
const args = backend === 'webgpu' ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await launchBrowser({ headless: true, args });
const log: unknown[] = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript('window.__name = f => f');
  await page.goto(`${origin}/?test=1&testApi=1&scenelab=1&dpr=1&audio=muted&quality=${quality}${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async q => { await window.__SS__!.ready; window.__SS__!.settings.set({ quality: q as 'low' }); await window.__SS__!.loadLevel('L5', { checkpoint: 'survivor-5' }); }, quality);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=level-transition]')?.hidden !== false, null, { timeout: 120_000 });
  const setup = await page.evaluate(({ start, zoom }) => {
    const ss = window.__SS__!; ss.pause(); ss.cheats.god(true); ss.cheats.killAll(); ss.camera.zoom(zoom);
    const def = (window as unknown as { __SCENE__: { game: { world: { missions: { def: { anchors: Record<string, { x: number; y?: number; z: number }> } } } } } }).__SCENE__.game.world.missions.def;
    const anchors = Object.fromEntries(Object.entries(def.anchors).filter(([k]) => k.startsWith('l5-metro')).map(([k, a]) => [k, [a.x, a.y ?? 0, a.z]]));
    const s = (ss.getState().mission as import("../../src/sim/missions/types").MissionState).l5!;
    // The group follows in single file behind the courier (west of her on the street); the corgi at heel.
    ss.teleport('player', { x: start[0], z: start[1] });
    const p = ss.getEntity(1)!.transform;
    if (Math.hypot(p.x - start[0], p.z - start[1]) > .5) throw new Error(`courier teleport to ${start} refused`);
    s.survivors.forEach((r, i) => ss.teleport(r.id, { x: start[0] - 1.6 - 1.2 * i, z: start[1] + (i % 2 ? .5 : -.5) }));
    const dog = ss.query({} as never).find(e => (e as { companion?: unknown }).companion);
    if (dog) for (const [dx, dz] of [[-1.2, 0], [-1, .8], [-1, -.8], [-2, 0], [0, 1], [0, -1]]) {
      ss.teleport(dog.id, { x: start[0] + dx, z: start[1] + dz });
      if (Math.hypot(ss.getEntity(dog.id)!.transform.x - start[0] - dx, ss.getEntity(dog.id)!.transform.z - start[1] - dz) < .5) break;
    }
    return { anchors, render: ss.getState().render.backend, quality: ss.getState().render.quality };
  }, { start, zoom });
  console.log(JSON.stringify(setup));
  await page.evaluate(() => window.__SS__!.step(90));
  const ring = setup.anchors['l5-metro-in'] as number[];
  // A player walks along the pavement to the stair mouth, then down to the ring (the stair walls block a diagonal).
  const mouth = [ring[0], 0, Number(arg('mouthz', '-44.6'))];
  let target = mouth;
  const down = new Set<string>();
  const press = async (keys: string[]) => {
    for (const k of [...down]) if (!keys.includes(k)) { await page.keyboard.up(k); down.delete(k); }
    for (const k of keys) if (!down.has(k)) { await page.keyboard.down(k); down.add(k); }
  };
  let doneFrame = -1, frame = 0, attempt = 0, last: number[] | undefined; const studied = new Set<string>();
  for (; frame < maxFrames; frame++) {
    const st = await page.evaluate(t => {
      const ss = window.__SS__!, st = ss.getState(), m = st.mission as import("../../src/sim/missions/types").MissionState | null, p = ss.getEntity(1)?.transform;
      const goal = ss.input.project({ x: t[0], z: t[2] }, 'destination'), me = p ? ss.input.project(p, 'player') : goal;
      const dog = ss.query({} as never).find(e => (e as { companion?: unknown }).companion);
      const card = document.querySelector<HTMLElement>('[data-testid=level-transition]');
      return { tick: st.tick, scenario: st.scenario, phase: m?.phase, l5: m?.l5 && { phase: m.l5.phase, metroAt: m.l5.metroAt, shutterAt: m.l5.shutterAt, doneAt: m.l5.doneAt },
        objective: (document.querySelector('.objective-text')?.parentElement?.textContent ?? '').trim().slice(0, 140),
        player: p && [+p.x.toFixed(2), +p.z.toFixed(2), +(p.y ?? 0).toFixed(2), +p.yaw.toFixed(2)],
        survivors: m?.l5?.survivors.map(r => { const e = ss.getEntity(r.id)!; return [r.key, r.status, +e.transform.x.toFixed(2), +e.transform.z.toFixed(2), +e.transform.yaw.toFixed(2)]; }),
        dog: dog && [+dog.transform.x.toFixed(2), +dog.transform.z.toFixed(2), +dog.transform.yaw.toFixed(2), (dog as unknown as { companion: { state: string } }).companion.state],
        camera: { spot: st.render.camera.spot, position: st.render.camera.position.map(v => +v.toFixed(2)), target: st.render.camera.target.map(v => +v.toFixed(2)) },
        goal, me, card: !!card && !card.hidden };
    }, target);
    log.push({ frame, ...st });
    await page.screenshot({ path: `${out}/f${String(frame).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70 });
    if (st.l5?.doneAt && doneFrame < 0) doneFrame = frame;
    if (doneFrame >= 0 && frame - doneFrame >= 24) break;
    // Reveal study (L5_SEE=1): at three story moments, the same paused frame with the see-through cut off and on.
    const moment = st.l5?.doneAt ? 'done' : st.l5?.shutterAt && st.tick - st.l5.shutterAt >= 60 ? 'closing' : st.l5?.metroAt && st.tick - st.l5.metroAt >= 75 ? 'arrival' : null;
    if (process.env.L5_SEE === '1' && moment && !studied.has(moment)) {
      studied.add(moment);
      for (const off of [true, false]) {
        await page.evaluate(o => { (window as unknown as { __SCENE__: { game: { view: { settings(p: object): void } } } }).__SCENE__.game.view.settings({ seeThroughOff: o }); return window.__SS__!.step(1); }, off);
        await hold(300);
        await page.screenshot({ path: `${out}/see-${moment}-${off ? 'off' : 'on'}.jpg`, type: 'jpeg', quality: 70 });
      }
    }
    if (st.scenario !== 'L5') break;
    // Player: walk toward the ring until standing in it; then wait (the HUD asks to stay on the stairs).
    if (target === mouth && st.player && Math.hypot(st.player[0] - mouth[0], st.player[1] - mouth[2]) < .8) target = ring;
    const near = target === ring && st.player && Math.hypot(st.player[0] - ring[0], st.player[1] - ring[2]) < .55;
    const dx = st.goal.x - st.me.x, dy = st.goal.y - st.me.y;
    await page.mouse.move(st.goal.x, st.goal.y);
    // Blocked (a wreck, a kerb, a follower): sidestep like a player would, then try the bearing again.
    if (st.player && last && down.size && Math.hypot(st.player[0] - last[0], st.player[1] - last[1]) < .15) attempt++; else if (attempt && frame % 3 === 0) attempt = 0;
    last = st.player;
    // Inside the station the HUD says to wait for the group: stand still (followers may nudge her down a step).
    const keys = near || st.l5?.metroAt || st.l5?.shutterAt ? [] : dodgeWalkKeys(dx, dy, attempt);
    (log[log.length - 1] as Record<string, unknown>).keys = keys.join('+');
    await press(keys);
    await page.evaluate(() => window.__SS__!.step(15));
  }
  await press([]);
  console.log(JSON.stringify({ frames: frame, doneFrame, errors }));
} finally {
  writeFileSync(`${out}/log.json`, JSON.stringify(log));
  await browser.close(); server?.kill();
}
