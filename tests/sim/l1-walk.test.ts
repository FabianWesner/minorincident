import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';

async function world(scenario = 'survivor') { const w = new SimWorld(); await w.init(); w.loadScenario(scenario, 1); return w; }
const speed = (w: SimWorld) => { const v = w.entities.get(1)!.survivor!.velocity; return Math.hypot(v.x, v.z); };
const frame = (patch: Partial<InputFrame> & { walk?: boolean }) => ({ ...emptyInput(), ...patch }) as InputFrame;

test('E19 @E19 @E19-AC13 run is the default (4.5 m/s); holding Walk moves at 2.0 m/s; release returns to run within 0.2 s', async () => {
  const w = await world();
  try {
    for (let i = 0; i < 60; i++) { w.applyInput(frame({ move: { x: 1, z: 0 } }), 'keyboard'); w.update(); }
    expect(speed(w)).toBeCloseTo(4.5, 2); expect(w.entities.get(1)!.survivor!.animation).toBe('run');
    for (let i = 0; i < 60; i++) { w.applyInput(frame({ move: { x: 1, z: 0 }, walk: true }), 'keyboard'); w.update(); }
    expect(speed(w)).toBeCloseTo(2, 2); expect(w.entities.get(1)!.survivor!.animation).toBe('walk');
    let ticks = 0;
    while (speed(w) < 4.45 && ticks < 60) { w.applyInput(frame({ move: { x: 1, z: 0 } }), 'keyboard'); w.update(); ticks++; }
    expect(ticks / 60).toBeLessThanOrEqual(.2);
  } finally { w.dispose(); }
});

test('E19 @E19 @E19-AC13 click-to-move runs by default and walks while Walk is held', async () => {
  const w = await world();
  try {
    const peak = (walk: boolean) => { let top = 0; for (let i = 0; i < 90; i++) { w.applyInput(frame({ ...(i === 0 ? { moveTarget: { x: w.entities.get(1)!.transform.x + 12, z: 0 } } : {}), walk }), 'mouse-only'); w.update(); top = Math.max(top, speed(w)); } return top; };
    expect(peak(false)).toBeCloseTo(4.5, 1);
    for (let i = 0; i < 120; i++) w.update();
    expect(peak(true)).toBeCloseTo(2, 1);
  } finally { w.dispose(); }
});
