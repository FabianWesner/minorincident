import { expect, test } from 'vitest';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
test('@E24 PO31 L6 start headlamp requires collection before its existing beam switches on and survives checkpoint restore', async () => {
  const { world: w, mission: m } = await loadL6();
  try {
    const lamp = w.entities.values().find(e => e.archetype === 'pickup.headlamp')!;
    expect(lamp.pickup).toMatchObject({ item: 'headlamp', collected: false }); expect(m.state.l6!.flashlight).toBe(false);
    const p = w.entities.get(1)!; Object.assign(p.transform, lamp.transform); w.physics.playerBody!.setTranslation(p.transform, true);
    w.update(); expect(m.state.l6!.flashlight).toBe(false);
    lamp.interactable!.completed = true; w.update(); w.update();
    expect(m.state.items).toContain('headlamp'); expect(m.state.l6!.flashlight).toBe(true);
    m.checkpoint('shelter'); m.state.items=[]; m.state.l6!.flashlight=false; m.restore('shelter'); w.update();
    expect(m.state.items).toContain('headlamp'); expect(m.state.l6!.flashlight).toBe(true);
  } finally { w.dispose(); }
});
