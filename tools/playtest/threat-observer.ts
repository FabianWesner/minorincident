import type { Game } from '../../src/Game';

/** Read-only receipts for real-input threat acceptance. Serialized into the page;
 * it never supplies inputs or changes actors, clocks, health or mission state. */
export function installThreatObserver(frameTiming = true): void {
  const root = window as unknown as {
    __SCENE__?: { game: Game };
    __threatPlaytestAudit: { samples: unknown[]; fightFrames: unknown[]; captureEpoch: number };
    __playtestAttacks?: Record<string, number>;
  };
  const samples: unknown[] = [], fightFrames: unknown[] = [];
  root.__threatPlaytestAudit = { samples, fightFrames, captureEpoch: 0 };
  let previousCaptureEpoch = 0;
  let previous = 0, previousTick = -1, previousLevel: string | null = null, lastSample = 0, wasFight = false;
  const visible = (id: string) => {
    const e = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const g = root.__SCENE__?.game, w = g?.world, m = w?.missions, api = window.__SS__;
    if (!g || !w || !m || !api) return;
    const loading = (g as unknown as { loading: boolean }).loading;
    const p = w.entities.get(1), playing = !loading && !g.clock.paused && m.state.phase === 'playing';
    const enemies = w.infected?.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden) ?? [];
    const step = m.def.steps.find(s => m.state.steps[s.id].status === 'active')?.id;
    const combatPhase = w.scenario === 'L8' && !!m.state.states.breached || w.scenario === 'L10' && !!m.state.states['charge-active']
      || w.scenario === 'L5' && step === 'look' || w.scenario === 'L7' && step === 'corridor' || w.scenario === 'L9'; // Include crash/crawl frame timings.
    const fight = playing && !!p && (combatPhase || enemies.some(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 20));
    const captureEpoch = root.__threatPlaytestAudit.captureEpoch;
    if (frameTiming && captureEpoch === previousCaptureEpoch && fight && wasFight && w.scenario === previousLevel && w.tick > previousTick && previous) fightFrames.push({ level: w.scenario, tick: w.tick, step, ms: now - previous });
    previousCaptureEpoch = captureEpoch;
    previous = now; previousTick = w.tick; previousLevel = w.scenario; wasFight = fight;
    if (!playing || !p || now - lastSample < 500) return;
    lastSample = now;
    const figures = api.crowdFigures().filter(f => f.drawn), drawn = new Map(figures.map(f => [f.id, f]));
    const onScreen = enemies.filter(e => {
      const f = drawn.get(e.id); if (!f || !api.input.visible(e.transform)) return false;
      const at = f.joints?.head ?? [e.transform.x, e.transform.y, e.transform.z];
      const screen = api.camera.project(at[0], at[1], at[2]);
      return screen[0] >= -1 && screen[0] <= 1 && screen[1] >= -1 && screen[1] <= 1;
    });
    const runners = onScreen.filter(e => e.archetype === 'infected.runner' && (e.motion?.speed ?? 0) > .5).map(e => {
      const f = drawn.get(e.id)!, a = f.joints?.hip, b = f.joints?.head;
      const lean = a && b ? Math.atan2(Math.hypot(b[0] - a[0], b[2] - a[2]), Math.abs(b[1] - a[1])) * 180 / Math.PI : null;
      return { id: e.id, state: e.infected?.state, variant: e.infected?.variant, model: e.infected?.model, appearance: f.appearance, clip: f.clip, speed: e.motion?.speed, leanDegrees: lean };
    });
    const vehicleId = w.vehicles?.active, vehicle = vehicleId == null ? undefined : w.entities.get(vehicleId);
    // L9's objective bearing can cross the open ground between the dressed
    // lanes. Count actual projected content there, rather than minimap dots.
    let crossingContent;
    if (w.scenario === 'L9') {
      const inView = (at: { x: number; y: number; z: number }) => {
        if (Math.hypot(at.x - p.transform.x, at.z - p.transform.z) > 35 || !api.input.visible(at)) return false;
        const q = api.camera.project(at.x, at.y, at.z);
        return Math.abs(q[0]) < .9 && Math.abs(q[1]) < .8;
      };
      const accents = (g.view.scene.getObjectByName('night-accents') as unknown as { set?: {
        points: { kind: string; x: number; y: number; z: number }[];
        fires: { x: number; z: number }[];
      } } | undefined)?.set;
      const practicals = accents?.points.filter(a => a.kind !== 'stud' && inView(a)).length ?? 0;
      const fires = accents?.fires.filter(a => inView({ ...a, y: .6 })).length ?? 0;
      const landmarks = w.districts?.districts.flatMap(d => d.decay.placements.filter(a => /^(veh\.|bld\.|kit\.)/.test(a.assetId)
        && !d.decay.removed.includes(a.id) && inView({ x: a.position[0] + d.origin[0], y: (a.visualAabb.min[1] + a.visualAabb.max[1]) / 2, z: a.position[2] + d.origin[1] }))).length ?? 0;
      const perf = api.perf();
      crossingContent = { practicals, fires, landmarks, kills: m.state.stats.kills,
        drawCalls: perf.drawCalls, triangles: perf.triangles, simMs: perf.simMs,
        heapMB: perf.heapBytes === null ? null : perf.heapBytes / 1048576, liveCount: perf.infected?.liveCount ?? 0,
        patrols: Object.keys(m.l9?.state.encounters?.ids ?? {}).filter(k => k.startsWith('crossing-patrol-')).length };
    }
    samples.push({ level: w.scenario, tick: w.tick, seconds: m.state.stats.time, step,
      crossingContent,
      player: { ...p.transform }, mega: w.megaPursuit ? structuredClone({ ...w.megaPursuit.state, entity: w.megaPursuit.entity()?.transform }) : null,
      followerAlarm: w.l7Encounters?.state.alarm && { ...w.l7Encounters.state.alarm }, group: w.l7Encounters?.corridorGroup(),
      followerAlarmVisible: visible('survivor-world-cue'), followerAlarmArrowVisible: visible('survivor-cue-arrow'),
      hp: p.health.current, damageTaken: m.state.stats.damage, deaths: m.state.stats.deaths,
      vehicleArmor: vehicle ? { id: vehicle.id, current: vehicle.health.current, max: vehicle.health.max } : null,
      attacks: Object.values(root.__playtestAttacks ?? {}).reduce((sum, n) => sum + n, 0),
      quality: document.querySelector<HTMLSelectElement>('[data-testid="setting-quality"]')?.value, camera: g.view.view.getState(),
      breached: !!m.state.states.breached, chargeActive: !!m.state.states['charge-active'],
      objectiveVisible: visible('objective-text') || visible('objective-tracker'), markerVisible: visible('mission-marker'), minimapObjectiveVisible: visible('minimap-objective'),
      worldMarkerVisible: w.scenario === 'L8' && !m.state.states.breached ? g.view.getState().missionMarker?.visible ?? false : undefined,
      visibleInfected: onScreen.map(e => e.id), runners,
      aliveInfected: enemies.length,
      nearestInfected: [...enemies].sort((a, b) => Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z) - Math.hypot(b.transform.x - p.transform.x, b.transform.z - p.transform.z)).slice(0, 8).map(e => ({
        id: e.id, x: e.transform.x, z: e.transform.z, distance: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z),
        drawn: drawn.has(e.id), projected: api.camera.project(e.transform.x, e.transform.y, e.transform.z),
      })),
      followers: [...w.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow' || e.companion?.state === 'follow' || e.escort?.state === 'follow').map(e => ({
        id: e.id, hp: e.health.current, boarded: e.passengerOf !== undefined, speed: e.motion?.speed,
        x: e.transform.x, z: e.transform.z, state: e.civilian?.state, injured: e.civilian?.survivor?.injured,
        dangerUntil: e.civilian?.dangerUntil, knockedUntil: e.civilian?.knockedUntil,
        allyRunSpeed: e.civilian?.ally?.runSpeed, blocker: w.solids.blockingBody(e.id)?.id,
        distanceToPlayer: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z),
      })),
    });
  };
  requestAnimationFrame(frame);
}

