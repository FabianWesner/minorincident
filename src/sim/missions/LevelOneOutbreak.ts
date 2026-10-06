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
      const civilian = world.entities.get(id)!.civilian!;
      civilian.pauseUntil = Number.MAX_SAFE_INTEGER; civilian.outbreak = true;
      state.outbreak.victims.push(id);
    }
  }
  grabbed(sourceId: number, targetId: number): void {
    const { state, world } = this.mission, outbreak = state.outbreak, victim = world.entities.get(targetId);
    if (!outbreak || state.steps.escape.status !== 'active' || !victim?.civilian?.adult || victim.civilian.pet) return;
    if (!Object.entries(state.actors).some(([name, id]) => name.startsWith('incident-') && id === sourceId)) return;
    victim.civilian.outbreak = true;
    if (!outbreak.victims.includes(targetId)) outbreak.victims.push(targetId);
  }
  turned(id: number, infectedId: number): void {
    const { state, world } = this.mission, index = state.outbreak?.victims.indexOf(id) ?? -1;
    if (index < 0) return;
    state.actors[`incident-${index + 1}`] = infectedId;
    const e = world.entities.get(infectedId)!;
    e.combat!.damageMultiplier = .2;
    e.infected!.state = 'chase';
    // A rising victim keeps its clothes/position; this is not a population spawn.
  }
  update(): void {
    const { state, world } = this.mission, outbreak = state.outbreak;
    if (!outbreak || state.steps.escape.status !== 'active') return;
    const group = Object.entries(state.actors).filter(([name]) => name.startsWith('incident-')).map(([, id]) => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0);
    const civilians = world.npcs!.civilians, player = world.entities.get(1)!;
    for (const e of group) {
      if (e.infectionRise) continue;
      const brain = e.infected!;
      if (civilians.holds(e.id)) {
        e.combat!.attacking = true; brain.state = 'attack'; brain.until = world.tick;
        brain.targetId = [...world.entities.iterate()].find(v => v.civilian?.state === 'grabbed' && v.civilian.attacker === e.id)?.id ?? 0;
        continue;
      }
      if (world.entities.get(brain.targetId)?.civilian) { brain.targetId = 0; brain.state = 'migration'; e.combat!.attacking = false; }
      if (e.combat!.staggerUntil > world.tick || brain.state === 'stagger') continue;
      const firstEntrant = e.id === state.actors['incident-0'] && !outbreak.victims.some(id => world.entities.get(id)?.civilian?.attacker);
      const playerDistance = Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z);
      let nearest = firstEntrant ? Infinity : playerDistance;
      let victim: EntitySnapshot | undefined;
      if (!e.combat!.reaction) for (const human of world.entities.iterate()) {
        const c = human.civilian;
        if (!c?.adult || c.pet || human.hidden || !['calm','alarmed','flee','hide'].includes(c.state)) continue;
        const distance = Math.hypot(human.transform.x - e.transform.x, human.transform.z - e.transform.z);
        if (distance < nearest) { nearest = distance; victim = human; }
      }
      if (victim) {
        // Each attacker makes its own decision. Panic is never reset to calm.
        brain.state = 'migration'; brain.targetId = victim.id; e.combat!.attacking = false;
        world.npcs!.move(e, victim.transform, firstEntrant ? 3.7 : 5.5, brain, .8);
        world.spatial.set(e.id, e.transform.x, e.transform.z);
        if (Math.hypot(e.transform.x - victim.transform.x, e.transform.z - victim.transform.z) <= 1.1) {
          e.transform.yaw = -Math.atan2(victim.transform.z - e.transform.z, victim.transform.x - e.transform.x);
          // The grabbed event also tracks systemic bites in the same checkpoint ownership.
          civilians.grab(victim.id, e.id, true);
        }
      } else {
        // Generic E07 handles attacks/telegraphs immediately, without a group start.
        if (brain.state === 'migration') brain.state = 'chase';
        brain.targetId = 0;
      }
    }
    // Completion records staging only; it never gates the individual brains.
    if (outbreak.victims.every(id => ['infected', 'finished'].includes(world.entities.get(id)?.civilian?.state ?? 'finished')) || !group.length) outbreak.released = true;
  }

  end(): void {
    const { state, world } = this.mission;
    if (state.outbreak) {
      state.outbreak.released = true;
      for (const id of state.outbreak.victims) { const e = world.entities.get(id); if (e?.civilian && e.civilian.state !== 'infected') {
        const newborn = world.entities.get(e.civilian.risingInfectedId ?? 0); if (newborn) world.infected!.release(newborn); delete e.civilian.risingInfectedId; e.civilian.state = 'finished'; e.hidden = true; world.spatial.delete(id); } }
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
      if (ai.director.offscreen(p) || store && ai.director.occluded(p)) return p;
    }
    throw new Error('No hidden encounter entrance available');
  }
}
