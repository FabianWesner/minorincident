import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
test('@E22 broken army lines stay destructible cover without a player rebuild interaction in war and collapse', async () => {
  const loaded = await loadL4(2); world = loaded.world;
  const w = world, m = loaded.mission;
  m.completeObjective('ride'); m.completeObjective('quartermaster'); w.combat!.damage.god = true;
  while (!m.state.l4!.turnAt) w.update();
  const lines = w.entities.values().filter(e => e.barricade?.slot.groupId === 'l4-line');
  expect(lines).toHaveLength(3);
  for (const e of lines) { expect(e.barricade!.intact).toBe(true); w.hazards!.hit(e.id, 1e6, 'bullet'); }
  w.update();
  expect(m.state.l4!.director.barricades).toBe(3);
  for (const phase of ['war', 'collapse']) {
    if (phase === 'collapse') { m.completeObjective('hold'); w.update(); }
    expect(m.state.l4!.phase).toBe(phase);
    for (const e of lines) {
      expect(e.barricade!.intact).toBe(false); expect(e.interactable!.enabled).toBe(false);
      expect(w.barricades!.playerBuildable(e)).toBe(false);
      const p = w.entities.get(1)!.transform;
      Object.assign(p, { x: e.transform.x, y: .72, z: e.transform.z + 1 }); w.physics.playerBody!.setTranslation(p, true); w.spatial.set(1, p.x, p.z);
      w.setInput({ interact: true }); for (let i = 0; i < 120; i++) w.update(); w.clearInput();
      expect(e.barricade!.intact).toBe(false); expect(e.interactable!.progress).toBe(0);
      expect(w.interactables!.activeId).not.toBe(e.id);
    }
  }
}, 120_000);
