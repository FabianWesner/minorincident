/** Controlled native level combat on both checkouts; retains their action, shield and damage rules. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve('test-results/release-ab-1101/weapons'); mkdirSync(out, { recursive: true });
const root = process.cwd(), rows = [];
for (const [side, directory] of [['prod', '/tmp/release-ab-prod'], ['candidate', root]]) {
  process.chdir(directory);
  const { loadLevel } = await import(pathToFileURL(resolve(directory, 'tools/sim-runner/levels.ts')).href);
  const cases = ['weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.pistol', 'weapon.smg', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.army-mg', 'weapon.rocket-launcher'].map(weapon => ({ weapon, archetype: 'infected.runner', orientation: 'front' }));
  cases.push(...['front', 'flank'].map(orientation => ({ weapon: 'weapon.army-mg', archetype: 'infected.riot', orientation })));
  for (const fixture of cases) {
    const w = await loadLevel('L4', 1);
    try {
      w.missions.update = () => {}; w.storyLock = null;
      const ai = w.infected, p = w.entities.get(1);
      ai.director.setTier('low'); ai.director.update = () => {};
      for (const e of [...ai.active]) ai.release(e);
      for (const e of w.entities.iterate()) if (e.civilian || e.companion) e.hidden = true;
      const nav = ai.nav; let best = Infinity, point;
      for (let i = 0; i < nav.blocked.length; i++) {
        const at = { x: nav.x(i), z: nav.z(i) }, d = Math.hypot(at.x - p.transform.x, at.z - p.transform.z);
        if (d < best && [0, 2, 4, 6, 8].every(dx => nav.clear(at.x + dx, at.z, .65)) && nav.visible(at, { x: at.x + 8, z: at.z }, .5)) { best = d; point = at; }
      }
      if (!point) throw new Error('No native L4 clear combat lane');
      Object.assign(p.transform, point, { y: .7 + (w.districts.pavingHeight(point.x, point.z) ?? 0) });
      w.physics.playerBody.setTranslation(p.transform, true); w.physics.playerBody.setNextKinematicTranslation(p.transform);
      const melee = ['weapon.fists', 'weapon.bat', 'weapon.fire-axe'].includes(fixture.weapon), distance = melee ? 1 : 7;
      const id = ai.spawn(fixture.archetype, { x: point.x + distance, z: point.z }, { yaw: fixture.orientation === 'front' ? Math.PI : Math.PI / 2 });
      const enemy = w.entities.get(id), initialHp = enemy.health.current;
      ai.update = () => {}; w.combat.damage.god = true; w.combat.setLoadout([fixture.weapon], ['weapon.kick']);
      const start = w.tick;
      while (w.tick - start < 1800 && enemy.health.current > 0) {
        const dx = enemy.transform.x - p.transform.x, dz = enemy.transform.z - p.transform.z, d = Math.hypot(dx, dz) || 1;
        w.setInput({ move: melee && d > 1.1 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 }, aimSource: 'keyboard', aim: { x: dx / d, z: dz / d }, aimPoint: { x: enemy.transform.x, z: enemy.transform.z }, left: { down: false, held: true, up: false } });
        w.update();
      }
      const events = w.events.events(start).filter(e => (e.sourceId === 1 || e.targetId === id) && !['sim.tick', 'input.applied'].includes(e.type));
      const row = { side, ...fixture, scenario: w.scenario, quality: ai.director.tier, initialHp, endHp: enemy.health.current, seconds: (w.tick - start) / 60, gearTier: p.survivor.gearTier, attacks: events.filter(e => e.type === 'combat.attack').length, hits: events.filter(e => e.type === 'combat.hit' && e.amount > 0).length, killEvents: events.filter(e => e.type === 'combat.kill').length, permanent: enemy.health.current <= 0 && enemy.infected.recoverAt < 0, events };
      rows.push(row); writeFileSync(resolve(out, 'native-ab.json'), JSON.stringify(rows, null, 2));
      console.log(JSON.stringify({ side, ...fixture, endHp: row.endHp, seconds: row.seconds, attacks: row.attacks, hits: row.hits, killEvents: row.killEvents, permanent: row.permanent }));
    } finally { w.dispose(); }
  }
}
process.chdir(root);
