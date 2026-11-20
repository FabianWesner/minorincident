import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { l7Encounters } from '../../../src/data/l7';
import type { FixtureReceipt } from './fixtures';

type Point = { x: number; z: number };
type Witness = { tick: number; street: number; sector: string; source: number; target: number; pack: number; roadReachable: boolean; sourcePosition: Point; targetPosition: Point; playerPosition: Point };
type Input = { sourceHash: string; producerHash: string; tier: string; seed: number; completed: boolean; streets: { street: number; witnesses: Witness[] }[] };
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export function l7DirectionReceipts(sourceHash: string): { path: string; receipt: FixtureReceipt }[] {
  const producer = 'tools/qa/l7-windups.ts', producerHash = sha(producer);
  return (['low', 'high'] as const).flatMap(tier => {
    const path = `docs/reports/s192-l7harder/directions-${tier}.json`;
    if (!existsSync(path)) return [];
    const input = JSON.parse(readFileSync(path, 'utf8')) as Input;
    if (input.sourceHash !== sourceHash || input.producerHash !== producerHash || input.tier !== tier || input.seed !== 1) return [];
    const rows = l7Encounters.streets.map((anchor, street) => {
      const row = input.streets.find(x => x.street === street), events = row?.witnesses ?? [];
      const ticks = events.map(x => x.tick), sources = new Set(events.map(x => x.source));
      const valid = events.length > 0 && sources.size === events.length && Math.max(...ticks) - Math.min(...ticks) < 300 && events.every(x => {
        const dx = x.sourcePosition.x - x.targetPosition.x, dz = x.sourcePosition.z - x.targetPosition.z;
        const sector = Math.abs(dx) > Math.abs(dz) ? dx > 0 ? 'east' : 'west' : dz > 0 ? 'south' : 'north';
        return x.street === street && x.pack === l7Encounters.firstStreetGroup + street && x.roadReachable && x.sector === sector && Math.hypot(x.playerPosition.x - anchor.x, x.playerPosition.z - anchor.z) <= 25 && Math.hypot(x.targetPosition.x - x.playerPosition.x, x.targetPosition.z - x.playerPosition.z) <= 25;
      });
      return { street, valid, sectors: [...new Set(events.map(x => x.sector))], witnesses: events.length };
    });
    const pass = input.completed && rows.every(x => x.valid && x.sectors.length >= 3);
    const receipt: FixtureReceipt = { version: 1, level: 'L7', tier, sourceHash, fixtureHash: producerHash, errors: [], checks: [{ id: 'L7-05', clause: 'three road-connected arrival directions within five seconds per street fight', tier, policy: 'direction-trace', status: pass ? 'PASS' : 'FAIL', value: rows, target: 'At least three distinct attackers from different directions in a five-second window at each street, with navigable paths to their nearby targets.', receipt: path }] };
    return [{ path, receipt }];
  });
}
