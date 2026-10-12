import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { l4Anchors } from '../../../src/data/l4';

/** PO 2026-10-12: "The 1st MP should be the regular gun from L3". L4 starts with melee + the handgun; the machine gun is the army's pickup. */
const output = 'test-results/epics/E22';

test('T-E22-20 @E22 L4 starts with melee and the handgun, no SMG or machine gun; the quartermaster issues the "Machine gun" (own name and icon) and civilians at the table hold guns', async ({ page }) => {
  test.setTimeout(600_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const player = () => page.evaluate(() => window.__SS__!.getState().player!);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  // Ride (real time) until the bus stops.
  for (let i = 0; i < 200 && (await mission()).l4!.phase === 'convoy'; i++) await step(30);
  expect((await mission()).l4!.phase).toBe('plaza');
  const ids = async () => { const w = (await player()).weapons!; return { left: w.LEFT.rack.map(r => r.id), right: w.RIGHT.rack.map(r => r.id) }; };
  let carried = await ids();
  expect(carried.left.length).toBeGreaterThan(0);
  expect(carried.right).toContain('weapon.handgun');
  for (const id of [...carried.left, ...carried.right]) expect(['weapon.smg', 'weapon.hunting-rifle', 'weapon.army-mg']).not.toContain(id);
  // HUD before: the handgun by name, with its own icon.
  await page.keyboard.press('Shift+1'); await step(10);
  const hud = () => page.evaluate(() => ({ name: document.querySelector('[data-testid="action-RIGHT"]')?.textContent ?? '', icon: (document.querySelector('[data-testid="icon-RIGHT"]') as HTMLImageElement | null)?.src ?? '' }));
  const before = await hud();
  expect(before.name).toBe('Handgun');
  await page.screenshot({ path: `${output}/l4-weapons-before.png` });
  // Walk to the army pickup with real input (click to move), then hold E.
  const target = { x: l4Anchors['l4-quartermaster'][0], z: l4Anchors['l4-quartermaster'][1] };
  for (let i = 0; i < 40; i++) {
    const p = (await player()).transform;
    if (Math.hypot(p.x - target.x, p.z - target.z) < .8) break;
    await page.evaluate(({ p, target }) => {
      const a = window.__SS__!, x = (p.x + target.x) / 2, z = (p.z + target.z) / 2, r = Math.max(22, Math.hypot(target.x - p.x, target.z - p.z) + 12);
      a.camera.cinematic({ position: [x + r, r * 1.2, z + r], target: [x, 0, z] }, true);
    }, { p, target });
    await step(1);
    const point = await page.evaluate(q => window.__SS__!.input.project(q), target);
    await page.mouse.click(point.x, point.y); await step(1);
    await page.evaluate(() => window.__SS__!.camera.follow());
    await step(60);
  }
  for (let i = 0; i < 12 && !(await mission()).l4!.gunAt; i++) { await page.keyboard.down('e'); await step(30); await page.keyboard.up('e'); await step(10); }
  expect((await mission()).l4!.gunAt).toBeGreaterThan(0);
  carried = await ids();
  expect(carried.right[0]).toBe('weapon.army-mg');
  expect((await player()).weapons!.selectedSide).toBe('RIGHT');
  await step(10);
  const after = await hud();
  expect(after.name).toBe('Machine gun');
  expect(after.icon).not.toBe(before.icon);
  await page.screenshot({ path: `${output}/l4-weapons-after.png` });
  // The army arms the civilians at the table: at least three of them hold a gun in hand within 14 m of the quartermaster.
  const armed = await page.evaluate(q => window.__SS__!.getState().entities.filter(e => e.civilian && !e.civilian.ally && ['pistol', 'hunting-rifle'].includes(String(e.appearance?.handProp)) && Math.hypot(e.transform.x - q.x, e.transform.z - q.z) < 14).length, target);
  expect(armed).toBeGreaterThanOrEqual(3);
});
