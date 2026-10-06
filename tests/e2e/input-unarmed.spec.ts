import { mkdirSync } from 'node:fs';
import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';
import { menuStart } from './ui-helpers';

test('@E03 @E03-AC19 Shift swings annoy adults harmlessly and pass through children', async ({ page }) => {
  await menuStart(page);
  const ids = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('turning-probe'); a.pause();
    a.setLoadout(['weapon.fists'], ['weapon.fists']);
    return [a.npcs.civilian('cashier', { x: .8, z: -.45 }, { waypoints: [{ x: .8, z: -.45 }] }),
      a.npcs.civilian('cashier', { x: .8, z: .45 }, { child: true, waypoints: [{ x: .8, z: .45 }] })];
  });
  const cursor = await page.evaluate(() => window.__SS__!.input.project({ x: 4, z: 0 }));
  await page.mouse.move(cursor.x, cursor.y); await page.keyboard.down('Shift'); await page.mouse.click(cursor.x, cursor.y);
  await tick(page, 14);
  const entities = await page.evaluate(ids => ids.map(id => window.__SS__!.getEntity(id)!), ids);
  expect(entities[0].civilian!.state).toBe('annoyed'); expect(entities[0].transform.x).toBeGreaterThan(.8);
  expect(entities[1].civilian!.state).toBe('calm'); expect(entities[1].transform.x).toBe(.8);
  expect(entities.map(e => e.health.current)).toEqual([100, 100]);
  await expect(page.getByTestId('civilian-bark')).toBeVisible();
  await expect(page.getByTestId('civilian-bark')).toHaveText('Hey!');
  mkdirSync('test-results/epics/E03', { recursive: true });
  await page.screenshot({ path: 'test-results/epics/E03/civilian-gag.png' });
  const events = await page.evaluate(() => window.__SS__!.events());
  expect(events.filter(e => e.type === 'civilian.bark')).toEqual([expect.objectContaining({ id: ids[0], text: 'Hey!' })]);
  expect(events.some(e => (e.type === 'combat.hit' || e.type === 'combat.kill' || e.type === 'civilian.turned') && ('targetId' in e ? ids.includes(e.targetId) : 'id' in e && ids.includes(Number(e.id))))).toBe(false);
  await page.keyboard.up('Shift'); await tick(page, 100);
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.civilian!.state, ids[0])).toBe('calm');
});

test('@E03 @E03-AC20 seven unarmed moves play through real Shift LMB without moving', async ({ page }) => {
  await menuStart(page);
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.loadLevel('L1', { checkpoint: 'accident' }); a.teleport('player', { x: 70, z: -3 }); a.cheats.god(true); a.setLoadout(['weapon.fists'], ['weapon.fists']); await a.step(90); await a.screenshotReady(); });
  const start = await page.evaluate(() => window.__SS__!.getState().player!.transform);
  const cursor = await page.evaluate(p => window.__SS__!.input.project({ x: p.x + 5, z: p.z }), start);
  await page.mouse.move(cursor.x, cursor.y); await page.keyboard.down('Shift');
  const clips = ['jab', 'cross', 'front-kick', 'uppercut', 'knee', 'roundhouse-kick', 'spinning-backfist'];
  const dir = 'test-results/epics/E03/unarmed'; mkdirSync(dir, { recursive: true });
  for (const move of clips) {
    await page.mouse.down(); await tick(page);
    for (const [label, ticks] of [['anticipation', 1], ['strike', 1], ['contact', 2], ['follow', 4], ['recover', 8]] as const) {
      await tick(page, ticks); await page.evaluate(() => window.__SS__!.screenshotReady());
      expect(await page.evaluate(() => window.__SS__!.getState().render.character!.clip)).toBe(`unarmed-${move}`);
      await page.screenshot({ path: `${dir}/${move}-${label}.png` });
    }
    await page.mouse.up(); await tick(page, 12);
  }
  await page.keyboard.up('Shift');
  const state = await page.evaluate(() => window.__SS__!.getState());
  expect(Math.hypot(state.player!.transform.x - start.x, state.player!.transform.z - start.z)).toBeLessThan(.01);
  expect(state.render.character!.missingClips).toBe(0);
  const attacks = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
  expect(attacks.map(e => e.type === 'combat.attack' && e.combo)).toEqual([0, 1, 2, 4, 5, 3, 6]);
});

