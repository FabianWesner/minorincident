import { boot, expect, test } from './fixtures';
import { catalog } from '../../src/data/actions/catalog';

test('T-E06-08c @E06 @E06-AC08 all roster actions attach at either hand across both hero rigs', async ({ page }) => {
  test.setTimeout(180_000); await boot(page);
  await page.evaluate(async () => { await window.__SS__!.loadScenario('combat-arena', { seed: 1 }); window.__SS__!.pause(); });
  for (const variant of ['female', 'male'] as const) for (const def of Object.values(catalog)) {
    const state = await page.evaluate(async ({ id, variant }) => { const api = window.__SS__!; api.survivor.select(variant); api.setLoadout([id], [id]); await api.step(0); return api.getState().render.actions!; }, { id: def.id, variant });
    for (const attachment of state.attachments) {
      expect(attachment.actionId).toBe(def.id); expect(attachment.attached).toBe(true);
      expect(attachment.socket).toBe(attachment.side === 'LEFT' ? 'weaponSocketL' : 'weaponSocketR');
      expect(attachment.handDistance).toBeLessThanOrEqual(0.05); expect(attachment.gripDistance).toBeLessThan(0.0001);
      expect(attachment.sockets).toContain('grip');
      if (def.category === 'ranged') expect(attachment.sockets).toContain('muzzle');
      if (def.category === 'melee') expect(attachment.sockets).toContain('tip');
    }
  }
});

test('T-E06-pickup-view @E06 pickup spawn and walk-over wire through the browser API', async ({ page }) => {
  await boot(page); const result = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('combat-arena', { seed: 1 }); api.pause(); api.setLoadout(['weapon.fists'], ['weapon.kick']);
    const id = api.spawn('weapon.pistol', { x: 1, z: 0 }); api.input.set({ move: { x: 1, z: 0 } }); await api.step(20); api.input.clear();
    return { pickup: api.getEntity(id), rack: api.getState().player!.weapons!.LEFT.rack.map((s) => s.id) };
  });
  expect(result.pickup).toBeNull(); expect(result.rack).toEqual(['weapon.fists', 'weapon.pistol']);
});
