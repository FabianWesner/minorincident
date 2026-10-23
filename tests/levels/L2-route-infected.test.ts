import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import { measureL2Route } from '../../tools/sim-runner/l2Route';

for (const tier of ['high', 'low'] as const) test(`PO 10-23 @E20 ${tier}: market-to-bridge singles/pairs every 25–40 m, no three within 8 m, finish without skipping`, async () => {
  const r = await measureL2Route(tier);
  mkdirSync('test-results/l2-route-infected/route-test', { recursive: true });
  writeFileSync(`test-results/l2-route-infected/route-test/${tier}.json`, JSON.stringify(r, null, 2) + '\n');
  expect(r.outcome).toBe('complete');
  expect(r.completed).toEqual(['axe', 'calm', 'board', 'ride', 'doors', 'bridge']);
  expect(r.deaths).toBeLessThanOrEqual(1);
  expect(r.peak).toBeLessThanOrEqual(l2.escape.caps[tier]);
  const scattered = r.arrivals.filter(a => a.door.startsWith('l2-route-edge-'));
  expect(scattered).toHaveLength(tier === 'high' ? 6 : 4);
  expect(scattered.every(a => !a.seen)).toBe(true);
  expect(scattered.every(a => a.offset >= 2 && a.offset <= 7)).toBe(true);
  const pockets = [...new Set(scattered.map(a => a.door))].map(door => scattered.filter(a => a.door === door));
  expect(pockets).toHaveLength(4);
  let previous = 0;
  for (const pocket of pockets.sort((a, b) => a[0].metres - b[0].metres)) {
    expect(pocket.length).toBeLessThanOrEqual(2);
    const gap = pocket[0].metres - previous;
    expect(gap).toBeGreaterThanOrEqual(25); expect(gap).toBeLessThanOrEqual(40);
    previous = pocket[0].metres;
    // Placement must yield a real visible encounter, not just a pending census entry.
    expect(pocket.some(a => r.encounters.some(e => e.id === a.id))).toBe(true);
  }
  // Connected components catch chains as well as three bodies at the same home.
  const remaining = new Set(r.arrivals.filter(a => !a.bridge && a.offset <= 8));
  while (remaining.size) {
    const connected = [remaining.values().next().value!]; remaining.delete(connected[0]);
    for (const a of connected) for (const b of remaining) if (Math.hypot(a.x - b.x, a.z - b.z) <= 8) { remaining.delete(b); connected.push(b); }
    expect(connected.length, `spawn cluster at ${connected[0].x},${connected[0].z}`).toBeLessThanOrEqual(2);
  }
  expect(r.bins50m.slice(0, 3).every(bin => bin.street >= 1), JSON.stringify(r.bins50m)).toBe(true);
  expect(r.bridgeSize).toBe(tier === 'high' ? 13 : 7);
}, 600_000);
