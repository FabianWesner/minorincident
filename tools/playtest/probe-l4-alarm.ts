/** #118 probe: L4 in the real browser sim, report infected/pedestrian counts and spawn gates over the hold. Fixture setup via cheats. */
import { writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const tier = (process.env.TIER ?? 'low') as 'low' | 'high';
const session = new SceneSession({ backend: (process.env.BACKEND ?? 'webgl2') as 'webgl2' | 'webgpu', tier });
const rows: unknown[] = [];
try {
  await session.open(); const page = session.page; page.setDefaultTimeout(180_000);
  await page.addInitScript('window.__name = fn => fn');
  await page.goto(`${origin}/?testApi=1&scenelab=1&debug=1&renderer=${process.env.BACKEND === 'webgpu' ? 'webgpu' : 'webgl'}&quality=${tier}&dpr=1&audio=muted`);
  await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
  await page.evaluate(() => localStorage.removeItem('minor-incident.campaign'));
  await page.goto(`${origin}/?testApi=1&scenelab=1&debug=1&renderer=${process.env.BACKEND === 'webgpu' ? 'webgpu' : 'webgl'}&quality=${tier}&dpr=1&audio=muted`);
  await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click(); await page.getByTestId('level-L4').click({ force: true });
  await page.waitForFunction(() => { const g = (window.__SCENE__ as unknown as { game: { world: { scenario: string }; loading: boolean } }).game; return g.world.scenario === 'L4' && !g.loading && document.body.dataset.uiScreen === 'game'; });
  await page.waitForFunction(() => { const phase = window.__SS__!.missions.state()?.phase, b = document.querySelector<HTMLElement>('[data-testid="mission-button"]'); return phase === 'playing' || phase === 'briefing' && b && !b.hidden && b.offsetParent !== null; });
  if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'briefing')) await page.getByTestId('mission-button').click();
  const snap = () => page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l4!, d = w.infected!.director;
    let ped = 0, inf = 0, chars = 0; for (const e of w.entities.iterate()) { if (e.civilian && !e.infected && e.health.current > 0) ped++; if (e.infected && e.health.current > 0) inf++; if (!e.hidden && e.health.current > 0 && (e.infected || e.civilian)) chars++; }
    const comp: Record<string, number> = {}; for (const e of w.infected!.active) { const k = `${e.health.current > 0 ? 'alive' : 'zero'}|rec${e.infected!.recoverAt >= 0 ? '>=0' : '<0'}|${e.infected!.state}|${e.hidden ? 'hid' : 'vis'}|${e.corpse ? 'corpse' : ''}`; comp[k] = (comp[k] ?? 0) + 1; }
    const sample = w.infected!.active.filter(e => e.health.current <= 0).slice(0, 4).map(e => ({ id: e.id, rec: e.infected!.recoverAt - w.tick, dead: e.infected!.deadAt - w.tick, held: (w as any).npcs?.civilians.holds(e.id), pa: !!e.pendingAdmission, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), keys: Object.keys(e).join(',') }));
    const per = (w.missions as any).def ? { x0: -35.6, x1: -9.2, z0: -17.4, z1: 22.5 } : null!; const sold = new Set(s.soldierIds); const wall = [...w.entities.iterate()].filter(e => e.civilian && !e.infected && e.health.current > 0 && !e.hidden && !sold.has(e.id) && e.id !== 1 && e.transform.x > per.x0 - .1 && e.transform.x < per.x1 + .1 && e.transform.z > per.z0 - .1 && e.transform.z < per.z1 + .1 && Math.min(e.transform.x - per.x0, per.x1 - e.transform.x, e.transform.z - per.z0, per.z1 - e.transform.z) < 1.5).length; const insideCiv = [...w.entities.iterate()].filter(e => e.civilian && !e.infected && e.health.current > 0 && !e.hidden && !sold.has(e.id) && e.id !== 1 && e.transform.x > per.x0 && e.transform.x < per.x1 && e.transform.z > per.z0 && e.transform.z < per.z1).length;
    return { wall, insideCiv, comp: undefined, sample: undefined, tick: w.tick, phase: s.phase, ped, inf, chars, count: d.count, cap: d.cap, reserved: d.reserved, pool: w.infected!.pool.length, pend: s.pend, wave: s.wave, emerged: s.emergedIds.length, alphas: s.alphaIds.length, tier: w.infected!.director.cap };
  });
  await page.evaluate(() => window.__SS__!.pause());
  // drive the story: wait for the convoy to arrive, then pick the gun
  for (let i = 0; i < 60; i++) { const ph = (await snap()).phase; if (ph !== 'convoy') break; await page.evaluate(() => window.__SS__!.step(300)); }
  await page.evaluate(() => { window.__SS__!.cheats.completeObjective('quartermaster'); });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__SS__!.step(300)); const r = await snap(); rows.push(r); console.log(JSON.stringify(r)); if (r.phase !== 'war' && r.phase !== 'plaza') break; }
  writeFileSync(`${process.env.OUT ?? '/tmp/l4-alarm-probe'}-${tier}.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
