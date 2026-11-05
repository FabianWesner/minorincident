import { loadL3 } from '../../sim-runner/l3Bots';
import type { Tier } from './probe';

/** Isolate the production first-of decision; natural idle runs separately prove actual officer turns and uniforms. */
export async function l3FallbackProbe(tier: Tier) {
  const { world, mission } = await loadL3(1, tier);
  try {
    const s = mission.state.l3!, ids = Array.from({ length: 8 }, (_, i) => world.infected!.spawn('infected.runner', { x: -110 + i * 2, z: -28 }));
    const controller = mission.l3! as unknown as { checkFallback(): void; fallback(cause: string): void };
    let calls: string[] = [];
    controller.fallback = cause => { calls.push(cause); };
    mission.l3!.completed('defend');
    const station = s.waves.find(wave => wave.dir === 'station')!;
    const cases = [
      { name: 'seven inside', inside: 7, turned: 0, elapsed: 1, station: false, expected: null },
      { name: 'eight inside', inside: 8, turned: 0, elapsed: 1, station: false, expected: 'inside' },
      { name: 'two turned', inside: 0, turned: 2, elapsed: 1, station: false, expected: null },
      { name: 'three turned', inside: 0, turned: 3, elapsed: 1, station: false, expected: 'turned' },
      { name: 'one tick before60s', inside: 0, turned: 0, elapsed: 3599, station: false, expected: null },
      { name: 'exactly60s', inside: 0, turned: 0, elapsed: 3600, station: false, expected: 'time' },
      { name: 'simultaneous thresholds', inside: 8, turned: 3, elapsed: 3600, station: false, expected: 'turned' },
      { name: 'station cohort excluded', inside: 8, turned: 0, elapsed: 1, station: true, expected: null },
    ];
    return cases.map(test => {
      world.tick = 4000; s.phase = 'attack'; s.attackAt = world.tick - test.elapsed;
      s.turnedOfficers = s.officerIds.slice(0, test.turned); station.id = test.station ? ids[0] : 0;
      ids.forEach((id, i) => Object.assign(world.entities.get(id)!.transform, i < test.inside ? { x: -148 + i * 2, z: -10 } : { x: -110 + i * 2, z: -28 }));
      calls = []; controller.checkFallback();
      const actual = calls[0] ?? null;
      return { ...test, actual, calls: calls.length, pass: calls.length <= 1 && actual === test.expected };
    });
  } finally { world.dispose(); }
}
