import { loadLevel, runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import type { MissionResult } from '../../../src/sim/missions/types';
import type { Tier } from './probe';
import { runL6 } from '../../sim-runner/l6Bots';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { relocatePlayer } from '../../../src/sim/missions/missionHelpers';
import { l7CorridorAnchors } from '../../../src/levels/L7/corridor';
import { fistsOnlyRoute, fistsCompletionPass } from './fix53-fists';

type Add = (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined) => void;

/** Inspect every native retreat tick against the actual, initially fixed gate/platform destinations. */
export async function l6MarkerFixture(tier: Tier, add: Add, observations: Record<string, unknown>): Promise<void> {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const trajectory: { tick: number; phase: string; marker: string | null; x?: number; z?: number }[] = [];
  const offenders: typeof trajectory = [], seenGates = new Set<number>();
  let samples = 0, gateCount = 0, platformSeen = false, nightSeen = false, signature = '', nativeStateHash: string | null = null;
  const run = await runLevel('L6', 'complete', 1, 900, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const mission = world.missions!, gates: { x: number; z: number; gateX: number }[] = [];
      const platform = { ...mission.def.anchors['exit-platform'] }, night = { ...mission.def.anchors['night-exit'] };
      let initialized = false;
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const state = mission.state, phase = state.l6?.phase;
        if (!initialized && state.l6) {
          gates.push(...state.l6.gates.map(gate => ({ x: gate.x + 2.4, z: 17.3, gateX: gate.x })));
          gateCount = gates.length; initialized = true;
        }
        if (!phase) return;
        if (state.phase !== 'playing' || !['retreat', 'exit'].includes(phase)) return;
        const anchor = state.marker ? mission.def.anchors[state.marker] : undefined;
        const row = { tick: world.tick, phase, marker: state.marker, ...(anchor ? { x: anchor.x, z: anchor.z } : {}) };
        const at = (point: { x: number; z: number }) => !!anchor && Math.hypot(anchor.x - point.x, anchor.z - point.z) <= 1e-6;
        samples++;
        const gate = phase === 'retreat' ? gates.find(at) : undefined;
        if (gate) seenGates.add(gate.gateX);
        if (phase === 'retreat' && at(platform)) platformSeen = true;
        if (phase === 'exit' && at(night)) nightSeen = true;
        if (!(phase === 'retreat' ? !!gate || at(platform) : at(night)) && offenders.length < 5) offenders.push(row);
        const next = `${phase}/${state.marker}/${anchor?.x}/${anchor?.z}`;
        if (next !== signature) { trajectory.push(row); signature = next; }
      };
    },
    beforeDispose: world => { nativeStateHash = stateHash(world.getState()); },
  });
  if (run.outcome === 'load-error') throw new Error(`L6 marker fixture setup failed: ${JSON.stringify(run)}`);
  // The ordinary bot need not offer every closable gate. Exercise those guide
  // branches in a separate, explicitly arranged roster; never alter the route
  // above or claim that these placements are ordinary travel evidence.
  const branchChecks: { gateX: number; playerX: number; x: number; z: number; pass: boolean }[] = [];
  const branchWorld = await loadLevel('L6', 1, campaign, 0, { quality: tier });
  try {
    branchWorld.missions!.begin(); branchWorld.update();
    const mission = branchWorld.missions!, state = mission.state.l6!;
    state.phase = 'retreat';
    for (const survivor of state.survivors) {
      survivor.status = 'following';
      const entity = branchWorld.entities.get(survivor.id)!;
      entity.hidden = false; entity.transform.x = 260; entity.transform.z = 15;
    }
    const controller = mission.l6 as unknown as { guide(p: { x: number; z: number }): void };
    for (const gate of state.gates) for (const offset of [-1, 0, 1, 2]) {
      const p = { x: gate.x + offset, z: 15 };
      controller.guide(p);
      const anchor = mission.def.anchors[mission.state.marker!];
      branchChecks.push({ gateX: gate.x, playerX: p.x, x: anchor.x, z: anchor.z,
        pass: Math.hypot(anchor.x - gate.x - 2.4, anchor.z - 17.3) < 1e-6 });
    }
  } finally { branchWorld.dispose(); }
  const branchesPass = branchChecks.length === 12 && branchChecks.every(check => check.pass);
  const value = { run, samples, gateCount, seenGates: [...seenGates], platformSeen, nightSeen, trajectory, offenders, nativeStateHash, branchChecks,
    branchSetup: 'separate native L6 guide; following visible roster beyond all three open gates; four courier positions per gate' };
  observations['L6/fixed-markers'] = value;
  add('L6-10', 'native fixed-gate/platform marker trajectory', value, 'every active retreat/exit tick at an initial gate wait spot or fixed platform/exit; all3 gate branches at four courier positions', offenders.length || !branchesPass ? false : run.completed && samples > 0 && gateCount === 3 && platformSeen && nightSeen ? true : undefined);
}

