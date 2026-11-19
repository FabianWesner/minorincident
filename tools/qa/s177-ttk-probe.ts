import { SimWorld } from '../../src/sim/world/SimWorld';
import { combatArchetypes, ttkBands, type CombatArchetype } from '../../src/data/balance';
const w = new SimWorld(); await w.init(); w.loadScenario('combat-arena', 1);
w.combat!.setLoadout(['weapon.fire-axe'], ['weapon.molotov']); w.combat!.runner.infiniteCharges = true;
const targets = Object.entries(combatArchetypes).map(([name, p]) => {
  const id = w.spawnDummy('infected.dummy', { x: 2, z: 0 }, { hp: p.hp });
  w.entities.get(id)!.combat!.armor = p.armor;
  return { name, id, hp: p.hp, tick: 0 };
});
for (let i = 0; i < 2400 && targets.some(t => !t.tick); i++) {
  w.clearInput();
  if (i % 16 === 0) w.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: 2, z: 0 }, right: { down: true, held: false, up: true } });
  w.update();
  for (const t of targets) if (!t.tick && w.entities.get(t.id)!.health.current <= 0) t.tick = w.tick;
}
for (const t of targets) {
  const band = ttkBands['weapon.molotov'][t.name as CombatArchetype], seconds = t.tick / 60;
  if (!t.tick || seconds < band[0] || seconds > band[1]) throw new Error(`${t.name}: ${seconds}s outside ${band}`);
}
console.log(JSON.stringify(targets, null, 2)); w.dispose();
