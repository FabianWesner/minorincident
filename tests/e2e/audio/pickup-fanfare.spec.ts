import { boot, expect, test } from '../fixtures';

/** PO 10-13: a weapon pickup plays its own fanfare in the real browser graph, never the old L1 score stinger or the generic pickup tick. */
test('T-PICKUP-FANFARE @E16 weapon pickups play one fanfare each, decoded, without registry errors', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.mouse.click(200, 250);
  const result = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1'); a.missions.begin(); await a.audio.unlock(); a.resume();
    await new Promise(r => setTimeout(r, 4000)); // lazy banks (including pickups) load in the background
    const rows: { id: string; cues: string[] }[] = [];
    for (const id of ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.molotov', 'ability.corgi-lure']) {
      a.audio.emit({ type: 'pickup.collected', tick: a.tick(), sourceId: 1, pickupId: 0, side: 'RIGHT', actionId: id, replaced: null } as never);
      rows.push({ id, cues: a.audio.emitters().map(e => e.cue).filter(c => c.startsWith('pickup.') || c.startsWith('ui.pickup') || c.startsWith('stinger.weapon')) });
      await new Promise(r => setTimeout(r, 2200)); // let the fanfare finish before the next one
    }
    return { rows, errors: a.audio.snapshot().errors };
  });
  expect(result.errors).toEqual([]);
  const expected: Record<string, string> = { 'weapon.bat': 'bat', 'weapon.fire-axe': 'fire-axe', 'weapon.handgun': 'handgun', 'weapon.army-mg': 'army-mg', 'weapon.shotgun': 'shotgun', 'weapon.rocket-launcher': 'rocket', 'weapon.molotov': 'molotov', 'ability.corgi-lure': 'corgi-lure' };
  for (const row of result.rows) expect(row.cues, row.id).toEqual([`pickup.fanfare.${expected[row.id]}`]);
});
