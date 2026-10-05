import { afterEach } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { Side } from '../../../src/data/actions/schema';
const worlds: SimWorld[] = [];
export async function arena(): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('combat-arena', 1); return w; }
export function step(w: SimWorld, count: number): void { for (let i = 0; i < count; i++) w.update(); }
export function equip(w: SimWorld, left = ['weapon.bat'], right = ['weapon.grenade']): void { w.combat!.setLoadout(left, right); }
export function fire(w: SimWorld, side: Side = 'LEFT', aim = { x: 1, z: 0 }, aimPoint?: { x: number; z: number }): void {
  w.clearInput(); w.setInput({ aim, aimPoint, [side === 'LEFT' ? 'left' : 'right']: { down: true, held: true, up: false } }); step(w, 1); w.clearInput();
}
export function dummy(w: SimWorld, x: number, z = 0, hp = 100): number { return w.spawnDummy('infected.dummy', { x, z }, { hp }); }
export function health(w: SimWorld, id: number): number { return w.entities.get(id)!.health.current; }
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
