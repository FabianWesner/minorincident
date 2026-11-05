/** Q-299/Q-300/Q-302 live L5: the real mission after the search, every survivor armed through the production pickup rule
 * (Pickups.armSurvivor) with the street weapon types, standing and walking behind the courier; the corgi beside the
 * remaining street firearms (Q-300: it must leave them where they lie); the search spots and street weapons without rings.
 * SCENE_PORT=4898 E2E_PORT=4897 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q299-l5-live.ts <outDir> [low|high]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/q299-live';
const tier = (process.argv[3] ?? 'high') as 'low' | 'high';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const s = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2, query: { level: 'L5' } });
const zoomTo = (z: number) => s.page.evaluate(async z => {
  const a = window.__SS__!, rig = (window.__SCENE__ as unknown as { game: Game }).game.view.view;
  rig.zoom(Math.log(z / rig.getState().targetZoom), true); await a.step(2); await a.screenshotReady();
}, z);
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = (fn) => fn');
  await s.page.evaluate(async (tier) => {
    const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' });
    a.settings.set({ quality: tier }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
    a.missions.completeObjective('emerge'); await a.step(30);
  }, tier);
  // Search phase, before anyone is found: no ring at any hiding place, street weapons drawn without their yellow ring.
  const search = await s.page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
    await a.step(12 * 60);
    const street = [...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly);
    const t = street[0].transform; a.teleport(1, { x: t.x + 1.6, z: t.z + 1.2 }); await a.step(4); await a.screenshotReady();
    let rings = 0; game.view.scene.traverse(o => { if (/survivor-ring|survivor-spot/.test(o.name) && o.visible) rings++; });
    return { phase: w.missions?.state.l5?.phase, streetWeapons: street.length, survivorRings: rings, at: [t.x, t.z] };
  });
  console.log('search', JSON.stringify(search)); rows.push({ search });
  for (const z of [1.5, 0.5]) { await zoomTo(z); await s.page.screenshot({ path: `${out}/${tier}-street-weapon-z${z}.jpg`, type: 'jpeg', quality: 82 }); }
  // Q-302: at a hiding place (Rosa's) during the search: no ring, no pin; the trigger still finds her.
  const spot = await s.page.evaluate(async () => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, m = w.missions!;
    const r = m.def.anchors['l5-ring-rosa']; a.teleport(1, { x: r.x + 2.6, z: r.z + 1.2 }); await a.step(4); await a.screenshotReady();
    const pin = document.querySelector('[data-survivor]') as HTMLElement | null;
    return { anchor: [r.x, r.z], pinShown: !!pin && !pin.hidden && pin.offsetParent !== null };
  });
  console.log('spot', JSON.stringify(spot)); rows.push({ spot });
  for (const z of [1.5, 0.5]) { await zoomTo(z); await s.page.screenshot({ path: `${out}/${tier}-hiding-place-z${z}.jpg`, type: 'jpeg', quality: 82 }); }
  const found = await s.page.evaluate(async () => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, m = w.missions!, r = m.def.anchors['l5-ring-rosa'];
    a.teleport(1, { x: r.x, z: r.z }); for (let i = 0; i < 6; i++) await a.step(30);
    return m.state.l5!.survivors.find(x => x.key === 'rosa')!.status;
  });
  console.log('found', found); rows.push({ rosaAfterStanding: found });
  // Back to the street weapons for the corgi check.
  await s.page.evaluate(async () => { const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world; const e = [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly)!; a.teleport(1, { x: e.transform.x + 1.6, z: e.transform.z + 1.2 }); await a.step(4); });
  // Q-300: the corgi beside the courier next to street firearms for 20 s: none may move under her feet.
  const fetch = await s.page.evaluate(async () => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    const street = [...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly).map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z }));
    const fetched: number[] = []; w.events.on('corgi.fetched', e => { if (e.type === 'corgi.fetched') fetched.push(e.pickupId); });
    for (let i = 0; i < 20; i++) await a.step(60);
    const moved = street.filter(p => { const e = w.entities.get(p.id); return e && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > .05; }).length;
    return { street: street.length, fetched: fetched.length, moved };
  });
  console.log('fetch', JSON.stringify(fetch)); rows.push({ fetch });
  // Everyone found and armed by the production pickup rule: pistol, assault rifle, shotgun, rifle, pistol.
  const armed = await s.page.evaluate(async (swap) => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    a.missions.completeObjective('look'); await a.step(10);
    const p = w.entities.get(1)!.transform, l5 = w.missions!.state.l5!;
    const weapons = swap ? ['weapon.handgun', 'weapon.shotgun', 'weapon.handgun', 'weapon.handgun', 'weapon.assault-rifle'] : ['weapon.assault-rifle', 'weapon.handgun', 'weapon.shotgun', 'weapon.hunting-rifle', 'weapon.handgun'];
    const out: unknown[] = [];
    l5.survivors.forEach((r, i) => {
      const e = w.entities.get(r.id); if (!e || r.status !== 'following') return;
      const at = { x: p.x + 1.3 + (i % 2) * .5, z: p.z + (i - 2) * 1.1 };
      Object.assign(e.transform, at); w.spatial.set(e.id, at.x, at.z);
      w.combat!.pickups.spawn(weapons[i], at, false, { survivorOnly: true });
      const ok = w.combat!.pickups.armSurvivor(e);
      out.push({ key: r.key, model: e.appearance?.asset ?? e.civilian?.model, weapon: e.civilian?.ally?.weapon, ok });
    });
    await a.step(60);
    return out;
  }, !!process.env.SWAP);
  console.log('armed', JSON.stringify(armed)); rows.push({ armed });
  for (const z of [1.5, 0.5]) { await zoomTo(z); await s.page.screenshot({ path: `${out}/${tier}-armed-idle-z${z}.jpg`, type: 'jpeg', quality: 82 }); }
  // Walk the courier 10 m so the armed group follows.
  await s.page.evaluate(async () => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, p = w.entities.get(1)!.transform;
    a.input.set({ moveTarget: { x: p.x + 9, z: p.z }, walk: true }); await a.step(150); a.input.clear(); await a.step(1);
  });
  for (const z of [1.5, 0.5]) { await zoomTo(z); await s.page.screenshot({ path: `${out}/${tier}-armed-walk-z${z}.jpg`, type: 'jpeg', quality: 82 }); }
} finally { writeFileSync(`${out}/rows-${tier}.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