/** Read-only L3/L4 fight telemetry for real keyboard/mouse runs. */
export function installL3L4ThreatObserver(frameTiming = true): void {
  const root = window as unknown as { __SCENE__?: { game: Game }; __threatAudit: { capturePaused: boolean; levels: Record<string, { frames: number[]; samples: unknown[]; attacks: number; damage: number; deaths: number; squadEvents: unknown[] }> } };
  root.__threatAudit = { capturePaused: false, levels: {} };
  let bound: Game['world'] | undefined, previous = 0, previousFight = false;
  const frame = (now: number) => {
    const g = root.__SCENE__?.game, w = g?.world, m = w?.missions, level = w?.scenario;
    const loading = (g as unknown as { loading: boolean } | undefined)?.loading;
    const fight = !!g && !!m && !loading && !g.clock.paused && m.state.phase === 'playing' && !root.__threatAudit.capturePaused &&
      (level === 'L3' && m.state.l3?.phase === 'attack' || level === 'L4' && m.state.l4?.phase === 'war');
    if (w && m && (level === 'L3' || level === 'L4')) {
      const row = root.__threatAudit.levels[level] ??= { frames: [], samples: [], attacks: 0, damage: 0, deaths: 0, squadEvents: [] };
      if (frameTiming && fight && previousFight) row.frames.push(now - previous);
      if (bound !== w) {
        bound = w;
        w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) row.attacks++; });
        w.events.on('player.damaged', e => { if (e.type === 'player.damaged') row.damage += e.amount; });
        w.events.on('player.died', () => { row.deaths++; });
        w.events.on('l3.fallback', e => row.squadEvents.push(e));
        w.events.on('l3.squad-lost', e => row.squadEvents.push(e));
        w.events.on('sim.tick', () => {
          if (w.tick % 30) return;
          const p = w.entities.get(1)!, alive = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission);
          row.samples.push({ tick: w.tick, phase: m.state.l3?.phase ?? m.state.l4?.phase, health: p.health.current,
            alive: alive.length, near: alive.filter(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 15).length,
            plaza: alive.filter(e => e.transform.x > -36 && e.transform.x < 2 && e.transform.z > -22 && e.transform.z < 35.5).length,
            squad: m.state.l3?.squad.map(q => { const a = w.entities.get(q.id)!; return { id: q.id, x: a.transform.x, z: a.transform.z, health: a.health.current, state: a.civilian?.state, speed: a.motion?.speed, following: a.civilian?.ally?.follow?.targetId === 1, incapacitated: (a.civilian?.knockedUntil ?? 0) > w.tick || a.civilian?.state === 'grabbed' || a.civilian?.state === 'bitten' }; }),
            leaderSpeed: p.motion?.speed ?? Math.hypot(p.survivor!.velocity.x, p.survivor!.velocity.z), segment: m.state.l3?.segment,
            armoryOfficers: m.state.l3 && !m.state.l3.handgunAt ? m.state.l3.officerIds.map(id => { const a = w.entities.get(id)!; return { id, x: a.transform.x, z: a.transform.z }; }) : undefined,
            position: { x: p.transform.x, z: p.transform.z } });
        }, 8); // Observe after cleanup and resolved motion publication (phase 7).
      }
    }
    previous = now; previousFight = fight; requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
