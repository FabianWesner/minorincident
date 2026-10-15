import { boot, expect, test } from '../fixtures';
import { catalog, mountedActions } from '../../../src/data/actions/catalog';

/** Weapon audio pass (PO bug 36): every ranged weapon plays its own recorded cue through the real graph; the shotgun racks a pump behind the blast. */
test('T-WEAPON-AUDIO-01 every ranged weapon plays its own cue, the shotgun pumps, the rocket and minigun are audible', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.mouse.click(200, 250);
  const ranged = Object.values({ ...catalog, ...mountedActions }).filter(d => d.category === 'ranged').map(d => d.id);
  const result = await page.evaluate(async (ids) => {
    const a = window.__SS__!;
    await a.loadLevel('L1'); a.missions.begin(); await a.audio.unlock(); a.resume();
    await new Promise(r => setTimeout(r, 4000)); // the lazy weapons bank arrives in the background
    const rows: { id: string; cues: string[]; variants: string[] }[] = [];
    for (const id of ids) {
      a.audio.clearLog();
      a.audio.emit({ type: 'noise', tick: 1, sourceId: 1, actionId: id, position: { x: 0, y: 0, z: 0 }, radius: 25, loudness: 1, kind: 'ranged' } as never);
      await new Promise(r => setTimeout(r, 700));
      const snap = a.audio.snapshot();
      rows.push({ id, cues: snap.cues.map(c => c.cue), variants: snap.cues.map(c => c.variant) });
    }
    return { rows, errors: a.audio.snapshot().errors };
  }, ranged);
  expect(result.errors).toEqual([]);
  for (const row of result.rows) {
    expect(row.cues, row.id).toContain(`action.${row.id}`);
    expect(row.cues.some(c => c.startsWith('tail.')), `${row.id} tail`).toBe(true);
    if (row.id === 'weapon.shotgun') expect(row.cues, 'shotgun pump').toContain('weapon.pump');
    else expect(row.cues, `${row.id} no pump`).not.toContain('weapon.pump');
  }
});

test('T-WEAPON-AUDIO-02 a magazine weapon plays its reload sound when the magazine runs dry', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.mouse.click(200, 250);
  const cues = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadScenario('horde-arena'); a.pause(); await a.audio.unlock(); a.cheats.god(true);
    await new Promise(r => setTimeout(r, 4000)); // the lazy weapons bank arrives in the background
    a.audio.clearLog();
    a.setLoadout(['weapon.pistol'], ['weapon.fists']);
    a.input.set({ move: { x: 0, z: 0 }, left: { down: true, held: true, up: false }, aim: { x: 0, z: -1 } });
    await a.step(400);
    a.input.clear();
    return a.audio.snapshot().cues.map(c => c.cue);
  });
  expect(cues).toContain('action.weapon.pistol');
  expect(cues).toContain('weapon.reload');
});
