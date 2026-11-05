import type { Game } from '../../src/Game';

/** Optional read-only telemetry for the unchanged real-input playtest policy. */
export function installSoftlockAudit(): void {
  const audit: unknown[] = [];
  (window as unknown as { __softlockAudit: unknown[] }).__softlockAudit = audit;
  let last = -Infinity;
  const sample = (now: number) => {
    requestAnimationFrame(sample);
    const game = (window as unknown as { __SCENE__?: { game: Game } }).__SCENE__?.game;
    const w = game?.world, m = w?.missions, p = w?.entities.get(1);
    if (!w || !m || !p || !w.scenario || !['L2', 'L6', 'L8'].includes(w.scenario) || m.state.phase !== 'playing') return;
    const invariant = !!(m.state.l2 && p.hidden && !m.state.states.boarded);
    if (!invariant && now - last < 500) return;
    last = now;
    const row: Record<string, unknown> = {
      level: w.scenario, tick: w.tick, at: now, step: m.def.steps.find(s => m.state.steps[s.id].status === 'active')?.id,
      player: { x: p.transform.x, z: p.transform.z, hidden: !!p.hidden, hp: p.health.current },
      objective: document.querySelector('[data-testid=mission-tracker]')?.textContent,
    };
    if (m.state.l2) {
      const s = m.state.l2, truck = w.entities.get(s.truckId)!;
      row.l2 = { phase: s.phase, seated: s.seated, boarded: m.state.states.boarded, rideS: s.rideS, rideV: s.rideV, departAt: s.departAt, arrivedAt: s.arrivedAt,
        invariant, props: s.phase === 'alarm' ? w.props?.items.filter(prop => {
          const p = prop.collider.translation(); return Math.hypot(p.x - truck.transform.x, p.z - truck.transform.z) < 8;
        }).map(prop => ({ id: prop.id, asset: prop.assetId, half: prop.half, home: prop.home, centre: prop.collider.translation(), rotation: prop.collider.rotation() })) : undefined };
    }
    if (m.l8) {
      const zoo = m.l8, car = w.vehicles!.cars.get(zoo.state.carId)!, door = zoo.door();
      row.l8 = { breachedAt: zoo.state.breachedAt, active: w.vehicles!.active, carId: zoo.state.carId, door, aboard: m.state.states.aboard,
        passengers: zoo.passengers().map(id => { const e = w.entities.get(id)!; return { id, companion: !!e.companion, hp: e.health.current, x: e.transform.x, z: e.transform.z, phase: car.entity.vehicle!.passengers?.find(p => p.id === id)?.phase ?? null }; }) };
    }
    if (m.state.l6) {
      const s = m.state.l6, anchor = m.state.marker ? m.def.anchors[m.state.marker] : undefined;
      row.l6 = { phase: s.phase, marker: m.state.marker, anchor: anchor && { x: anchor.x, z: anchor.z }, strayed: s.strayed, wait: s.waitFor?.kind };
    }
    audit.push(row);
  };
  requestAnimationFrame(sample);
}
