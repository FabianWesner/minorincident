import { expect, test } from 'vitest';
import { infectedSpecialMoves } from '../../../src/data/infected';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { Vfx } from '../../../src/render/vfx/Vfx';

for (const move of ['gorilla.grab-throw', 'elephant.charge', 'elephant.swipe'] as const) {
  for (const direction of [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 }]) {
    test(`T-E07-19-${move}-marker-${direction.z} @E07-AC05 @E07-AC19 ground marker aligns with the locked direction under reduced flash/off gore`, async () => {
      const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena');
      const id = w.infected!.spawn(infectedSpecialMoves[move].archetype, { x: 0, z: 0 }, { state: 'idle' });
      const fx = new Vfx(w, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
      try {
        fx.set({ flashReduction: true, gore: 'Off' });
        expect(w.infected!.startSpecial(id, move, { id: 1, x: direction.x * 8, z: direction.z * 8 }, { x: 0, z: 0, radius: 1, dx: direction.x, dz: direction.z })).toBe(true);
        const a = w.entities.get(id)!.infected!.specialAttack!, tell = fx.snapshot().telegraphs.find(t => t.attackId === a.attackId)!;
        const angle = fx.telegraphs.mesh.geometry.getAttribute('fxMotion').getX(tell.slot);
        // FxPool's ground plane rotates its local +X into (cos(angle), sin(angle)).
        expect(Math.cos(angle)).toBeCloseTo(a.area.dx, 6); expect(Math.sin(angle)).toBeCloseTo(a.area.dz, 6);
        if (move === 'gorilla.grab-throw') {
          const half = fx.telegraphs.mesh.geometry.getAttribute('fxStyle').getX(tell.slot) / 2;
          expect(fx.telegraphs.mesh.geometry.getAttribute('fxOrigin').getX(tell.slot) + Math.cos(angle) * half).toBeCloseTo(a.target.x, 6);
          expect(fx.telegraphs.mesh.geometry.getAttribute('fxOrigin').getZ(tell.slot) + Math.sin(angle) * half).toBeCloseTo(a.target.z, 6);
        }
        expect(fx.telegraphs.count).toBe(1);
      } finally { fx.dispose(); w.dispose(); }
    });
  }
}
