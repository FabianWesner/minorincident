import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';

async function arena() { const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 7); world.combat!.damage.god = true; return world; }

test('M1 E07/E11 @E11 @E11-AC03 @E11-AC07 dynamic door/prop blockers update infected navigation in one tick', async () => {
  const w = await arena();
  try {
    const door = w.interactables!.spawn('door', { x: 3, z: 0 });
    const fence = w.hazards!.spawn('fence', { x: 3, z: 0 });
    expect(w.infected!.nav.clear(3, 0)).toBe(false);
    w.interactables!.unblock(door); expect(w.infected!.nav.clear(3, 0)).toBe(false);
    w.hazards!.hit(fence, 1000, 'melee'); expect(w.infected!.nav.clear(3, 0)).toBe(true);
    expect(w.infected!.nav.blocked[w.infected!.nav.cell(3, 0)]).toBe(0);
  } finally { w.dispose(); }
});

test('M1 E07/E11 @E11 @E11-AC05 alarm lures actual infected brains away from the player until expiry', async () => {
  const w = await arena();
  try {
    const id = w.infected!.spawn('infected.runner', { x: 5, z: 0 }, { state: 'chase' });
    const alarm = w.hazards!.spawn('car-alarm', { x: 15, z: 0 }); w.hazards!.hit(alarm, 1, 'bullet');
    for (let i = 0; i < 120; i++) w.update();
    expect(w.entities.get(id)!.transform.x).toBeGreaterThan(8);
    for (let i = 120; i < 601; i++) w.update();
    expect(w.entities.get(id)!.noiseTarget).toBeUndefined();
    const x = w.entities.get(id)!.transform.x;
    for (let i = 0; i < 60; i++) w.update();
    expect(w.entities.get(id)!.transform.x).toBeLessThan(x);
  } finally { w.dispose(); }
});


test('M1 E07/E11 @E07 @E07-AC06 enemy bloated bursts retain full player damage beside reduced environmental blasts', async () => {
  const w = await arena();
  try {
    w.combat!.damage.god = false;
    const id = w.infected!.spawn('infected.bloated', { x: 1, z: 0 }, { state: 'idle' }); w.entities.get(id)!.health.current = 0;
    w.update(); const until = w.entities.get(id)!.infected!.until;
    while (w.tick < until - 1) w.update();
    expect(w.events.events().some(e=>e.type==='combat.hit' && e.targetId===1 && e.sourceId===id)).toBe(false);
    w.update();
    expect(w.events.events().find(e=>e.type==='combat.hit' && e.targetId===1 && e.sourceId===id)).toMatchObject({ amount: 35 });
  } finally { w.dispose(); }
});
