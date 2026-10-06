import type { Mission } from './Mission';
import type { EntitySnapshot } from '../world/types';

/** Slice script uses E08's rescue/turn lifecycle. Every stage lives in the checkpoint snapshot. */
export class LevelOneOutbreak {
  constructor(private readonly mission: Mission) {}
  prepare(): void {
    const { world, def, state } = this.mission, ai = world.infected, npcs = world.npcs;
    if (!ai || !npcs) return;
    Object.assign(ai.director.camera, { halfWidth: 10, halfDepth: 12, yaw: Math.PI / 4 });
    // Replace the previous instant-turn stand-in with customers present before the incident.
    for (const e of world.entities.iterate()) if (e.archetype === 'npc.delivery-driver') { world.entities.delete(e.id); world.spatial.delete(e.id); }
    state.outbreak = { victims: [], released: false };
    for (const [i, role] of ['cashier', 'suburban-mom', 'bbq-dad'].entries()) {
      const point = { x: def.anchors.diner.x + (i - 1) * 1.8, z: def.anchors.diner.z + 1.5 };
      const cell = ai.nav.nearestCell(point.x, point.z), p = ai.nav.clear(point.x, point.z, .65) ? point : { x: ai.nav.x(cell), z: ai.nav.z(cell) };
      const id = npcs.civilians.spawn(role, p, { waypoints: [p] });
      world.entities.get(id)!.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER;
      state.outbreak.victims.push(id);
    }
  }
  turned(id: number, infectedId: number): void {
    const { state, world } = this.mission, index = state.outbreak?.victims.indexOf(id) ?? -1;
    if (index < 0) return;
    state.actors[`incident-${index + 1}`] = infectedId;
    const e = world.entities.get(infectedId)!;
    e.combat!.damageMultiplier = .2;
    e.infected!.state = state.outbreak!.released ? 'chase' : 'migration';
    // A rising victim keeps its clothes/position; this is not a population spawn.
  }
  update(): void {
    const { state, world } = this.mission, outbreak = state.outbreak;
    if (!outbreak || outbreak.released || state.steps.escape.status !== 'active') return;
    const group = Object.entries(state.actors).filter(([name]) => name.startsWith('incident-')).map(([, id]) => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0);
    for (const id of outbreak.victims) { const c = world.entities.get(id)?.civilian; if (c && ['calm','alarmed','flee','hide'].includes(c.state)) c.state = 'calm'; }
    for (const e of group) {
      e.combat!.attacking = world.npcs!.civilians.holds(e.id);
      if (e.combat!.attacking) { e.infected!.targetId = outbreak.victims.find(id => world.entities.get(id)?.civilian?.attacker === e.id) ?? 0; }
    }
    const victim = outbreak.victims.map(id => world.entities.get(id)).find(e => e?.civilian && ['calm', 'alarmed', 'flee', 'hide', 'grabbed'].includes(e.civilian.state));
    const attacker = group.find(e => !world.npcs!.civilians.holds(e.id)) ?? group[0];
    if (victim && attacker && victim.civilian!.state !== 'grabbed') {
      // Customers freeze in alarm until the first bite; subsequent attackers form the chain.
      victim.civilian!.state = 'calm';
      world.npcs!.move(attacker, victim.transform, 2.3, attacker.infected!, .8);
      if (Math.hypot(attacker.transform.x - victim.transform.x, attacker.transform.z - victim.transform.z) <= 1.1) {
        attacker.transform.yaw = -Math.atan2(victim.transform.z - attacker.transform.z, victim.transform.x - attacker.transform.x);
        world.npcs!.civilians.grab(victim.id, attacker.id, true);
      }
    }
    const done = outbreak.victims.every(id => ['infected', 'finished'].includes(world.entities.get(id)?.civilian?.state ?? 'finished'));
    if (done || !group.length) { outbreak.released = true; for (const e of group) { e.infected!.state = 'chase'; e.combat!.attacking = false; } }
  }
  end(): void {
    const { state, world } = this.mission;
    if (state.outbreak) {
      state.outbreak.released = true;
      for (const id of state.outbreak.victims) { const e = world.entities.get(id); if (e?.civilian && e.civilian.state !== 'infected') { e.civilian.state = 'finished'; e.hidden = true; world.spatial.delete(id); } }
      world.npcs?.civilians.restore();
    }
  }
  /** Prefer the authored entrance/back door, then search clear offscreen cells nearby. */
  spawnPosition(anchor: { x: number; z: number }, store: boolean): { x: number; z: number } {
    const { world } = this.mission, ai = world.infected!, player = world.entities.get(1)!.transform;
    ai.director.camera.x = player.x; ai.director.camera.z = player.z;
    const base = { x: anchor.x, z: store ? this.mission.def.anchors.hardware.z - 15 : anchor.z };
    for (let r = 0; r <= 40; r += .65) for (let i = 0; i < 32; i++) {
      const angle = Math.PI + i * Math.PI / 16, p = { x: base.x + Math.cos(angle) * r, z: base.z + Math.sin(angle) * r };
      if (!ai.nav.clear(p.x, p.z, .65) || ai.active.some(e => e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 1.1)) continue;
      if (store && (p.z > this.mission.def.anchors.hardware.z - 12 || Math.abs(p.x - this.mission.def.anchors.hardware.x) > 8)) continue;
      if (!ai.director.visible({ ...p, y: .1 }) && !ai.director.visible({ ...p, y: 1.9 }) || ai.director.occluded(p)) return p;
    }
    throw new Error('No hidden encounter entrance available');
  }
}
