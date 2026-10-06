import { afterEach } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
const worlds: SimWorld[] = [];
export async function arena() { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena'); return w; }
export function step(w: SimWorld, count: number) { for (let i = 0; i < count; i++) w.update(); }
export function spawn(w: SimWorld, role: string, x: number, z = 0, state: 'chase' | 'idle' = 'chase') { return w.entities.get(w.infected!.spawn(`infected.${role}`, { x, z }, { state }))!; }
export function hit(w: SimWorld, targetId: number, base = 1, type: 'melee' | 'bullet' | 'explosive' = 'melee', part?: 'leg') {
  return w.combat!.damage.apply({ sourceId: 1, targetId, attackId: 1, actionId: 'weapon.test', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base, multiplier: 1, type, stagger: 0, knockback: 0, part });
}
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
