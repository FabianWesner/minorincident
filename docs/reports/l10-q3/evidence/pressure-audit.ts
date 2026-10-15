import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../../../../tools/sim-runner/levels';
import { megaAlpha } from '../../../../src/data/megaAlpha';
const rows = [];
for (const tier of ['high', 'low'] as const) {
  const world = await loadLevel('L10', 32);
  try {
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: 3317, z: 95 });
    world.physics.playerBody!.setTranslation(player.transform, true);
    world.chunks!.setQuality(tier); world.chunks!.update([3317, 95]);
    const pursuit = world.megaPursuit!, id = pursuit.introduce({ x: 2977, z: 95 });
    let moved = 0, last = { ...world.entities.get(id)!.transform };
    const modes = new Set<string>();
    for (let tick = 0; tick < 240; tick++) {
      world.update(); const now = world.entities.get(id)!.transform;
      moved += Math.hypot(now.x - last.x, now.z - last.z); last = { ...now };
      modes.add(pursuit.state.mode);
    }
    rows.push({ tier, modes: [...modes], seconds: 4, metres: moved, speedMs: moved / 4, requiredCruiseMs: megaAlpha.cruiseMs, ratio: moved / 4 / megaAlpha.cruiseMs, withinTwoPercent: Math.abs(moved / 4 / megaAlpha.cruiseMs - 1) <= .02, bossId: id });
  } finally { world.dispose(); }
}
mkdirSync('test-results/l10-q3', { recursive: true });
writeFileSync('test-results/l10-q3/pressure-audit.json', JSON.stringify({ test: 'T-E32-10-production-pressure', ac: 'E32-AC10', seed: 32, fixture: 'stationary R6 player at 3317,95; boss at authored route node 2977,95', rows }, null, 2));
console.log(JSON.stringify(rows));

process.exitCode = rows.every(row => row.withinTwoPercent) ? 0 : 1;
