import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';

// Native visible-information policy: follow the same dynamic marker position
// the HUD uses, with the shared ordinary visible-threat combat policy.
const out = 'test-results/s160-l4harbor';
mkdirSync(out, { recursive: true });
const results = [];
for (const seed of [1, 2, 3]) for (const quality of ['high', 'low'] as const) {
  const deaths: { tick: number; phase: string; x: number; z: number; hp: number }[] = [];
  let harborMax = 0;
  const archetypes: Record<string, number> = {};
  let harborSample: { tick: number; x: number; z: number; count: number; mix: Record<string, number>; losCount: number; losMix: Record<string, number>; marker: unknown; aheadLos: unknown[]; nearestLos: unknown[] } | null = null;
  const run = await runLevel('L4', 'complete', seed, 700, 'auto', undefined, undefined, 0, {
    quality,
    l4VisibleMarker: true,
    beforeBegin: world => {
      world.events.on('player.died', () => {
        const player = world.entities.get(1)!;
        deaths.push({ tick: world.tick, phase: world.missions!.state.l4!.phase, x: player.transform.x, z: player.transform.z, hp: player.health.current });
      });
      const update = world.update.bind(world);
      world.update = (...args) => {
        update(...args);
        const player = world.entities.get(1)!, phase = world.missions!.state.l4?.phase;
        // Harbor's westbound leg crosses z≈-37 from x≈49 back through x≈-64.
        if (phase !== 'collapse' || player.transform.x > 55 || player.transform.x < -70 || player.transform.z > -14 || player.transform.z < -52) return;
        const near = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.emerging && !e.infectionRise && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 18);
        if (near.length > harborMax) {
          harborMax = near.length;
          const mix: Record<string, number> = {};
          for (const e of near) mix[e.archetype] = (mix[e.archetype] ?? 0) + 1;
          for (const [k, n] of Object.entries(mix)) archetypes[k] = Math.max(archetypes[k] ?? 0, n);
          const los = near.filter(e => world.infected!.nav.visible(player.transform, e.transform, 0)), losMix: Record<string, number> = {};
          for (const e of los) losMix[e.archetype] = (losMix[e.archetype] ?? 0) + 1;
          const px = player.transform.x, pz = player.transform.z, yaw = player.transform.yaw;
          const marker = markerAnchor(world.missions!), target = marker ?? world.missions!.def.anchors['l4-cellar-door'];
          const md = Math.hypot(target.x - px, target.z - pz) || 1, ux = (target.x - px) / md, uz = (target.z - pz) / md;
          const aheadLos = los.filter(e => ((e.transform.x - px) * ux + (e.transform.z - pz) * uz) > 0)
            .sort((a, b) => Math.hypot(a.transform.x - px, a.transform.z - pz) - Math.hypot(b.transform.x - px, b.transform.z - pz))
            .slice(0, 8).map(e => ({ id: e.id, archetype: e.archetype, x: e.transform.x, z: e.transform.z, distance: Math.hypot(e.transform.x - px, e.transform.z - pz) }));
          harborSample = { tick: world.tick, x: px, z: pz, count: near.length, mix, losCount: los.length, losMix,
            marker: marker && { x: marker.x, z: marker.z }, aheadLos,
            nearestLos: los.sort((a, b) => Math.hypot(a.transform.x - px, a.transform.z - pz) - Math.hypot(b.transform.x - px, b.transform.z - pz)).slice(0, 8).map(e => ({ id: e.id, archetype: e.archetype, x: e.transform.x, z: e.transform.z, distance: Math.hypot(e.transform.x - px, e.transform.z - pz), yaw })) };
        }
      };
    },
  });
  const row = { seed, quality, policy: 'dynamic-HUD-marker + ordinary visible-threat combat', run, escapeDeaths: deaths.filter(d => d.phase === 'collapse').length,
    deaths, harbor: { maxLivingWithin18m: harborMax, peakMix: harborSample, archetypePeaks: archetypes } };
  results.push(row);
  console.log(JSON.stringify({ seed, quality, outcome: run.outcome, totalDeaths: run.deaths, escapeDeaths: row.escapeDeaths,
    harborMaxLivingWithin18m: harborMax, peakMix: harborSample }));
  writeFileSync(`${out}/native-visible.json`, JSON.stringify(results, null, 2));
}