test('@E03 @E03-AC21 mouse HUD shows active and next and L1 hints describe switching', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('minor-incident.onboarding.v1', JSON.stringify(['move', 'evade', 'interact', 'pickup'])));
  await menuStart(page);
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.loadLevel('L1', { checkpoint: 'accident' }); a.setLoadout(['weapon.fists'], ['weapon.bat']); });
  await page.mouse.move(800, 450); await tick(page, 1);
  await expect(page.getByTestId('onboarding-prompt')).toBeVisible();
  await expect(page.getByTestId('onboarding-prompt')).toContainText('Shift+LMB in place');
  await expect(page.getByTestId('slot-LEFT')).toContainText('ACTIVE · LMB');
  await expect(page.getByTestId('slot-RIGHT')).toContainText('RMB · NEXT');
  await expect(page.getByTestId('slot-RIGHT')).toContainText('bat');
  await page.mouse.click(800, 450, { button: 'right' }); await tick(page, 20);
  await expect(page.getByTestId('slot-RIGHT')).toContainText('ACTIVE · LMB');
  await expect(page.getByTestId('slot-RIGHT')).toContainText('bat');
  await expect(page.getByTestId('slot-LEFT')).toContainText('unarmed');
  await expect(page.locator('[data-input-hint]')).toContainText('Shift+LMB');
  await expect(page.locator('[data-input-hint]')).toContainText('RMB / Q cycle');
});

test('@E03 @E03-AC15 mouse LMB uses active action even in RIGHT rack', async ({ page }) => {
  await boot(page);
  const id = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause();
    a.setLoadout(['weapon.fists'], ['weapon.bat']); return a.spawn('infected.dummy', { x: 4, z: 0 }, { hp: 1000 });
  });
  const cursor = await page.evaluate(() => window.__SS__!.input.project({ x: 4, z: 0 }));
  await page.mouse.click(cursor.x, cursor.y, { button: 'right' }); await tick(page, 20);
  await page.mouse.click(cursor.x, cursor.y); await tick(page, 130);
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBeLessThan(1000);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'))).toEqual([expect.objectContaining({ side: 'RIGHT', actionId: 'weapon.bat' })]);
});

test('@E03 @E03-AC15 held target death cancels attacks even before LMB release', async ({ page }) => {
  await boot(page);
  const id = await page.evaluate(async () => { const a=window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.bat'], ['weapon.fists']); return a.spawn('infected.dummy', { x: 1, z: 0 }, { hp: 1 }); });
  const cursor = await page.evaluate(() => window.__SS__!.input.project({ x: 1, z: 0 }));
  await page.mouse.move(cursor.x, cursor.y); await page.mouse.down(); await tick(page, 120);
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBe(0);
  expect(await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'))).toHaveLength(1);
  await page.mouse.up();
});

test('@E03 @E03-AC02 queued RMB presses retain one active cycle pulse each', async ({ page }) => {
  await boot(page); await page.mouse.move(800, 450);
  await page.mouse.click(800, 450, { button: 'right' }); await page.mouse.click(800, 450, { button: 'right' });
  for (let i=0; i<2; i++) { const frame = await tick(page); expect(frame.selector).toBe(1); expect(frame.selectorActive).toBe(true); expect(frame.right.down).toBe(false); }
  expect((await tick(page)).selector).toBe(0);
});

test('@E03 @E03-AC05 mouse-mode numbers directly select the unarmed-first carried list', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a=window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.bat'], ['weapon.fists']); });
  await page.mouse.move(800, 450); await page.keyboard.press('1'); await tick(page, 20);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.selectedSide)).toBe('RIGHT');
  await page.keyboard.press('2'); await tick(page, 20);
  expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.selectedSide)).toBe('LEFT');
});
