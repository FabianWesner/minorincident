/** Native L2 radio admission diagnostic using the production camera rig. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';

const browser = JSON.parse(readFileSync('docs/reports/fix55-a/L2-11-radio-view.json', 'utf8'));
const rows = [];
for (const tier of ['low', 'high'] as const) for (const profile of ['no-axe', 'complete', 'aggressive'] as const) for (const zoom of [.5, 1.5]) {
  const { world, mission } = await loadL2(1, tier);
  let radioSnapshot: { tick: number; radioAt: number; player: { x: number; z: number }; actors: { id: number; at: { x: number; z: number }; offscreen: boolean }[]; pending: unknown } | null = null;
  try {
    const report = runL2(world, mission, profile, { zoom, god: profile === 'aggressive', maxSeconds: 140, stopWhen: () => {
      const s = mission.state.l2!;
      if (!s.radioAt) return false;
      radioSnapshot ??= { tick: world.tick, radioAt: s.radioAt, player: { ...world.entities.get(1)!.transform },
        actors: world.infected!.active.filter(e => e.health.current > 0).map(e => ({ id: e.id, at: { ...e.transform },
          ambush: s.ambushIds.includes(e.id), escape: s.escapeIds.includes(e.id), cluster: s.clusterIds.includes(e.id),
          offscreen: world.infected!.director.offscreen(e.transform, e.transform.y - .7), mode: e.infected?.l1?.mode, target: e.infected?.l1?.targetId })),
        pending: structuredClone(s.pending) };
      return world.tick > s.radioAt;
    } });
    // Frozen browser receipt is valid only for this production source. Compare
    // actual positions and spawn eligibility, not a guessed camera envelope.
    const reference = browser.rows.find((r: { tier: string; zoom: number }) => r.tier === tier && r.zoom === zoom);
    let matchesBrowser: boolean | null = null;
    if (profile === 'no-axe' && reference && browser.sourceHash === provenance().sourceHash) {
      const actual = radioSnapshot as unknown as { tick: number; actors: { id: number; at: { x: number; z: number }; offscreen: boolean }[] };
      assert.equal(actual.tick, reference.tick);
      assert.deepEqual(actual.actors.map(a => [a.id, a.at.x, a.at.z, a.offscreen]),
        reference.actors.map((a: { id: number; at: { x: number; z: number }; directorOffscreen: boolean }) => [a.id, a.at.x, a.at.z, a.directorOffscreen]));
      matchesBrowser = true;
    }
    rows.push({ tier, profile, protected: profile === 'aggressive', zoom, radio: report.radio, radioSnapshot, matchesBrowser });
    console.log(JSON.stringify({ tier, profile, zoom, radio: report.radio }));
  } finally { world.dispose(); }
}
const out = 'test-results/fix55-a/L2-11-production-camera-native.json';
mkdirSync('test-results/fix55-a', { recursive: true });
writeFileSync(out, JSON.stringify({ ...provenance(), toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), rows }, null, 2) + '\n');
assert(rows.every(r => r.radio && r.radio.escapeArea >= 25 && r.radio.groupsOf4 >= 3 && r.radio.chasingFraction <= .2), 'Radio admission matrix has failing cells; see retained receipt');