/** Explicit initial-state edge cases, followed by normal production bot input and objectives. */
export async function edgeFixtures(level: RunnerLevel, tier: Tier, add: Add, observations: Record<string, unknown>): Promise<void> {
  if (level === 'L7') {
    const trace: { tick: number; phase: string; x: number; z: number }[] = [];
    const entered = new Map<number, number>(), boarded: { id: number; tick: number }[] = [];
    const elsewhere: number[] = [];
    let seeded = false;
    let start: { tick: number; x: number; z: number; aliveElsewhere: number } | null = null;
    let end: { tick: number; x: number; z: number; alive: number } | null = null;
    const run = await runLevel('L7', 'complete', 1, 600, 'auto', undefined, undefined, 0, {
      quality: tier,
      beforeBegin: world => {
        const update = world.update.bind(world);
        world.update = () => {
          update();
          const state = world.l7Departure!.state, bus = world.entities.get(state.busId)!.transform;
          if (state.phase === 'boarding' && !seeded) {
            seeded = true;
            // Capability fixture: ten ordinary admitted enemies far from the
            // boarding lane. Do not require clearing the rest of the city.
            const nav = world.infected!.infectedNav;
            for (let i = 0; i < 10; i++) {
              const cell = nav.nearestCell(40 + i * 1.5, -40, .35);
              if (cell >= 0) { const id = world.infected!.spawn('infected.runner', { x: nav.x(cell), z: nav.z(cell) }); if (id) elsewhere.push(id); }
            }
          }
          for (const [id, tick] of Object.entries(state.entering)) if (!entered.has(Number(id))) entered.set(Number(id), tick);
          if (state.phase === 'departing' || state.phase === 'done') {
            start ??= { tick: state.startedAt, x: bus.x, z: bus.z, aliveElsewhere: elsewhere.filter(id => { const e = world.entities.get(id); return !!e && e.health.current > 0 && !e.hidden && !e.pendingAdmission; }).length };
            if (world.tick % 15 === 0 || state.phase === 'done') trace.push({ tick: world.tick, phase: state.phase, x: bus.x, z: bus.z });
            if (state.phase === 'done') end = { tick: world.tick, x: bus.x, z: bus.z, alive: world.infected!.active.filter(e => e.health.current > 0 && !e.hidden).length };
          }
        };
        world.events.on('mission.signal', event => {
          if (event.type === 'mission.signal' && event.name === 'l7.survivor-boarded' && event.actorId !== undefined) boarded.push({ id: event.actorId, tick: event.tick });
        });
      },
    });
    const first = start as { tick: number; x: number; z: number; aliveElsewhere: number } | null, last = end as { tick: number; x: number; z: number; alive: number } | null;
    const seconds = first && last ? (last.tick - first.tick) / 60 : null;
    const metres = first && last ? Math.hypot(last.x - first.x, last.z - first.z) : null;
    const entries = [...entered].map(([id, tick]) => ({ id, tick })).sort((a, b) => a.tick - b.tick);
    const spacing = entries.slice(1).map((entry, i) => entry.tick - entries[i].tick);
    const value = { setup: 'ordinary mortal native L7 input; capability fixture admits ten extra ordinary enemies elsewhere at boarding; read-only bus and passenger observations on every tick', run, first, last, elsewhere, seconds, metres, entries, boarded, spacing, trace };
    observations['L7/departure'] = value;
    add('L7-11', 'actual uninterrupted departure duration and bus displacement', value, '6–10 seconds; bus moves at least30m', run.completed && seconds !== null && metres !== null ? seconds >= 6 && seconds <= 10 && metres >= 30 : undefined);
    add('L7-10', 'actual passenger door-entry spacing', { entries, boarded, spacing }, 'one new passenger at most every15ticks; every entry finishes', run.completed && entries.length ? spacing.every(gap => gap >= 15) && entries.every(entry => boarded.some(b => b.id === entry.id)) : undefined);
    add('L7-10', 'living infected remaining when boarding has finished', first ? { tick: first.tick, alive: first.aliveElsewhere, ids: elsewhere } : null, 'at least10 admitted living infected may remain elsewhere at departure start', first && elsewhere.length === 10 ? first.aliveElsewhere >= 10 && run.completed : undefined);
    // Isolate the actual departure controller's no-progress timer. The follower
    // is deliberately stationary/offscreen; other controller/AI ticks do not run.
    const stalled = await loadLevel('L7', 1, undefined, 0, { quality: tier });
    try {
      stalled.missions!.begin(); stalled.update();
      const departure = stalled.l7Departure!, roster = stalled.l7Encounters!.state.roster, survivor = roster[0];
      for (const entry of roster) {
        entry.status = entry === survivor ? 'following' : 'dead';
        if (entry !== survivor) stalled.entities.get(entry.id)!.health.current = 0;
      }
      const entity = stalled.entities.get(survivor.id)!, nav = stalled.infected!.nav;
      const cell = nav.nearestCell(30, -40, .35);
      entity.hidden = false; entity.health.current = entity.health.max;
      Object.assign(entity.transform, { x: nav.x(cell), z: nav.z(cell) });
      stalled.spatial.set(entity.id, entity.transform.x, entity.transform.z);
      const boarding = l7CorridorAnchors['l7-bus-boarding'].position;
      relocatePlayer(stalled, boarding[0], boarding[2]);
      const events: { name: string; tick: number; actorId?: number }[] = [];
      stalled.events.on('mission.signal', event => {
        if (event.type === 'mission.signal' && event.actorId === entity.id && /l7.survivor-(recovered|assisted|boarded)/.test(event.name)) events.push({ name: event.name, tick: event.tick, actorId: event.actorId });
      });
      const firstSampleTick = stalled.tick + 1;
      for (let i = 0; i <= 20 * 60 + 40; i++) { stalled.tick++; departure.update(); }
      const recovered = events.find(e => e.name === 'l7.survivor-recovered'), aboard = events.find(e => e.name === 'l7.survivor-boarded');
      const recoveryTicks = recovered ? recovered.tick - firstSampleTick : null;
      const value = { setup: 'isolated departure controller; one stationary offscreen living follower; remaining roster starts dead as fixture setup; controller ticks only, no follower movement or combat simulation', firstSampleTick, id: entity.id, events, recoveryTicks, alive: entity.health.current > 0, aboard: departure.state.boarded.includes(entity.id) };
      observations['L7/stalled-boarding'] = value;
      add('L7-10', 'offscreen stalled boarding recovery after20s', value, 'no early recovery; actual recovery at1200ticks without progress; same living actor finishes ordinary36tick door entry', recoveryTicks === 1200 && !!aboard && aboard.tick - recovered!.tick === 36 && value.alive && value.aboard);
    } finally { stalled.dispose(); }

  }
  if (level === 'L5') {
    const campaign = preset('L5-default'); campaign.settings.quality = tier;
    let result: MissionResult | null = null;
    const lost: number[] = [];
    const run = await runLevel('L5', 'complete', 1, 900, 'auto', campaign, (_world, end) => { result = structuredClone(end); }, 0, {
      quality: tier,
      beforeBegin: world => {
        // L5 creates its roster on begin/first update. Wait for those actual entities;
        // the controller accounts for their loss on the next tick, without objective flags.
        const update = world.update.bind(world);
        world.update = () => {
          update();
          const roster = world.missions!.state.l5?.survivors;
          if (!lost.length && roster?.length === 5) for (const entry of roster) { const entity = world.entities.get(entry.id)!; entity.health.current = 0; lost.push(entity.id); }
        };
      },
    });
    const end = result as MissionResult | null;
    const value = { setup: 'all five survivor entities start at0HP; native controller accounts for loss', lost, run, result: end };
    observations['L5/zero-survivors'] = value;
    if (run.outcome === 'load-error' || lost.length !== 5) throw new Error(`zero-survivor fixture setup failed: ${JSON.stringify(run)}`);
    add('L5-13', 'zero-survivor ordinary route and rescued result', value, 'complete with rescued0', run.completed ? end?.rescued === 0 : undefined);
  }
  if (level === 'L6') {
    await l6MarkerFixture(tier, add, observations);
    const campaign = preset('L6-default'); campaign.settings.quality = tier;
    campaign.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] };
    campaign.ownedActions = ['weapon.fists', 'weapon.kick'];
    const attacks = new Set<string>(), offered = new Set<string>();
    const configure = (world: SimWorld) => {
        world.combat!.setLoadout(['weapon.fists'], ['weapon.kick']);
        world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) attacks.add(event.actionId); });
        const update = world.update.bind(world);
        world.update = () => {
          update();
          for (const side of ['LEFT', 'RIGHT'] as const) for (const slot of world.combat!.runner.loadout.state[side].rack) offered.add(slot.id);
        };
    };
    const run = await runLevel('L6', 'complete', 1, 900, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: configure });
    let evade: ReturnType<typeof runL6> | null = null;
    if (!run.completed) {
      const world = await loadLevel('L6', 1, campaign, 0, { quality: tier, beforeBegin: configure });
      try { evade = runL6(world, 'evade-only', 900, 1.5); } finally { world.dispose(); }
    }
    const maneuver = !run.completed && evade?.outcome !== 'complete' ? await fistsOnlyRoute(tier) : null;
    const unarmed = (ids: Iterable<string>) => [...ids].every(id => id === 'weapon.fists' || id === 'weapon.kick');
    const value = { setup: 'unarmed campaign racks; mortal courier; no objective skips; ordinary evade and local-avoidance policies if standing fighting policy stalls', run, evade, maneuver, offered: [...offered], attacks: [...attacks] };
    observations['L6/fists-only'] = value;
    add('L6-13', 'ordinary fists-only route completion', value, 'complete;no weapon beyond fists/kick offered or used', run.completed || evade?.outcome === 'complete' || maneuver?.completed ? unarmed(offered) && unarmed(attacks) && (!maneuver || fistsCompletionPass(maneuver)) : undefined);
  }
  if (level === 'L9') {
    const campaign = preset('L9-default'); campaign.settings.quality = tier;
    const run = await runLevel('L9', 'complete', 1, 900, 'auto', campaign, (world, result) => completeCampaignLevel(campaign, 9, result, world), 0, { quality: tier });
    if (!run.completed) { add('L9-08', 'actual crossing transaction into L10', { run }, 'completed L9 handover followed by native L10 initialization', undefined); return; }
    const world = await loadLevel('L10', 1, campaign, 0, { quality: tier });
    try {
      const player = world.entities.get(1)!;
      const weapons = [...new Set(['LEFT', 'RIGHT'].flatMap(side => world.combat!.runner.loadout.state[side as 'LEFT' | 'RIGHT'].rack.map(slot => slot.id)))];
      const companions = [...world.entities.iterate()].filter(e => e.companion).map(e => ({ id: e.id, hp: e.health.current, maxHp: e.health.max, hidden: !!e.hidden }));
      const value = { setup: 'normal L9 completion → completeCampaignLevel → fresh L10 with same save', run, handover: campaign.crossingHandover, weapons, hp: player.health.current, maxHp: player.health.max, hidden: !!player.hidden, activeVehicle: world.vehicles?.active ?? null, companions };
      observations['L9/crossing-handover'] = value;
      add('L9-08', 'actual crossing transaction into L10', value, 'onfoot;exactlyaxe;full ordinary health;corgi safe', !world.vehicles?.active && !player.hidden && weapons.length === 1 && weapons[0] === 'weapon.fire-axe' && player.health.current === player.health.max && companions.length === 1 && companions[0].hp === companions[0].maxHp);
    } finally { world.dispose(); }
  }
}
