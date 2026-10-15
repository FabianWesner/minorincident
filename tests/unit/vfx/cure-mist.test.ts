import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { Vfx } from '../../../src/render/vfx/Vfx';

for (const quality of ['high', 'low'] as const) test(`T-E32-23-mist-pool-${quality} @E32-AC23 @E18-AC06 cure shares the fixed smoke pool and deaths make no blood/gibs`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('mega-course');
  const mission = world.loadMission(levelTenMission(() => ({ x: 0, z: 0, radius: 2 })));
  mission.begin(); mission.state.states['cure-released'] = true;
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} }); fx.set({ quality });
  try {
    // Reserve the console point for the dog before the zero-radius release.
    const player = world.entities.get(1)!;
    expect(world.solids.relocate(player, { x: 4, z: 4, y: player.transform.y }, 'test.cure-console', 4, false)).toBe(true);
    const id = world.infected!.spawn('infected.dog', { x: 0, z: 0 }, { offNav: true });
    expect(world.entities.get(id)!.transform).toMatchObject({ x: 0, z: 0 });
    mission.l10!.cure.release(); expect(world.entities.get(id)!.health.current).toBe(0);
    const geometry = fx.blasts.children.map(mesh => ('geometry' in mesh ? mesh.geometry : null));
    mission.state.cureFront!.elapsed = 360; mission.state.cureFront!.radius = 60;
    for (let i = 0; i < 600; i++) fx.advance(1 / 60);
    const proof = fx.snapshot();
    expect(proof.blasts.puffs).toBeGreaterThan(0);
    expect(proof.blasts.puffs).toBeLessThanOrEqual(quality === 'high' ? 400 : 120);
    expect(proof.blasts.puffCap).toBe(quality === 'high' ? 400 : 120);
    expect(fx.blasts.children.map(mesh => ('geometry' in mesh ? mesh.geometry : null))).toEqual(geometry);
    expect(fx.gibs.count).toBe(0); expect(fx.detached).toBe(0); expect(fx.decals.count).toBe(0); expect(fx.blasts.blasts).toBe(0);
    fx.set({ vfx: false }); fx.advance(.1); expect(world.entities.get(id)!.health.current).toBe(0);
  } finally { fx.dispose(); world.dispose(); }
});
