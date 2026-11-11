// r33-vqa: L4 shot-zombie engage + health-bar rule, in the browser at the game camera.
// Setup (logged): a runner chasing a cashier 3-6 m from the courier, plus one untouched runner ~9 m away.
// Then REAL input: mouse over the runner's chest, tap Space (one shot burst). Captures at +0 .. +1.5 s and logs
// the runner's target id and facing error toward the courier per sample.
//   E2E_PORT=4926 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/r33/aggro-bars.ts <origin> --out <dir> [--level L4] [--checkpoint line-1] [--quality low] [--zoom 1.5] [--backend webgpu] [--weapon 2]
import { mkdirSync, appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchProfile } from '../../browser-pool/client';
import { look } from '../../playtest/eyes';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, level: { type: 'string', default: 'L4' }, checkpoint: { type: 'string', default: 'line-1' }, quality: { type: 'string', default: 'low' }, zoom: { type: 'string', default: '1.5' }, backend: { type: 'string', default: 'webgpu' }, weapon: { type: 'string', default: '4' }, trials: { type: 'string', default: '4' }, variant: { type: 'string', default: 'inf.common-worker' },
} });
const [origin] = positionals;
const out = resolve(values.out!); mkdirSync(out, { recursive: true });
const log = (o: object) => appendFileSync(`${out}/log.jsonl`, JSON.stringify(o) + '\n');
const context = await launchProfile(mkdtempSync(`${tmpdir()}/r33aggro-`), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.addInitScript({ content: 'window.__name = (f) => f;' });
try {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&${values.backend === 'webgpu' ? '' : 'renderer=webgl&'}dpr=1&audio=muted&quality=${values.quality}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
  await page.evaluate(async q => { await window.__SS__!.ready; window.__SS__!.settings.set({ quality: q as 'low' }); }, values.quality!);
  await page.evaluate(async ([lvl, cp]) => { const a = window.__SS__!; await a.loadLevel(lvl, { seed: 1, checkpoint: cp || undefined }); a.pause(); a.cheats.god(true); await a.step(60); for (let k = 0; k < 200 && a.getEntity(1)!.hidden; k++) await a.step(60); }, [values.level!, values.checkpoint!] as const);
  await page.evaluate(z => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(z); a.resume(); }, Number(values.zoom));
  await page.getByTestId('mission-button').click({ timeout: 5000 }).catch(() => undefined); // close the briefing (Begin mission)
  for (let k = 0; k < 120; k++) { // L4 convoy ride: wait until the courier is on foot and the sim runs
    const s = await page.evaluate(() => { const a = window.__SS__!; return { hidden: !!a.getEntity(1)?.hidden, tick: a.tick() }; });
    if (!s.hidden && s.tick > 120) break;
    if (k % 10 === 9) await page.getByTestId('mission-button').click({ timeout: 1000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
  log({ ready: await page.evaluate(() => ({ tick: window.__SS__!.tick(), hidden: !!window.__SS__!.getEntity(1)?.hidden })) });
  await page.mouse.click(640, 360);
  await page.keyboard.press(`Digit${values.weapon}`);
  for (let i = 0; i < Number(values.trials); i++) {
    const setup = await page.evaluate(([i, variant]) => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: { world: any } }).game.world; // eslint-disable-line @typescript-eslint/no-explicit-any
      a.pause();
      const p = w.entities.get(1)!, px = p.transform.x, pz = p.transform.z;
      for (const e of [...w.entities.iterate()]) if (e.infected && e.health.current > 0 && Math.hypot(e.transform.x - px, e.transform.z - pz) < 30) w.infected.release(e);
      const range = 3.5 + (i % 3) * 1.2, base = 0.6 + i * 1.7;
      for (let k = 0; k < 24; k++) {
        const ang = base + k * .5, x = px + Math.cos(ang) * range, z = pz + Math.sin(ang) * range;
        const cx = x + Math.cos(ang + Math.PI / 2) * 1.6, cz = z + Math.sin(ang + Math.PI / 2) * 1.6;
        const ox = px + Math.cos(ang + Math.PI) * 9, oz = pz + Math.sin(ang + Math.PI) * 9;
        try {
          const id = w.infected.spawn('infected.runner', { x, z }, { variant, state: 'chase' });
          const civ = w.npcs.civilians.spawn('cashier', { x: cx, z: cz }, { waypoints: [{ x: cx, z: cz }] });
          let other = 0; try { other = w.infected.spawn('infected.runner', { x: ox, z: oz }, { variant, state: 'idle' }); } catch { /* optional */ }
          return { id, civ, other, range, px, pz };
        } catch { /* next */ }
      }
      return null;
    }, [i, values.variant!] as const);
    log({ trial: i, setup });
    if (!setup) continue;
    await page.evaluate(() => window.__SS__!.resume());
    await page.waitForTimeout(1200); // runner goes for the cashier
    const probe = (label: string) => page.evaluate(([id, label]) => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: { world: any } }).game.world; // eslint-disable-line @typescript-eslint/no-explicit-any
      const q = w.entities.get(id), p = w.entities.get(1);
      if (!q || !p) return { label, gone: true };
      const dx = p.transform.x - q.transform.x, dz = p.transform.z - q.transform.z;
      const err = Math.abs(Math.atan2(Math.sin(-Math.atan2(dz, dx) - q.transform.yaw), Math.cos(-Math.atan2(dz, dx) - q.transform.yaw)));
      return { label, tick: a.tick(), hp: q.health.current, hitByPlayer: !!q.infected?.hitByPlayer, target: q.infected?.l1?.targetId ?? q.infected?.heardTargetId ?? null, mode: q.infected?.l1?.mode ?? q.infected?.state, faceErrDeg: Math.round(err * 57.3), d: +Math.hypot(dx, dz).toFixed(1) };
    }, [setup.id, label] as const);
    log({ trial: i, ...(await probe('pre')) });
    await page.screenshot({ path: `${out}/t${i}-a-pre.jpg`, type: 'jpeg', quality: 75 });
    const e = await page.evaluate(look);
    const body = e.enemies.find(b => b.id === setup.id);
    if (!body) { log({ trial: i, note: 'runner not drawn/aimable' }); continue; }
    await page.mouse.move(body.aim.x, body.aim.y);
    await page.keyboard.down('Space'); await page.waitForTimeout(120); await page.keyboard.up('Space');
    const t0 = Date.now();
    for (const [ms, tag] of [[150, 'b'], [400, 'c'], [700, 'd'], [1100, 'e'], [1600, 'f']] as const) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      log({ trial: i, ms, ...(await probe(`+${ms}`)) });
      await page.screenshot({ path: `${out}/t${i}-${tag}-${ms}ms.jpg`, type: 'jpeg', quality: 75 });
    }
    await page.evaluate(([id, civ, other]) => { const w = (window.__SCENE__ as unknown as { game: { world: any } }).game.world; for (const x of [id, other]) { const e = w.entities.get(x); if (e?.infected) w.infected.release(e); } const c = w.entities.get(civ); if (c) c.health.current = 0; }, [setup.id, setup.civ, setup.other] as const); // eslint-disable-line @typescript-eslint/no-explicit-any
    await page.waitForTimeout(500);
  }
} finally { await context.close(); }
