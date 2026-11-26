import { expect } from 'vitest';
import { inRect, l8Route, l8GateClosed, l8ConnectorGates } from '../../src/data/l8Bosses';
import { loadLevel } from '../qa/invariants/world';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { objectiveText } from '../../src/sim/missions/objectiveText';

/** The courier enters each cage alone; the corgi and survivor group wait outside until it clears. */
export async function checkL8Route(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
    const mission = w.missions!, zoo = mission.l8!;
    zoo.state.nextWave = Number.MAX_SAFE_INTEGER; w.combat!.damage.god = true;
    zoo.advance();
    const player = w.entities.get(1)!;
    // The opening hold is anchored at arrival and runs for a fixed 30 s even if the courier leaves.
    zoo.followers().forEach((e, n) => w.solids.relocate(e, { x: (n % 6 - 2.5) * 1.5, z: 2 + Math.floor(n / 6) * 1.5, y: e.transform.y }, 'fixture.l8-route', 20, false));
    w.solids.relocate(player, { x: 0, z: 40, y: player.transform.y }, 'fixture.l8-route', 20, false);
    for (let i = 0; i < 20 * 60; i++) { player.health.current = player.health.max; w.update(); }
    expect(zoo.protecting(), 'the hold is still active before 30 s').toBe(true);
    expect(['Stay with the group', 'Protect the group!']).toContain(objectiveText(mission, ''));
    // The hold ends on schedule away from the arrival gate.
    w.solids.relocate(player, { x: 0, z: 9, y: player.transform.y }, 'fixture.l8-route', 20, false);
    for (let i = 0; i < 2400 && zoo.protecting(); i++) w.update();
    expect(zoo.protecting()).toBe(false);
    // Unsealed: the doors are still open, the fight cannot start from the plaza.
    expect(zoo.state.sealedAt).toBe(0);
    l8ConnectorGates.forEach((_, i) => expect(l8GateClosed(`connector.${i}`, { arenas: zoo.state.arenas, sealed: false })).toBe(false));
    Object.assign(player.transform, { x: 0, z: 0 });
    zoo.followers().forEach((e, n) => w.solids.relocate(e, { x: (n % 6 - 2.5) * 1.5, z: 2 + Math.floor(n / 6) * 1.5, y: e.transform.y }, 'fixture.l8-route', 20, false));
    for (let i = 0; i < 400 && !zoo.state.sealedAt; i++) w.update();
    expect(zoo.state.sealedAt, 'the plaza doors shut once the group is inside').toBeGreaterThan(0);
    // This gate fixture starts after the entry-gate sanctuary objective.
    mission.state.steps.sanctuary.status = 'completed'; mission.state.steps.escape.status = 'active';
    const closedKeys = (): string[] => l8Route.flatMap(s => [`${s.id}.entry`, `${s.id}.exit`]).filter(k => !k.startsWith('elephant') && l8GateClosed(k, { arenas: zoo.state.arenas, sealed: true }));
    expect(closedKeys()).toContain('lion.entry');
    l8ConnectorGates.forEach((_, i) => expect(l8GateClosed(`connector.${i}`, { arenas: zoo.state.arenas, sealed: true })).toBe(true));
    const gateProof = [{ id: 'zebra' as const, phase: 3 }, { id: 'gorilla' as const, phase: 1, armed: true }];
    expect(l8GateClosed('zebra.exit', { arenas: gateProof, sealed: true, followers: [{ x: 60, z: 32 }] }), 'the cleared zebra exit stays open while a living follower is still inside that enclosure').toBe(false);
    expect(l8GateClosed('zebra.exit', { arenas: gateProof, sealed: true, followers: [{ x: 60, z: -32 }] }), 'the cleared exit closes once the group has moved on').toBe(true);
    for (const [index, stage] of l8Route.entries()) {
      if (!stage.entry) break;
      const arena = zoo.state.arenas[index], before = zoo.state.arenas.slice(0, index);
      for (const a of before) a.phase = 3;
      if (index > 0) {
        const previous = l8Route[index - 1]!;
        expect(l8GateClosed(`${previous.id}.entry`, { arenas: zoo.state.arenas, sealed: true }), `${previous.id}: return entry remains open before the next gate arms`).toBe(false);
        expect(l8GateClosed(`${previous.id}.exit`, { arenas: zoo.state.arenas, sealed: true }), `${previous.id}: forward exit remains open before the next gate arms`).toBe(false);
      }
      // The opening tunnel cohort would make the group flee; this probe is about the gates, so the opening wave is gone.
      for (const e of w.infected!.active) if (!e.infected!.arenaBoss && !e.infected!.arenaCarrier) e.health.current = 0;
      zoo.bosses.updateGates();
      // The group waits 8 m outside the entry gate, the courier steps in: the gate must not shut on them.
      const gate = stage.entry, inward = { x: (stage.zone.x0 + stage.zone.x1) / 2 - gate.x, z: (stage.zone.z0 + stage.zone.z1) / 2 - gate.z };
      const len = Math.hypot(inward.x, inward.z) || 1, ux = gate.halfX > gate.halfZ ? 0 : Math.sign(inward.x), uz = gate.halfX > gate.halfZ ? Math.sign(inward.z) : 0;
      void len;
      const at = (d: number) => ({ x: gate.x + ux * d, z: gate.z + uz * d });
      const members = zoo.followers();
      members.forEach((e, n) => {
        // Queue on the actual narrow approach, not a fan spread onto lawn.
        const side = (n % 3 - 1) * 1.1, row = Math.floor(n / 3) * 1.2;
        const p = stage.id === 'monkey' ? { x: -24 + side, z: 16 - row } : at(-4 - row);
        w.solids.relocate(e, { x: p.x + (stage.id !== 'monkey' && uz ? side : 0), z: p.z + (stage.id !== 'monkey' && ux ? side : 0), y: e.transform.y }, 'fixture.l8-route', 1, false);
      });
      if (stage.id === 'zebra') {
        // A zebra can turn while the courier is still outside its paddock.
        // That must leave the encounter dormant and the herd away from both
        // fences until she steps through the gate.
        const outside = at(-5);
        expect(w.solids.relocate(player, { ...outside, y: player.transform.y }, 'fixture.l8-route', 20, false)).toBe(true);
        const firstZebra = w.entities.get(arena.ids[0])!;
        // The paddock attackers may already have turned this animal while
        // the preceding enclosures were being checked.
        if (firstZebra.civilian && !firstZebra.infection) w.npcs!.civilians.outbreak!.infect(firstZebra, player.id);
        for (let tick = 0; tick < 600; tick++) w.update();
        const herd = arena.ids.map(id => w.entities.get(id)!).filter(e => e.infected?.arenaBoss?.arena === 'zebra' && e.health.current > 0);
        expect(arena.phase, 'zebra encounter stays dormant while the courier is beyond the entry fence').toBe(0);
        expect(herd.length, 'a zebra has turned before the courier enters').toBeGreaterThan(0);
        expect(herd.every(e => e.transform.z > 20 && e.transform.z < 44), `turned zebras stay inside the compact arena: ${herd.map(e => `${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}`).join(' ')}`).toBe(true);
        const gaps = herd.flatMap((e, i) => herd.slice(i + 1).map(other => Math.hypot(e.transform.x - other.transform.x, e.transform.z - other.transform.z)));
        expect(gaps.every(gap => gap >= .75), `turned zebras do not overlap one another: gaps=${gaps.map(gap => gap.toFixed(1)).join(',')}`).toBe(true);
      }
      const p0 = at((stage.depth ?? 5) + 1); w.solids.relocate(player, { ...p0, y: player.transform.y }, 'fixture.l8-route', 20, false);
      expect(inRect(player.transform, stage.zone), `${stage.id}: courier inside the enclosure`).toBe(true);
      if (stage.id === 'lion' || stage.id === 'monkey') {
        const corgi = [...w.entities.iterate()].find(e => e.companion)!;
        const inside = at(3);
        expect(w.solids.relocate(corgi, { ...inside, y: corgi.transform.y }, 'fixture.l8-corgi-inside', 1, false)).toBe(true);
        arena.phase = 1; arena.armed = false;
        zoo.bosses.update();
        expect(arena.armed, 'entry stays open while the corgi is inside').toBe(false);
        for (let tick = 0; tick < 600 && inRect(corgi.transform, stage.zone); tick++) w.update();
        expect(inRect(corgi.transform, stage.zone), 'corgi walks out before the entry closes').toBe(false);
        arena.phase = 0; arena.armed = false;
      }
      let armedWith = -1;
      let stragglers = '';
      const entryNavId = 900840 + index * 2, previous = l8Route[index - 1], previousEntryNavId = index > 0 ? 900840 + (index - 1) * 2 : -1;
      const closeTicks = new Map<number, number>();
      w.events.on('world.blocker.changed', event => { if (event.type === 'world.blocker.changed' && event.blocked) closeTicks.set(event.id, event.tick); });
      for (let i = 0; i < 3600 && !arena.armed; i++) {
        w.update();
        if (arena.armed) {
          const inside = zoo.followers().filter(e => inRect(e.transform, stage.zone)); armedWith = inside.length;
          stragglers = inside.map(e => `${e.id} ${e.archetype} ${e.civilian?.state} ${e.civilian?.survivor?.mode} slot${e.civilian?.survivor?.slot} path=${e.civilian?.path?.length}@${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} after ${i} ticks`).join('; ');
        }
      }
      expect(arena.phase, `${stage.id} engaged`).toBeGreaterThan(0);
      expect(markerAnchor(mission), `${stage.id}: combat marker stays at the arena centre`).toMatchObject({ x: (stage.zone.x0 + stage.zone.x1) / 2, z: (stage.zone.z0 + stage.zone.z1) / 2 });
      expect(arena.armed, `${stage.id}: the entry gate closes behind the courier`).toBe(true);
      const armedAt = w.tick;
      expect(closeTicks.has(entryNavId), `${stage.id}: the entry barrier must still be physically open on the arming tick`).toBe(false);
      if (index > 0) expect(closeTicks.has(previousEntryNavId), `${previous!.id}: its return barrier stays open until the party has passed`).toBe(false);
      w.update();
      expect(closeTicks.get(entryNavId), `${stage.id}: entry barrier closes on the next native tick`).toBe(armedAt + 1);
      if (index > 0) expect(closeTicks.get(previousEntryNavId), `${previous!.id}: both doors close on the next native tick`).toBe(armedAt + 1);
      expect(armedWith, `${stage.id}: no follower enters the active cage (${stragglers})`).toBe(0);
      const corgi = [...w.entities.iterate()].find(e => e.companion)!;
      expect(corgi.companion!.arenaWait, `${stage.id}: corgi waits outside with the survivors`).toBe(true);
      expect(inRect(corgi.transform, stage.zone), `${stage.id}: corgi stays outside the active cage`).toBe(false);
      const detail = [...zoo.state.guards, zoo.state.haleId, zoo.state.reyesId];
      const guards = detail.map(id => w.entities.get(id)).filter(e => e && e.health.current > 0 && !e.infected);
      const shots: number[] = [];
      const stop = w.events.on('ally.attack', event => { if (event.type === 'ally.attack' && detail.includes(event.sourceId) && arena.ids.includes(event.targetId)) shots.push(event.sourceId); });
      for (let tick = 0; tick < 60; tick++) {
        w.update();
        expect(guards.some(e => e && inRect(e.transform, stage.zone)), `${stage.id}: guards remain outside`).toBe(false);
        expect(corgi.companion!.arenaWait, `${stage.id}: corgi retains its wait order`).toBe(true);
        expect(inRect(corgi.transform, stage.zone), `${stage.id}: corgi remains outside`).toBe(false);
      }
      stop();
      expect(shots, `${stage.id}: guards do not attack cage animals`).toEqual([]);
      expect(l8GateClosed(`${stage.id}.entry`, { arenas: zoo.state.arenas, sealed: true })).toBe(true);
      expect(l8GateClosed(`${stage.id}.exit`, { arenas: zoo.state.arenas, sealed: true })).toBe(true);
      if (stage.id === 'monkey') {
        const leader = w.entities.get(arena.ids.at(-1)!)!;
        if (!leader.infected) { w.npcs!.civilians.outbreak!.turnNow(leader); zoo.bosses.turned(leader.id); }
        const health = leader.health.current, phase = arena.phase;
        arena.phase = 2; leader.health.current = 0; zoo.bosses.update();
        expect(arena.phase, 'the leader alone cannot clear a living pack').toBe(2);
        expect(l8GateClosed('monkey.exit', { arenas: zoo.state.arenas, sealed: true })).toBe(true);
        leader.health.current = health; arena.phase = phase;
      }
      if (index > 0) {
        const previous = l8Route[index - 1]!;
        expect(l8GateClosed(`${previous.id}.entry`, { arenas: zoo.state.arenas, sealed: true }), `${previous.id}: return entry closes after ${stage.id} arms`).toBe(true);
        expect(l8GateClosed(`${previous.id}.exit`, { arenas: zoo.state.arenas, sealed: true }), `${previous.id}: forward exit closes after ${stage.id} arms`).toBe(true);
      }
      arena.phase = 3; arena.armed = false; zoo.bosses.updateGates();
      expect(l8GateClosed(`${stage.id}.exit`, { arenas: zoo.state.arenas, sealed: true }), `${stage.id}: the exit opens on the clear`).toBe(false);
      w.update();
      expect(corgi.companion!.arenaWait, `${stage.id}: corgi rejoins after the cage clears`).toBeUndefined();
      const next = l8Route[index + 1];
      if (next) {
        expect(mission.state.marker, `${stage.id}: marker advances after clear`).toBe('l8-route');
        expect(markerAnchor(mission), `${stage.id}: marker points to ${next.id}`).toMatchObject(next.nodes.at(-1)!);
      }
    }
    // The elephant yard has a south entry fence instead of an l8Route `entry`
    // box. Once the entire party has crossed it, both it and the gorilla return
    // doors must close on the next native tick.
    const elephant = zoo.state.arenas.find(a => a.id === 'elephant')!;
    for (const arena of zoo.state.arenas) { arena.phase = arena.id === 'elephant' ? 1 : 3; arena.armed = false; }
    const followers = zoo.followers();
    followers.forEach((e, n) => w.solids.relocate(e, { x: 84 + n % 8 * 3, z: 54 + Math.floor(n / 8) * 3, y: e.transform.y }, 'fixture.l8-elephant-gate', 2, false));
    w.solids.relocate(player, { x: 96, z: 52, y: player.transform.y }, 'fixture.l8-elephant-gate', 2, false);
    const elephantAnimal = w.entities.get(elephant.ids[0])!;
    expect(elephantAnimal.infected, 'elephant has turned at the breach').toBeDefined();
    zoo.bosses.updateGates();
    expect(w.solids.relocate(player, { x: 96, z: 52, y: player.transform.y }, 'fixture.l8-elephant-gate-open', 2, false)).toBe(true);
    const closedAt = new Map<number, number>();
    w.events.on('world.blocker.changed', event => { if (event.type === 'world.blocker.changed' && event.blocked && [900834, 900848, 900849].includes(event.id)) closedAt.set(event.id, event.tick); });
    // The survivor column moves out through the entry before the elephant yard locks.
    for (let tick = 0; tick < 600 && !elephant.armed; tick++) w.update();
    expect(elephant.armed, 'elephant gate arms after the courier enters the yard').toBe(true);
    const elephantZone = l8Route.find(stage => stage.id === 'elephant')!.zone;
    expect(zoo.state.guards.map(id => w.entities.get(id)).some(e => e && e.health.current > 0 && !e.infected && inRect(e.transform, elephantZone)), 'guards wait outside the elephant yard').toBe(false);
    const corgi = [...w.entities.iterate()].find(e => e.companion)!;
    expect(corgi.companion!.arenaWait, 'elephant: corgi waits outside with the survivors').toBe(true);
    expect(inRect(corgi.transform, elephantZone), 'elephant: corgi stays outside the active yard').toBe(false);
    const dogPosition = { ...corgi.transform };
    w.events.emit({ type: 'cinematic.completed', tick: w.tick, id: 'l8-hale' });
    expect(corgi.transform, 'Hale cinematic completion leaves the waiting corgi outside').toEqual(dogPosition);
    const armedAt = w.tick;
    expect(closedAt.size).toBe(0);
    w.update();
    expect(closedAt.get(900834), 'elephant south gate closes one tick after arming').toBe(armedAt + 1);
    expect(closedAt.get(900848), 'gorilla return entry closes one tick after elephant entry').toBe(armedAt + 1);
    expect(closedAt.get(900849), 'gorilla forward exit closes one tick after elephant entry').toBe(armedAt + 1);
    for (let tick = 0; tick < 60; tick++) {
      w.update();
      expect(corgi.companion!.arenaWait, 'elephant: corgi retains its wait order').toBe(true);
      expect(inRect(corgi.transform, elephantZone), 'elephant: corgi remains outside').toBe(false);
    }
    elephant.phase = 3; elephant.armed = false;
    w.update();
    expect(mission.state.marker, 'elephant clear points to the vehicle').toBe('exit');
    expect(markerAnchor(mission), 'final marker uses the vehicle exit anchor').toMatchObject(mission.def.anchors.exit);
  } finally { w.dispose(); }
}
