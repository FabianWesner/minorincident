import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';

/** Same identity, new healthy components. Works on compact sleeping records too. Dead bodies remain dead. */
export function curedPerson(source: EntitySnapshot, tick: number): EntitySnapshot {
  const e = structuredClone(source), at = { x: e.transform.x, z: e.transform.z };
  const kind = source.archetype.replace('infected.', '');
  const animal = ['dog', 'cat', 'lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].includes(kind);
  const model = animal ? `amb.${kind === 'cat' ? 'dog' : kind}` : kind === 'nurse' || kind === 'hazmat' ? 'npc.paramedic' : ['armored', 'riot', 'alpha'].includes(kind) ? 'npc.national-guard' : ['npc.civilian-man-a', 'npc.civilian-woman-a', 'npc.civilian-man-b'][e.id % 3];
  e.kind = animal ? 'pet' : 'civilian'; e.archetype = animal ? `animal.${kind}` : 'npc.resident'; e.faction = 'civilian';
  delete e.infected; delete e.infection; delete e.infectionRise; delete e.corpse; delete e.hidden; delete e.attachedTo;
  delete e.locomotion; delete e.motion;
  e.health = { current: 100, max: 100 };
  e.combat = { radius: .35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] };
  e.civilian = { state: 'calm', ambient: false, adult: true, pet: kind === 'dog' || kind === 'cat' ? kind : null, owner: null,
    model, variant: model, routine: animal ? 'pet' : 'resident', waypoints: [at], waypoint: 0, pauseUntil: tick + 120,
    entered: tick, until: 0, downTicks: 0, eyesGlow: false, veins: 0, attacker: 0, threat: at, path: [], goal: -1, pathIndex: 0, gore: false, knockedUntil: 0,
    story: { clip: 'npc-cower', start: tick } };
  return e;
}
export function recoverCuredPeople(w: SimWorld, ids: readonly number[]): void {
  for (const id of ids) {
    const e = w.entities.get(id), c = e?.civilian;
    if (!e || !c || w.tick < c.pauseUntil || !c.story) continue;
    c.story = id % 3 === 0 ? { clip: 'npc-cower', start: w.tick } : null;
    c.pauseUntil = w.tick + 3600;
    if (id % 3 === 1) {
      const p = w.entities.get(1)!.transform, nav = w.infected!.nav;
      const cell = nav.nearestCell(p.x + (id % 5 - 2) * 1.5, p.z + 3, .35);
      if (cell >= 0) { c.waypoints = [{ x: nav.x(cell), z: nav.z(cell) }, { x: e.transform.x, z: e.transform.z }]; c.waypoint = 0; c.pauseUntil = 0; }
    }
  }
}
