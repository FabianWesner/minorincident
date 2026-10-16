import { expect, test, vi } from 'vitest';
import { PhysicsWireframe } from '../../../src/render/PhysicsWireframe';
import type { Physics } from '../../../src/physics/Physics';
test('PO33 outbreak collider arrivals reuse debug buffers and bound wireframe rebuild cadence', () => {
  let count = 12;
  const debugRender = vi.fn(() => ({ vertices: new Float32Array(count * 3), colors: new Float32Array(count * 4) }));
  const view = new PhysicsWireframe({ world: { debugRender } } as unknown as Physics);
  view.update(0); const initial = view.geometry.getAttribute('position');
  for (let i = 1; i <= 8; i++) { count += 12; view.update(i * 16); }
  expect(debugRender).toHaveBeenCalledTimes(2);
  expect(view.geometry.getAttribute('position')).toBe(initial);
  expect(view.geometry.drawRange.count).toBe(96);
  view.dispose();
});
