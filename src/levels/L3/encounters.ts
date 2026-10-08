import { SimPhase } from '../../core/EventBus';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { Mission } from '../../sim/missions/Mission';

/** Authored introductions, capped population, blast-only checkpoint wall and perimeter collapse.
 * Progress lives in mission state, so retries restore exactly the encounters at the checkpoint. */
export function installLevelThree(world: SimWorld, mission: Mission): void {
  const ai = world.infected!; ai.director.levelCap = 60;
  const barrier = mission.def.anchors.barrier;
  const barrierId = world.vehicles!.obstacles.spawn('wall', barrier);
  const obstacle = () => world.vehicles!.obstacles.items.find(o => o.entity.id === barrierId);
  const parkedCar = (): void => {
    const car = world.vehicles!.cars.get(mission.state.actors.sedan);
    if (!car) return;
    const p = car.entity.transform, d = car.physics.def, c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
    world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: car.entity.id, blocked: car.entity.vehicle!.driver === null, wall: { ...p, halfX: (c*d.length+s*d.width)/2, halfY: .7, halfZ: (s*d.length+c*d.width)/2 } });
  };
  world.events.on('vehicle.exited', parkedCar);
  world.events.on('vehicle.entered', parkedCar);
  const smash = (position: { x: number; z: number }, radius: number): void => {
    const item = obstacle();
    if (!item || item.broken || Math.hypot(position.x - barrier.x, position.z - barrier.z) > radius) return;
    world.vehicles!.obstacles.break(item, { x: 0, y: 0, z: 0 }, world.tick);
    mission.signal('L3.barrier-destroyed');
  };
  world.events.on('checkpoint.restored', () => {
    for (const item of world.vehicles!.obstacles.items) world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: item.entity.id, blocked: !item.broken, wall: { ...item.entity.transform, halfX: item.halfX, halfY: .5, halfZ: item.halfZ } });
    parkedCar();
  });
  world.events.on('hazard.exploded', e => { if (e.type === 'hazard.exploded') smash(e.position, e.radius); });
  world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.sourceId === mission.state.actors.sedan && world.entities.get(e.targetId)?.faction === 'infected') { mission.count('runovers'); if (e.downed !== undefined) mission.state.stats.knockdowns++; else mission.state.stats.kills++; } });
  world.events.on('vehicle.obstacle-broken', e => { if (e.type === 'vehicle.obstacle-broken' && world.entities.get(e.targetId)?.archetype !== 'obstacle.wall') mission.count('smashed'); });
  const spawn = (key: string, archetype: string, x: number, z: number): void => {
    if (ai.director.count >= ai.director.cap) return;
    const cell = ai.nav.nearestCell(x, z, .5);
    if (cell < 0) return;
    mission.state.actors[key] = ai.spawn(archetype, { x: ai.nav.x(cell), z: ai.nav.z(cell) }, { state: 'idle' });
  };
  const once = (key: string, action: () => void): void => { if (!mission.state.states[key]) { mission.setState(key, true); action(); } };
  const defenses = [
    { id: 'forecourt', anchor: 'forecourt', seconds: 35, waves: 7 },
    { id: 'market-cover', anchor: 'market-loading', seconds: 90, waves: 18 },
    { id: 'park-cover', anchor: 'park-loading', seconds: 90, waves: 18 },
    { id: 'checkpoint-cover', anchor: 'checkpoint-hold', seconds: 120, waves: 24 },
  ];
  world.events.on('mission.spawned', e => { if (e.type === 'mission.spawned' && e.id === 'sedan') {
    const car = world.vehicles!.cars.get(mission.state.actors.sedan)!;
    car.physics.body.setRotation({ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, true);
    car.entity.transform.yaw = Math.PI / 2;
    parkedCar();
  } });
  world.events.on('vehicle.entered', () => once('tutorial-spawned', () => {
    mission.radio('L3.routes');
    const car = world.vehicles!.cars.get(mission.state.actors.sedan)!;
    const p = car.entity.transform;
    // Driver faces north from the forecourt onto Main Street; targets form a small street cluster.
    for (let i = 0; i < 10; i++) spawn(`tutorial-${i}`, 'infected.runner', p.x + (i % 2 ? .35 : -.35), p.z - 7 - Math.floor(i / 2) * .7);
    for (let i = 0; i < 3; i++) world.vehicles!.obstacles.spawn('cone', { x: p.x - (i === 2 ? 1.5 : 0), z: p.z - 7 - i * 3 });
  }));
  world.events.on('objective.started', e => {
    if (e.type !== 'objective.started') return;
    const defense = defenses.find(d => d.id === e.id);
    if (defense) {
      const a = mission.def.anchors[defense.anchor];
      // Authored aid caches are ordinary, finite health pickups, never a bot refill.
      for (let i = 0; i < (e.id === 'checkpoint-cover' ? 4 : 2); i++) world.pickups!.spawn('medkit', { x: a.x+i*.15, z: a.z });
    }
    if (e.id === 'market-bypass') once('market-spawned', () => {
      const a = mission.def.anchors.bypass;
      spawn('riot-intro', 'infected.riot', a.x + 12, a.z + 2);
      spawn('market-runner', 'infected.runner', a.x + 14, a.z + 3);
      mission.signal('L3.riot-introduced');
    });
    if (e.id === 'park-route') once('park-spawned', () => {
      const a = mission.def.anchors.park;
      spawn('sprinter-1', 'infected.sprinter', a.x + 2, a.z - 12);
      spawn('sprinter-2', 'infected.sprinter', a.x - 2, a.z - 8);
      mission.signal('L3.sprinter-introduced');
    });
    if (e.id === 'checkpoint') once('checkpoint-spawned', () => {
      spawn('bloated-intro', 'infected.bloated', barrier.x - 2, barrier.z + 1);
      for (let i = 0; i < 3; i++) spawn(`checkpoint-${i}`, 'infected.runner', barrier.x - 8 + i * 2, barrier.z + 2.5);
      mission.signal('L3.bloated-introduced');
    });
  });
  world.hazards!.spawn('propane', { x: mission.def.anchors.sedan.x - 7, z: mission.def.anchors.sedan.z + 2 });
  world.hazards!.spawn('propane', { x: barrier.x - 1, z: barrier.z - 3 }, { radius: 5 });
  world.events.on('sim.tick', () => {
    for (const defense of defenses) {
      const step = mission.state.steps[defense.id];
      if (step.status !== 'active') continue;
      const key = `${defense.id}-waves`, count = mission.state.counters[key], held = world.tick-step.started;
      if (count < defense.waves && held >= count * defense.seconds/defense.waves*60) {
        const a = mission.def.anchors[defense.anchor];
        // Two directions keep these evacuation defenses active combat throughout.
        for (let i = 0; i < 2; i++) {
          const kind = defense.id === 'forecourt' ? 'runner' : count % 6 === 4 && i === 0 ? (defense.id === 'checkpoint-cover' ? 'bloated' : 'riot') : count % 3 === 1 ? 'sprinter' : 'runner';
          const horizontal = defense.id === 'market-cover' || defense.id === 'checkpoint-cover', sign = i ? 1 : -1;
          const x = a.x+sign*(horizontal ? 6 : 1), z = a.z+sign*(horizontal ? 1 : 6), cell = ai.nav.nearestCell(x, z);
          if (cell >= 0) spawn(`${defense.id}-wave-${count}-${i}`, `infected.${kind}`, ai.nav.x(cell), ai.nav.z(cell));
        }
        mission.count(key);
      }
      const ids = Object.entries(mission.state.actors).filter(([key]) => key.startsWith(`${defense.id}-wave-`)).map(([, id]) => id);
      if (mission.state.counters[key] === defense.waves && ids.length && ids.every(id => (world.entities.get(id)?.health.current ?? 0) <= 0)) mission.setState(`${defense.id}-clear`, true);
    }
    for (const e of ai.active) if (e.archetype === 'infected.bloated' && e.health.current <= 0 && e.infected!.state === 'dead' && e.infected!.until === world.tick) smash(e.transform, 3);
    mission.state.counters['max-infected'] = Math.max(mission.state.counters['max-infected'], ai.director.count);
    if (mission.state.steps.checkpoint.status === 'active') {
      const ids = Object.entries(mission.state.actors).filter(([key]) => key === 'bloated-intro' || key.startsWith('checkpoint-')).map(([, id]) => id);
      if (ids.length && ids.every(id => (world.entities.get(id)?.health.current ?? 0) <= 0)) mission.setState('checkpoint-clear', true);
    }
  }, SimPhase.missions);
  world.events.on('cinematic.started', e => {
    if (e.type !== 'cinematic.started' || e.id !== 'twist') return;
    once('collapsed', () => {
      const camp = mission.def.anchors.camp;
      for (let i = 0; i < 3; i++) spawn(`turned-patient-${i}`, 'infected.runner', camp.x + 3 + i, camp.z + 4);
      mission.signal('L3.patient-turned'); mission.signal('L3.floodlights-failed'); mission.signal('L3.perimeter-collapsed');
    });
  });
}
