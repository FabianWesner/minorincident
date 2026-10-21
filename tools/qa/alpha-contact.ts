/** Audit the ordinary Alpha/soldier contact fixture without changing its tuning. */
import { writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { allyState } from '../../src/sim/outbreak/Allies';
const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena');
try {
  const id = w.infected!.spawn('infected.alpha', { x: 6, z: 0 }, { state: 'idle' }), e = w.entities.get(id)!;
  w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 1, actionId: 'weapon.kick', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 20, multiplier: 1, type: 'melee', knockback: 0, knockdown: true, stagger: .5 });
  const soldier = w.entities.get(w.npcs!.civilians.spawn('officer', { x: Number(process.argv[3] ?? 6.8), z: 0 }))!;
  soldier.civilian!.ally = allyState('soldier'); e.infected!.specialCooldowns = { 'alpha.charge': 10000, 'alpha.ground-slam': 10000 };
  e.combat!.staggerUntil = 0; e.infected!.heardTargetId = soldier.id; e.infected!.state = 'chase';
  const samples = [];
  for (let i = 0; i < 100; i++) {
    samples.push({ tick: w.tick, alpha: { ...e.transform }, soldier: { ...soldier.transform }, health: { ...soldier.health }, brain: structuredClone(e.infected), civilian: structuredClone(soldier.civilian) }); w.update();
  }
  writeFileSync(process.argv[2], JSON.stringify({ samples, events: w.events.events() }, null, 2));
  console.log(JSON.stringify({ first: samples[0], lastHp: soldier.health.current, attacks: w.events.events().filter(e => e.type === 'infected.attack') }));
} finally { w.dispose(); }
