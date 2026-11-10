// Diagnostic: time world construction (loadLevel) per level, cold then warm, in one process.
// Usage: node --import tsx/esm tools/qa/threat/load-profile.ts
import { loadLevel, runnerLevels } from '../../sim-runner/levels';
for (const pass of ['cold', 'warm']) for (const level of runnerLevels) {
  const t = performance.now();
  const world = await loadLevel(level, 1, undefined, 0, { quality: 'low' });
  const loaded = (performance.now() - t) / 1000;
  const t2 = performance.now(); for (let i = 0; i < 120; i++) world.update();
  console.log(`${pass} ${level} load ${loaded.toFixed(2)}s, 120 ticks ${((performance.now() - t2) / 1000).toFixed(2)}s`);
  world.dispose();
}
