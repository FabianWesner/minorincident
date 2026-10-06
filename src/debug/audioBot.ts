import type { Game } from '../Game';
import { resolvePosition } from '../levels/districts/validate';
import type { NavGrid } from '../sim/world/NavGrid';
import type { Point } from '../levels/districts/types';
/** Audio coverage bot for the currently available L1 composition. Walks every authored objective
 * using the real nav grid/controller; campaign mission completion remains the E19 bot's contract. */
function route(nav: NavGrid, start: Point, end: Point): Point[] {
    const first = nav.index(...start), last = nav.index(...end), parent = new Int32Array(nav.cells.length);
    parent.fill(-1);
    const queue = new Int32Array(parent.length);
    let read = 0, write = 1;
    queue[0] = first;
    parent[first] = first;
    while (read < write && parent[last] === -1) {
        const cell = queue[read++], x = cell % nav.width;
        for (const next of [x > 0 ? cell - 1 : -1, x + 1 < nav.width ? cell + 1 : -1, cell - nav.width, cell + nav.width])
            if (next >= 0 && next < parent.length && nav.cells[next] && parent[next] === -1) {
                parent[next] = cell;
                queue[write++] = next;
            }
    }
    if (parent[last] === -1)
        throw new Error('Audio bot objective unreachable');
    const result: Point[] = [];
    for (let cell = last; cell !== first; cell = parent[cell])
        result.push([nav.min[0] + (cell % nav.width + 0.5) * nav.cellSize, nav.min[1] + (Math.floor(cell / nav.width) + 0.5) * nav.cellSize]);
    return result.reverse();
}
export async function runAudioL1Bot(game: Game): Promise<{
    visited: string[];
    ticks: number;
    distance: number;
    errors: string[];
    cues: number;
}> {
    await game.loadLevel('L1', { seed: 16 });
    game.world.missions?.begin();
    game.clock.pause();
    await game.audio.unlock();
    game.audio.log.length = 0;
    const world = game.world, districts = world.districts!, visited: string[] = [];
    let distance = 0, ticks = 0;
    for (const d of districts.districts)
        for (const objective of d.gameplay.objectives) {
            const local = resolvePosition(objective.position, d.layout), target: Point = [local[0] + d.origin[0], local[1] + d.origin[1]], player = world.entities.get(1)!.transform;
            for (const [x, z] of route(world.districts!.nav, [player.x, player.z], target)) {
                let remaining = 100;
                while (Math.hypot(x - player.x, z - player.z) > 0.22 && remaining--) {
                    const dx = x - player.x, dz = z - player.z, len = Math.hypot(dx, dz), speed = Math.min(1, len * 2);
                    game.input.inject({ move: { x: dx / len * speed, z: dz / len * speed } });
                    const beforeX = player.x, beforeZ = player.z;
                    await game.step(3);
                    ticks += 3;
                    distance += Math.hypot(player.x - beforeX, player.z - beforeZ);
                }
                if (remaining <= 0)
                    throw new Error(`Audio bot blocked near ${x},${z}`);
            }
            visited.push(`${d.id}/${objective.id}`);
        }
    game.input.clear();
    return { visited, ticks, distance, errors: [...game.audio.registry.errors], cues: game.audio.log.length };
}
