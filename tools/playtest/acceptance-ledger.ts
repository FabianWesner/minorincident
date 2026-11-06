import type { Game } from '../../src/Game';
import type { observeAttackStarts } from '../qa/threat/attackStarts';

/** Read-only fixed-tick evidence for physical-input routes. No frame timings,
 * path queries, gameplay writes or synthetic combat events. Runs in the page. */
export function installAcceptanceLedger(observeStarts: typeof observeAttackStarts): void {
  type Step = { ticks: number; playerWindups: number; groupWindups: number; playerDamage: number; peakAlive: number };
  type Record = { level: string; steps: { [id: string]: Step }; samples: unknown[]; events: unknown[]; audioCues: unknown[]; corpseLife?: unknown[]; corpseSamples?: unknown[]; l4Calm?: unknown[]; cellarAudio?: { voices: unknown[]; samples: unknown[] } };
  const root = window as unknown as { __SCENE__?: { game: Game }; __acceptanceInputLedger?: Record[] };
  const records: Record[] = root.__acceptanceInputLedger = [];
  let bound: Game['world']['missions'];
  const bind = () => {
    requestAnimationFrame(bind);
    const world = root.__SCENE__?.game.world, mission = world?.missions;
    if (!world || !mission || mission === bound) return;
    bound = mission;
    const record: Record = { level: mission.def.id, steps: {}, samples: [], events: [], audioCues: [] }; records.push(record);
    // G-14: logical dead identities include sleeping streamed records. A
    // checkpoint rewind starts a fresh timeline; a native revival is explicit.
    const corpseLife: { id: number; archetype: string; deadAt: number; firstTick: number; lastTick: number; samples: number; sleepingSamples: number; missingFirstTick?: number; missingSamples: number; returnedAfterMissing?: number; end?: string }[] = [];
    const trackedCorpses = new Map<number, typeof corpseLife[number]>();
    record.corpseLife = corpseLife; record.corpseSamples = [];
    world.events.on('checkpoint.restored', () => {
      for (const row of trackedCorpses.values()) row.end = 'checkpoint rewind';
      trackedCorpses.clear();
    });
    world.events.on('sim.tick', () => {
      if (world.missions !== mission || world.tick % 120) return;
      const entities = new Map([...world.entities.iterate()].map(e => [e.id, e]));
      const sleeping = new Set<number>();
      for (const entity of world.chunks?.inactiveEntities() ?? []) { entities.set(entity.id, entity); sleeping.add(entity.id); }
      for (const entity of entities.values()) if (entity.corpse || entity.infected && entity.health.current <= 0 && entity.infected.recoverAt < 0 && entity.infected.state === 'dead') {
        let row = trackedCorpses.get(entity.id);
        if (!row) { row = { id: entity.id, archetype: entity.archetype, deadAt: entity.infected?.deadAt ?? world.tick, firstTick: world.tick, lastTick: world.tick, samples: 0, sleepingSamples: 0, missingSamples: 0 }; trackedCorpses.set(entity.id, row); corpseLife.push(row); }
      }
      for (const [id, row] of trackedCorpses) {
        const entity = entities.get(id);
        if (entity && entity.health.current > 0) { row.end = 'native revival'; trackedCorpses.delete(id); continue; }
        if (!entity) { row.missingFirstTick ??= world.tick; row.missingSamples++; continue; }
        if (row.missingSamples && !row.returnedAfterMissing) row.returnedAfterMissing = world.tick;
        row.lastTick = world.tick; row.samples++; if (sleeping.has(id)) row.sleepingSamples++;
      }
      record.corpseSamples!.push({ tick: world.tick, tracked: trackedCorpses.size, liveOrSleeping: [...trackedCorpses.keys()].filter(id => entities.has(id)).length });
    }, 8);
    const seenVoices = new Set(root.__SCENE__!.game.audio.log.map(cue => cue.voice));
    const cellarRoster = () => {
      const at = mission.def.anchors['l4-cellar-in'] ?? mission.def.anchors['l5-cellar-in'];
      if (!at) return null;
      return { anchor: { ...at }, entry: { ...(mission.def.anchors['l4-cellar-door'] ?? mission.def.anchors['l5-cellar-door']) }, player: { ...world.entities.get(1)!.transform },
        doorway: structuredClone(world.progression?.campaign?.shelterEntry),
        actors: [...world.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 &&
          (e.id === 1 || e.companion || e.civilian || e.infected || e.escort) && Math.hypot(e.transform.x - at.x, e.transform.z - at.z) <= 7)
          .map(e => ({ id: e.id, archetype: e.archetype, companion: !!e.companion, x: e.transform.x, y: e.transform.y, z: e.transform.z, pendingAdmission: !!e.pendingAdmission })) };
    };
    world.events.on('l4.descended', event => { if (world.missions === mission) record.events.push({ ...event, roster: cellarRoster() }); });
    if (mission.def.id === 'L5') record.events.push({ type: 'cellar-level-loaded', tick: world.tick, roster: cellarRoster() });
    if (mission.def.id === 'L4') {
      const audio = root.__SCENE__!.game.audio, analyser = audio.context.createAnalyser();
      for (const type of ['l4.gun', 'l4.firstTurn', 'pickup.collected'] as const) world.events.on(type, event => {
        if (world.missions === mission && (event.type !== 'pickup.collected' || (event as { actionId?: string }).actionId === 'weapon.army-mg')) record.events.push(structuredClone(event));
      });
      const onAlarm = audio.alarm.onEvent.bind(audio.alarm);
      audio.alarm.onEvent = (event, time) => {
        const handled = onAlarm(event, time);
        if (world.missions === mission && event.type === 'l4.firstTurn') record.events.push({
          type: 'actual-klaxon-start', tick: event.tick, observedWorldTick: world.tick, handled,
          active: audio.alarm.active, scheduled: structuredClone(audio.alarm.log.slice(-4)),
          voices: [...audio.graph.active.values()].filter(voice => voice.cue === 'l4.klaxon').map(voice => ({ id: voice.id, cue: voice.cue, gain: voice.gain.gain.value, loop: voice.source.loop })),
        });
        return handled;
      };
      let observedAdmissions = 0;
      world.events.on('sim.tick', () => {
        if (world.missions !== mission) return;
        const ids = mission.state.l4?.emergedIds ?? [];
        if (ids.length <= observedAdmissions) return;
        record.events.push({ type: 'actual-l4-admissions', tick: world.tick, ids: ids.slice(observedAdmissions).map(id => {
          const entity = world.entities.get(id)!;
          return { id, x: entity.transform.x, z: entity.transform.z, hp: entity.health.current, hidden: !!entity.hidden, pendingAdmission: !!entity.pendingAdmission };
        }) });
        observedAdmissions = ids.length;
      }, 8);
      analyser.fftSize = 1024;
      const pcm = new Float32Array(analyser.fftSize), connected = new Set<number>();
      const evidence = record.cellarAudio = { voices: [] as unknown[], samples: [] as unknown[] };
      const sample = () => {
        if (world.missions !== mission) { analyser.disconnect(); return; }
        requestAnimationFrame(sample);
        if (mission.state.l4?.phase !== 'cellar') return;
        for (const voice of audio.graph.active.values()) if (!connected.has(voice.id) &&
          !voice.position && voice.cutoff <= 750 && /army-mg|explosion\.boom/.test(voice.cue)) {
          connected.add(voice.id); voice.gain.connect(analyser);
          evidence.voices.push({ id: voice.id, cue: voice.cue, tick: world.tick, filter: voice.filter.frequency.value, gain: voice.gain.gain.value });
        }
        analyser.getFloatTimeDomainData(pcm);
        let energy = 0, peak = 0;
        for (const value of pcm) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
        evidence.samples.push({ tick: world.tick, time: audio.context.currentTime, state: audio.context.state, rms: Math.sqrt(energy / pcm.length), peak });
      };
      requestAnimationFrame(sample);
    }
    const breachSites = new Set<string>();
    world.events.on('barricade.broken', event => {
      if (world.missions !== mission || event.type !== 'barricade.broken' || event.groupId !== 'l4-wall') return;
      for (const [side, breach] of Object.entries(mission.state.l4?.breaches ?? {})) {
        if (!breach?.openAt || breachSites.has(side)) continue;
        breachSites.add(side);
        record.events.push({ type: 'physical-l4-breach', side, tick: event.tick, levelSeconds: event.tick / 60,
          afterAlarmSeconds: (event.tick - mission.state.l4!.warAt) / 60,
          alive: world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission).length });
      }
    });
    world.events.on('l4.doorBarred', event => { if (world.missions === mission) record.events.push({ ...event }); });
    world.events.on('l4.battle', event => { if (world.missions === mission) record.events.push({ ...event }); });
    world.events.on('mission.signal', event => {
      if (world.missions === mission && event.type === 'mission.signal' && event.name.startsWith('l7.')) record.events.push({ ...event });
    });
    world.events.on('l7.follower-alarm', event => {
      if (world.missions === mission) record.events.push(structuredClone(event));
    });
    world.events.on('combat.hit', event => {
      if (world.missions === mission && mission.def.id === 'L6' && event.type === 'combat.hit' && world.entities.get(event.targetId)?.archetype === 'infected.riot') {
        record.events.push({ ...event, targetHp: world.entities.get(event.targetId)!.health.current });
      }
    });
    world.events.on('vehicle.durability-hit', event => {
      if (world.missions === mission && mission.def.id === 'L9') record.events.push(structuredClone(event));
    });
    const row = () => {
      const step = mission.def.steps.find(s => mission.state.steps[s.id]?.status === 'active');
      return step && (record.steps[step.id] ??= { ticks: 0, playerWindups: 0, groupWindups: 0, playerDamage: 0, peakAlive: 0 });
    };
    observeStarts(world, (source, target) => {
      if (world.missions !== mission || mission.state.phase !== 'playing') return;
      if ((mission.def.id === 'L4' || mission.def.id === 'L5') && !record.events.some(e => (e as { type?: string }).type === 'cellar-level-start'))
        record.events.push({ type: 'cellar-level-start', tick: world.tick, roster: cellarRoster() });
      const step = row(), entity = world.entities.get(target);
      if (!step) return;
      if (target === 1) step.playerWindups++;
      else if (entity?.civilian?.survivor?.mode === 'follow' || entity?.escort?.state === 'follow') step.groupWindups++;
      if (mission.def.id === 'L10') record.events.push({ type: 'regional-attack-start', tick: world.tick, source, target, player: { ...world.entities.get(1)!.transform } });
      if (mission.def.id === 'L10' && mission.state.states['charge-active']) record.events.push({ type: 'charge-attack-start', tick: world.tick, source, target, charge: mission.state.counters['charge-ticks'] });
    });
    world.events.on('player.damaged', e => {
      if (world.missions !== mission || e.type !== 'player.damaged') return;
      const step = row(); if (step) step.playerDamage += e.amount;
    });
    world.events.on('sim.tick', () => {
      if (world.missions !== mission || mission.state.phase !== 'playing') return;
      const step = row(); if (!step) return;
      step.ticks++;
      const living = world.infected!.active.filter(e => e.health.current > 0 && !e.corpse);
      step.peakAlive = Math.max(step.peakAlive, living.length);
      if (world.tick % 30) return;
      if (mission.def.id === 'L4' && !mission.state.l4?.gunAt) {
        const soldiers = new Set(mission.state.l4?.soldierIds ?? []);
        const people = [...world.entities.iterate()].filter(e => e.civilian && !e.civilian.pet && !e.hidden && !e.infected && e.health.current > 0);
        (record.l4Calm ??= []).push({ tick: world.tick, phase: mission.state.l4?.phase,
          infected: living.filter(e => !e.hidden && !e.pendingAdmission).length,
          vfx: structuredClone(root.__SCENE__!.game.view.getState().vfx),
          civilians: people.filter(e => !soldiers.has(e.id)).map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z,
            state: e.civilian!.state, routine: e.civilian!.routine, activity: e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0]?.activity })),
          soldiers: people.filter(e => soldiers.has(e.id)).map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z,
            engaged: e.civilian!.ally?.engaged, activity: e.civilian!.schedule?.[e.civilian!.scheduleStep ?? 0]?.activity,
            prop: e.appearance?.handProp })) });
      }
      // Actual graph starts, including gain/filter and scheduled context time.
      // Output remains muted by the headless QA profile; this proves cue delivery.
      for (const cue of root.__SCENE__!.game.audio.log.slice(-256)) if (!seenVoices.has(cue.voice)) {
        seenVoices.add(cue.voice); record.audioCues.push({ ...cue });
      }
      const player = world.entities.get(1)!;
      const nav = world.infected!.nav;
      const car = mission.def.id === 'L9' && world.vehicles?.active != null ? world.entities.get(world.vehicles.active) : undefined;
      const followers = [...world.entities.iterate()].filter(e => e.id !== 1 && e.health.current > 0 && !e.infected && !e.hidden && e.civilian?.survivor?.mode === 'follow');
      record.samples.push({ tick: world.tick, step: mission.def.steps.find(s => mission.state.steps[s.id]?.status === 'active')?.id,
        alive: living.length, player: { ...player.transform }, hp: player.health.current, marker: mission.state.marker,
        playerSpeed: Math.hypot(player.survivor?.velocity.x ?? 0, player.survivor?.velocity.z ?? 0),
        finale: mission.def.id !== 'L10' ? undefined : {
          charge: mission.state.counters['charge-ticks'], active: !!mission.state.states['charge-active'],
          mega: world.megaPursuit?.entity() ? { id: world.megaPursuit.state.id, mode: world.megaPursuit.state.mode, ...world.megaPursuit.entity()!.transform,
            arenaDistance: Math.hypot(world.megaPursuit.entity()!.transform.x - mission.def.anchors['cure-console'].x, world.megaPursuit.entity()!.transform.z - mission.def.anchors['cure-console'].z) } : null,
        },
        evacuation: world.tick % 120 || !world.l7Encounters ? undefined : { roster: structuredClone(world.l7Encounters.state.roster), boarded: [...world.l7Departure!.state.boarded],
          phase: world.l7Departure!.state.phase, status: world.l7Departure!.boardingStatus() },
        subwayGates: world.tick % 120 || !mission.state.l6 ? undefined : structuredClone(mission.state.l6.gates),
        patrols: world.tick % 120 ? undefined : mission.def.id === 'L9'
          ? Object.fromEntries(Object.entries(mission.l9?.state.encounters?.ids ?? {}).filter(([key]) => key.startsWith('crossing-patrol-')))
          : mission.def.id === 'L10' ? Object.fromEntries(Object.entries(world.l10Encounters?.state.spawned ?? {}).filter(([key]) => key.startsWith('corridor-patrol-') || key.startsWith('corridor-wanderer-'))) : undefined,
        nearbyInfected: !['L9', 'L10'].includes(mission.def.id) ? undefined : living.filter(e => !e.hidden && !e.infected?.hidden && !e.pendingAdmission && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 40)
          .map(e => ({ id: e.id, archetype: e.archetype, x: e.transform.x, z: e.transform.z, onScreen: world.infected!.director.inFrame(e.transform) })),
        director: !['L9', 'L10'].includes(mission.def.id) ? undefined : { count: world.infected!.director.count, cap: world.infected!.director.cap, reserved: world.infected!.director.reserved, pending: world.infected!.director.pendingTurns },
        transport: car?.vehicle ? { id: car.id, hp: car.health.current, max: car.health.max, speed: car.vehicle.forwardSpeed } : undefined,
        healthBars: world.tick % 120 ? undefined : structuredClone(root.__SCENE__!.game.view.getState().healthBars),
        largeCorpses: world.tick % 120 ? undefined : [...world.entities.iterate()].filter(e => !e.hidden && e.health.current <= 0 && e.archetype === 'infected.alpha').map(e => ({ id: e.id, x: e.transform.x, y: e.transform.y, z: e.transform.z })),
        followers: followers.map(e => ({ id: e.id, speed: e.motion?.speed ?? 0, boarded: e.passengerOf !== undefined, x: e.transform.x, z: e.transform.z,
          distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z), hp: e.health.current,
          route: { goal: e.civilian!.goal, index: e.civilian!.pathIndex, length: e.civilian!.path.length,
            next: e.civilian!.path.slice(e.civilian!.pathIndex, e.civilian!.pathIndex + 3).map(cell => ({ x: nav.x(cell), z: nav.z(cell) })),
            target: e.civilian!.l1?.target ? { ...e.civilian!.l1.target } : null,
            flowCell: nav.cell(e.transform.x, e.transform.z), flowDistance: nav.distance[nav.cell(e.transform.x, e.transform.z)], flowNext: nav.flowNext(nav.cell(e.transform.x, e.transform.z)) },
          calm: !living.some(other => Math.hypot(other.transform.x - e.transform.x, other.transform.z - e.transform.z) <= 8) })) });
    }, 8);
  };
  requestAnimationFrame(bind);
}
