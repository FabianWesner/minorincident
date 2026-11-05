import type { Game } from '../../src/Game';
import type { HealthBars } from '../../src/render/HealthBars';

/** Read-only telemetry installed before menu entry; inputs remain owned by the real-input driver. */
export function installL6HoldObserver(): void {
  const root = window as unknown as { __SCENE__?: { game: Game }; __l6HoldAudit: Record<string, unknown> };
  const samples: unknown[] = [], attempts: unknown[] = [], frames: number[] = [], frameTicks: number[] = [];
  const near = new Set<number>(), contact = new Set<number>(), arrivals = new Set<number>(), shelter = new Set<number>();
  const attackers = new Set<number>(), playerAttackers = new Set<number>();
  const barViolations: { tick: number; missingHero: boolean; overlap: number[] }[] = [];
  let barFrames = 0;
  let playerStrikes = 0, playerHits = 0, playerDamage = 0;
  root.__l6HoldAudit = { samples, attempts, frames, frameTicks, barFrames, barViolations };
  let bound: Game['world'] | undefined, previous = 0, previousHold = false, loadedAt = 0, playable = false;
  const frame = (now: number) => {
    const g = root.__SCENE__?.game, w = g?.world, m = w?.missions, s = m?.state.l6;
    const loading = (g as unknown as { loading: boolean } | undefined)?.loading;
    const hold = !!s && (s.phase === 'first' || s.phase === 'fails') && !loading && !g!.clock.paused && !root.__l6HoldAudit.capturePaused;
    if (hold && previousHold) { frames.push(now - previous); frameTicks.push(w!.tick); }
    previous = now; previousHold = hold;
    if (s && m!.state.phase === 'playing' && !loading && !g!.clock.paused && (w!.entities.get(1)?.health.current ?? 0) > 0) {
      const bars = (g!.view as unknown as { healthBars?: { snapshot: HealthBars['snapshot']; heroScreen: { left: number; top: number; right: number; bottom: number } } }).healthBars;
      const hero = bars?.heroScreen;
      const missingHero = !hero || !Object.values(hero).every(Number.isFinite);
      const overlap = hero ? (bars?.snapshot().bars ?? []).filter(b => w!.entities.get(b.id)?.civilian?.survivor?.mode === 'follow' && b.x + b.width / 2 + b.gap >= hero.left && b.x - b.width / 2 - b.gap <= hero.right && b.y + b.height / 2 + b.gap >= hero.top && b.y - b.height / 2 - b.gap <= hero.bottom).map(b => b.id) : [];
      root.__l6HoldAudit.barFrames = ++barFrames;
      if ((missingHero || overlap.length) && barViolations.length < 20) barViolations.push({ tick: w!.tick, missingHero, overlap });
    }
    if (bound === w && !playable && !loading && m?.state.phase === 'playing') {
      playable = true; loadedAt = now; root.__l6HoldAudit.loadedPerf = structuredClone(window.__SS__!.perf());
    }
    if (w?.scenario === 'L6' && m && s && bound !== w) {
      bound = w; loadedAt = now;
      const c = m.l6 as unknown as { spawn(n: number, doors: number[], wave: number): number };
      const spawn = c.spawn.bind(c);
      c.spawn = (n, doors, wave) => {
        const state = w.missions!.state.l6!, start = state.spawnLog.length;
        const cap = w.infected!.director.count >= w.infected!.director.cap;
        const reserved = wave <= 3 && w.infected!.director.count >= w.infected!.director.cap - (state.entries ?? []).reduce((sum, e) => sum + e.remaining, 0);
        const result = spawn(n, doors, wave);
        if (wave <= 2) for (const row of state.spawnLog.slice(start)) arrivals.add(row.id);
        attempts.push({ tick: w.tick, phase: state.phase, n, doors, wave, spawned: result, refused: n - result, reason: result < n ? cap ? 'cap' : reserved ? 'reserved-entry-budget' : 'offscreen-or-snap' : null });
        return result;
      };
      w.events.on('infected.attack', e => {
        if (e.type !== 'infected.attack') return;
        attackers.add(e.sourceId);
        if (e.targetId === 1) {
          playerAttackers.add(e.sourceId); playerStrikes++;
          if (e.amount > 0) { playerHits++; playerDamage += e.amount; }
        }
      });
      w.events.on('sim.tick', () => {
        if (w.scenario !== 'L6' || !w.missions?.state.l6) return;
        const state = w.missions.state.l6, p = w.entities.get(1)!, active = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden);
        for (const e of active) {
          const d = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z);
          if (d <= 15) near.add(e.id);
          if (d <= 3) contact.add(e.id);
          if (arrivals.has(e.id) && e.transform.x >= -18 && e.transform.x <= 24 && e.transform.z >= -14 && e.transform.z <= 8) shelter.add(e.id);
          if (e.combat?.attacking || e.infected?.l1?.mode === 'bite') {
            attackers.add(e.id);
            if (e.infected?.l1?.targetId === 1) playerAttackers.add(e.id);
          }
        }
        if (w.tick % 60) return;
        samples.push({ tick: w.tick, phase: state.phase, seconds: (w.tick - state.breach1At) / 60,
          leaderX: state.leaderX, leaderZ: state.leaderZ, paused: state.paused, checkpoint: w.missions.state.checkpoint,
          spawned: state.spawnLog.length, alive: active.length,
          shelterAlive: active.filter(e => e.transform.x >= -18 && e.transform.x <= 24 && e.transform.z >= -14 && e.transform.z <= 8).length,
          near15: active.filter(e => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) <= 15).length,
          attacking: active.filter(e => e.combat?.attacking).length,
          attackingPlayer: active.filter(e => e.combat?.attacking && e.infected?.l1?.targetId === 1).length,
          attackingInSecond: attackers.size, attackingPlayerInSecond: playerAttackers.size,
          playerStrikesInSecond: playerStrikes, playerHitsInSecond: playerHits, playerDamageInSecond: playerDamage,
          reached15: near.size, reached3: contact.size, shelterArrivals: shelter.size,
          player: { x: p.transform.x, z: p.transform.z, hp: p.health.current }, deaths: w.missions.state.stats.deaths,
          survivors: state.survivors.reduce((counts, r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; return counts; }, {} as Record<string, number>),
          refusals: 'spawnRefusals' in state ? { ...state.spawnRefusals } : null });
        attackers.clear(); playerAttackers.clear(); playerStrikes = playerHits = playerDamage = 0;
        root.__l6HoldAudit.final = { tick: w.tick, wallSinceLoadMs: performance.now() - loadedAt, perf: window.__SS__!.perf(), spawnLog: state.spawnLog, gates: state.gates, entries: state.entries };
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
