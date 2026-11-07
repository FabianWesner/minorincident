/** Physical bat input at vqa58's reported L1 pin; setup only is staged. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { look } from '../playtest/eyes';
import type { Game } from '../../src/Game';

const out = 'test-results/r5-vis/bat-contact'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend: 'webgl2', tier: 'low', query: { ui: '1' } });
try {
  await s.open(); await s.page.evaluate('window.__name = f => f');
  const setup = await s.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.cheats.god(true); a.pause();
    a.setLoadout(['weapon.bat'], ['weapon.bat']); a.teleport(1, { x: -75, z: 38.7 });
    const p = g.world.entities.get(1)!.transform, ids: number[] = [];
    for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3;
      try { ids.push(a.spawn('infected.runner', { x: p.x + Math.cos(t) * 1.08, z: p.z + Math.sin(t) * 1.08 }, { state: 'chase' })); } catch { /* actual solid admission */ }
    }
    a.camera.follow(); a.camera.zoom(1); g.view.view.reset(p); await a.screenshotReady();
    return { player: { ...p }, targets: ids.map(id => ({ id, hp: a.getEntity(id)!.health.current, at: a.getEntity(id)!.transform })) };
  });
  const start = await s.page.evaluate(() => { window.__SS__!.resume(); return window.__SS__!.tick(); });
  let held = false;
  for (let i = 0; i < 60; i++) {
    const eyes = await s.page.evaluate(look), target = eyes.enemies.find(e => e.d < 3);
    if (target) { await s.page.mouse.move(target.aim.x, target.aim.y); if (!held) { await s.page.mouse.down(); held = true; } }
    await s.page.waitForTimeout(120);
    if (i === 15) await s.page.screenshot({ path: `${out}/physical-swings.jpg`, type: 'jpeg', quality: 90 });
  }
  if (held) await s.page.mouse.up();
  const result = await s.page.evaluate(start => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.pause();
    return { start, tick: a.tick(), events: a.events(start).filter(e => (e.type === 'combat.attack' || e.type === 'combat.hit' || e.type === 'combat.kill') && e.sourceId === 1),
      frame: g.world.inputFrame, player: a.getEntity(1), quality: a.getState().render.quality };
  }, start);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, result, errors: s.errors }, null, 2));
  console.log(JSON.stringify({ attacks: result.events.filter(e => e.type === 'combat.attack').length, hits: result.events.filter(e => e.type === 'combat.hit').length, kills: result.events.filter(e => e.type === 'combat.kill').length }));
} finally { await s.close(); stopServer(); }
