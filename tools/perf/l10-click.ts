/** Isolate the click-resolution work near the reported tick-2965 location. */
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { NavGrid } from '../../src/sim/ai/NavGrid';

const world = await loadLevel('L10', 1), costs: { method: string; ms: number; cells: number; budget?: number }[] = [];
const forPlayer = NavGrid.prototype.forPlayer, reachPath = NavGrid.prototype.reachPath;
NavGrid.prototype.forPlayer = function (...args) {
  const start = performance.now(), grid = forPlayer.apply(this, args);
  costs.push({ method: 'forPlayer', ms: performance.now() - start, cells: grid.blocked.length }); return grid;
};
NavGrid.prototype.reachPath = function (...args) {
  const start = performance.now(), complete = reachPath.apply(this, args);
  costs.push({ method: 'reachPath', ms: performance.now() - start, cells: this.blocked.length, budget: args[3] ?? Infinity }); return complete;
};
try {
  world.chunks!.setQuality('low');
  const player = world.entities.get(1)!;
  Object.assign(player.transform, { x: 755.29, z: 13.74 }); world.chunks!.update();
  for (const target of [{ x: 757, z: 25 }, { x: 760, z: 25 }, { x: 758, z: 15 }, { x: 780, z: 25 }, { x: 800, z: 25 }]) {
    world.controls.reset(); costs.length = 0;
    const frame = emptyInput(); frame.moveTarget = target; frame.pointerGround = true;
    const start = performance.now(); world.controls.resolve(frame);
    console.log(JSON.stringify({ target, ms: performance.now() - start, costs, resolved: world.controls.snapshot() }));
  }
} finally { NavGrid.prototype.forPlayer = forPlayer; NavGrid.prototype.reachPath = reachPath; world.dispose(); }
