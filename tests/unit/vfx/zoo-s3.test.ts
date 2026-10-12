import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { Vfx } from '../../../src/render/vfx/Vfx';
for (const [move, shape, radius] of [['zebra.kick', 10, 2], ['flamingo.dive', 1, 3]] as const) test(`T-E07-19-${move}-cue @E07-AC19 exact rear arc/flock area remains visible with particles/flash/gore off`, async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena');
  const fx = new Vfx(w, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  try {
    fx.set({ flashReduction: true, gore: 'Off', vfx: false });
    const id = w.infected!.spawn(`infected.${move.split('.')[0]}`, { x: 0, z: 0 }, { state: 'idle', yaw: Math.PI / 2 });
    if (move === 'flamingo.dive') for (const z of [-2, 2]) w.infected!.spawn('infected.flamingo', { x: 0, z }, { state: 'idle' });
    expect(w.infected!.startSpecial(id, move, { id: 1, x: 2, z: 0 }, { x: 0, z: 0, radius: 1, dx: 1, dz: 0 })).toBe(true);
    const a = w.entities.get(id)!.infected!.specialAttack!, tell = fx.snapshot().telegraphs.find(t => t.attackId === a.attackId)!;
    const styles = fx.telegraphs.mesh.geometry.getAttribute('fxStyle');
    expect(styles.getY(tell.slot)).toBe(shape); expect(styles.getX(tell.slot)).toBe(radius * 2);
    if (move === 'zebra.kick') { const angle = fx.telegraphs.mesh.geometry.getAttribute('fxMotion').getX(tell.slot); expect(Math.cos(angle)).toBeCloseTo(a.area.dx, 6); expect(Math.sin(angle)).toBeCloseTo(a.area.dz, 6); }
    else { expect(fx.telegraphs.mesh.geometry.getAttribute('fxOrigin').getX(tell.slot)).toBe(2); a.hitIds.push(1); a.obstructionUntil = w.tick + 48; fx.set({ vfx: true }); fx.advance(0); expect(fx.snapshot().obstruction).toEqual({ remainingTicks: 48, opacity: .18 }); fx.set({ flashReduction: false }); fx.advance(0); expect(fx.snapshot().obstruction.opacity).toBe(.35); w.tick += 48; fx.advance(0); expect(fx.snapshot().obstruction.opacity).toBe(0); }
  } finally { fx.dispose(); w.dispose(); }
});
