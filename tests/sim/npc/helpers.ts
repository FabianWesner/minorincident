import { SimWorld } from '../../../src/sim/world/SimWorld';
export async function npcWorld(name = 'civ-street', seed = 1) { const w = new SimWorld(); await w.init(); w.loadScenario(name, seed); w.combat!.damage.god = true; return w; }
export function step(w: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) w.update(); }
export function teleport(w: SimWorld, x: number, z: number) { const p = w.entities.get(1)!; p.transform.x = x; p.transform.z = z; w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setLinvel({ x: 0, y: 0, z: 0 }, true); w.spatial.set(1, x, z); }
