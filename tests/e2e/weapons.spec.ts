import { boot, expect, test } from './fixtures';
import { catalog } from '../../src/data/actions/catalog';

test('T-E06-08c @E06 @E06-AC08 all roster actions attach to the dominant hand when either slot is selected across both hero rigs', async ({ page }) => {
  test.setTimeout(180_000); await boot(page);
  await page.evaluate(async () => { await window.__SS__!.loadScenario('combat-arena', { seed: 1 }); window.__SS__!.pause(); });
  for (const variant of ['female', 'male'] as const) for (const def of Object.values(catalog)) for (const selected of ['LEFT', 'RIGHT'] as const) {
    await page.evaluate(async ({ id, variant, selected }) => { const api = window.__SS__!; api.survivor.select(variant); api.setLoadout([id], [id]); api.input.set({ selectorSide: selected }); await api.step(1); api.input.clear(); }, { id: def.id, variant, selected });
    // Models stream on first equip. Keep the attachment assertions strict after
    // the replacement arrives; an old model must not stand in for this weapon.
    await expect.poll(async () => page.evaluate(async id => { await window.__SS__!.step(1); return window.__SS__!.getState().render.actions!.attachments.every(a => a.actionId === id); }, def.id)).toBe(true);
    const state = await page.evaluate(() => window.__SS__!.getState().render.actions!);
    for (const attachment of state.attachments) {
      expect(attachment.actionId).toBe(def.id); expect(attachment.iconUrl).toMatch(/^(data:image\/svg\+xml|\/assets\/)/); if (attachment.side === selected) expect(attachment.attached).toBe(true);
      // Only the selected side may draw a prop; the other hand stays empty.
      if (attachment.side !== selected) expect(attachment.visible).toBe(false);
      expect(attachment.socket).toBe('weaponSocketR'); expect(attachment.holstered).toBe(attachment.side !== selected);
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
