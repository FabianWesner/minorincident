import { expect, test, vi } from 'vitest';
import { loadLevel } from './world';
import { l4, l4Edges, l4Emergence, l4Route, l4RoutePose, l4ConvoyStations } from '../../../src/data/l4';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';

for (const tier of ['high', 'low'] as const) test(`5 L4 ${tier}: every authored war wave and collapse batch spawns and reaches its goal area`, async () => {
  const w = await loadLevel('L4', 1, tier), errors: string[] = [];
  try {
    const m = w.missions!, s = m.state.l4!;
    const c = m.l4! as unknown as { arrive(): void; turn(): void; waves(): void; checkLineBreak(): void; openGate(): void };
    const route = l4Route(), stations = l4ConvoyStations(route.length);
    for (const [i, id] of s.convoyIds.entries()) Object.assign(w.entities.get(id)!.transform, l4RoutePose(route, stations.end[i]));
    c.arrive();
    const player = w.entities.get(1)!; Object.assign(player.transform, { x: -27, z: 4 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    w.combat!.damage.god = true; followFrustum(w); c.turn();
    // This fixture isolates each wave's full lifetime from the story's first-of line-break cancellation.
    // Production wave authoring, queue limits, spawner, admission, obstacles and movement all stay active.
    vi.spyOn(c, 'checkLineBreak').mockImplementation(() => {});
    for (const collapse of [false, true]) for (let wave = 0; wave < (collapse ? 1 : l4.war.waveSize.length); wave++) {
      for (const e of [...w.infected!.active]) w.infected!.release(e);
      s.pend.fill(0); s.emergedIds.length = 0; s.collapseIds.length = 0; s.edgeNext.fill(0);
      s.phase = collapse ? 'collapse' : 'war'; s.wave = wave; s.collapseWaves = wave;
      if (collapse) c.openGate();
      s.waveAt = collapse ? Infinity : w.tick; s.collapseWaveAt = collapse ? w.tick : Infinity;
      const base = collapse ? l4.war.collapseWaveSize : l4.war.waveSize[wave];
      const n = Math.max(1, Math.ceil(base * (tier === 'low' ? .5 : 1) * (collapse ? 1 : l4.war.waveScale)));
      const ring = l4Edges.length - 1, expected = collapse ? n * l4.war.edgesPerWave : Math.ceil(n * l4.war.edgesPerWave / ring) * ring;
      // Authored group cadence plus the longest emergence approach at walking pace, with a 15 s admission margin.
      const approach = Math.max(...l4Emergence.map(e => Math.hypot(e.at[0] - l4.map.centre.x, e.at[1] - l4.map.centre.z)));
      const deadlineTicks = Math.ceil((Math.ceil(expected / ring / l4.war.group[0]) * l4.war.groupEveryS[1] + approach / 1.6 + 15) * 60);
      c.waves(); s.waveAt = s.collapseWaveAt = Infinity;
      const ids = new Set<number>(), admitted = new Set<number>(), reached = new Set<number>();
      const collect = () => {
        for (const id of collapse ? s.collapseIds : s.emergedIds) if (collapse || s.origin[id] < l4Emergence.length) ids.add(id);
      };
      collect();
      for (let tick = 0; tick < deadlineTicks && (ids.size < expected || reached.size < expected); tick++) {
        // Keep the authored target roster alive; this measures arrival routes rather than combat outcomes.
        for (const e of w.entities.iterate()) if (e.civilian && !e.infected) { e.health.current = e.health.max = 1_000_000; delete e.infection; }
        for (const id of ids) { const e = w.entities.get(id); if (e) e.health.current = e.health.max = 1_000_000; }
        followFrustum(w); w.update(); collect();
        for (const id of ids) {
          const e = w.entities.get(id); if (!e || e.hidden || e.pendingAdmission || e.infected?.hidden) continue;
          admitted.add(id);
          const p = l4.perimeter, at = e.transform;
          if (at.x > p.x0 - 1.5 && at.x < p.x1 + 1.5 && at.z > p.z0 - 1.5 && at.z < p.z1 + 1.5) {
            reached.add(id); w.infected!.release(e); // Free the real cap for the remainder of this wave.
          }
        }
      }
      const name = `L4/${tier}/${collapse ? 'collapse' : `war-${wave}`}`;
      console.log(`[qa:invariants] ${name}: authored=${expected} spawned=${ids.size} admitted=${admitted.size} reached=${reached.size}`);
      if (reached.size !== ids.size) console.log(`[qa:invariants] ${name} unreached: ${JSON.stringify([...ids].filter(id => !reached.has(id)).map(id => {
        const e = w.entities.get(id);
        return { id, at: e?.transform, state: e?.infected?.state, pending: e?.pendingAdmission, emerging: e?.emerging, nearestGuardM: e && Math.min(...s.soldierIds.map(id => w.entities.get(id)).filter(e => !!e && e.health.current > 0).map(g => Math.hypot(g!.transform.x - e.transform.x, g!.transform.z - e.transform.z))) };
      }))}`);
      if (ids.size !== expected || admitted.size !== expected || reached.size !== expected) errors.push(`${name}: authored ${expected}, spawned ${ids.size}, admitted ${admitted.size}, reached ${reached.size}`);
    }
    expect(errors, 'waves invariant: L4 authored count and goal arrival').toEqual([]);
  } finally { vi.restoreAllMocks(); w.dispose(); }
}, 480_000);
