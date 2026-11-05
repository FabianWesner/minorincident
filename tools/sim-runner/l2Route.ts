import { mkdirSync, writeFileSync } from 'node:fs';
import { l2Routes } from '../../src/debug/bot/LevelTwoBot';
import { followFrustum } from './l3Bots';
import { loadL2, runL2 } from './l2Bots';

/** Real input, seed-one supermarket → Juniper → Elm → bridge census. Each identity is counted at its first visible encounter. */
export async function measureL2Route(tier: 'high' | 'low') {
  const { world: w, mission: m } = await loadL2(1, tier);
  const route = [m.def.anchors['l2-watch'], ...l2Routes.direct];
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
  const progress = (p: { x: number; z: number }) => {
    let nearest = Infinity, metres = 0;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
      const distance = Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
      if (distance < nearest) { nearest = distance; metres = cumulative[i - 1] + t * (cumulative[i] - cumulative[i - 1]); }
    }
    return { metres, offset: nearest };
  };
  const noticed = new Set<number>();
  const encounters: { id: number; metres: number; source: 'market' | 'street' | 'bridge' | 'outbreak' }[] = [];
  const arrivals: { id: number; door: string; x: number; z: number; metres: number; offset: number; bridge: boolean; seen: boolean; home: { x: number; z: number } }[] = [];
  let peak = 0;
  try {
    const run = runL2(w, m, 'newbie', { opening: 'direct', maxSeconds: 360, stopWhen: () => {
      followFrustum(w);
      peak = Math.max(peak, w.infected!.director.count);
      const s = m.state.l2!;
      for (const q of s.pending) if (q.id > 0 && !arrivals.some(a => a.id === q.id)) arrivals.push({ id: q.id, door: q.door, x: q.x!, z: q.z!, metres: progress(q.home).metres, offset: progress({ x: q.x!, z: q.z! }).offset, bridge: s.clusterIds.includes(q.id), seen: !!q.seen, home: { ...q.home } });
      if (!s.doorsOpenAt || s.crossedAt) return false;
      const p = w.entities.get(1)!.transform;
      for (const e of w.infected!.active) {
        if (noticed.has(e.id) || e.health.current <= 0 || e.hidden || e.infectionRise || Math.hypot(p.x - e.transform.x, p.z - e.transform.z) > 12 || !w.infected!.nav.visible(p, e.transform, 0)) continue;
        noticed.add(e.id);
        const source = s.clusterIds.includes(e.id) ? 'bridge' : s.escapeIds.includes(e.id) ? 'street' : s.ambushIds.includes(e.id) ? 'market' : 'outbreak';
        encounters.push({ id: e.id, metres: +progress(p).metres.toFixed(1), source });
      }
      return false;
    } });
    const bins50m = Array.from({ length: Math.ceil(cumulative.at(-1)! / 50) }, (_, i) => {
      const inBin = encounters.filter(e => e.metres >= i * 50 && e.metres < (i + 1) * 50);
      return { from: i * 50, to: Math.min((i + 1) * 50, +cumulative.at(-1)!.toFixed(1)), total: inBin.length, street: inBin.filter(e => e.source === 'street').length, bridge: inBin.filter(e => e.source === 'bridge').length };
    });
    return { tier, outcome: run.outcome, deaths: run.deaths, seconds: run.simSeconds, completed: run.timeline.filter(e => e.type.startsWith('objective:')).map(e => e.type.slice(10)), peak, bins50m, bridgeSize: m.state.l2!.clusterIds.length, encounters, arrivals };
  } finally { w.dispose(); }
}

if (process.argv[1]?.endsWith('/l2Route.ts')) {
  const out = process.argv[2] ?? 'test-results/l2-route-infected/route';
  mkdirSync(out, { recursive: true });
  for (const tier of ['high', 'low'] as const) {
    const result = await measureL2Route(tier);
    writeFileSync(`${out}/${tier}.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ ...result, encounters: undefined, arrivals: undefined }));
  }
}
