import { boot, expect, test } from './fixtures';
import { tick } from './input-helpers';

// Q-196, PO 10-26: "Aim assist seems to be fully broken, no matter if it's on or off. When I play with keyboard, then I need
// some support. Ideally the MP shots at the Zombie that is closes to where I am aiming at (bc I cannot be that precise without
// my mouse). But the heroine is shooting somewhere else, not to the Zombies. Like 45 degree to the other direction, although
// there is a Zombie in front of me."
// Real keys only; the mouse was touched once (as after any menu click) and then rests up-right of the courier.
type Shot = { attackId: number; direction: { x: number; z: number } };
const weapons = [['weapon.army-mg', 8], ['weapon.handgun', 4], ['weapon.shotgun', 2]] as const;

for (const [weapon, minShots] of weapons) for (const setting of ['Default', 'Off'] as const) {
  test(`@E03 @E03-AC05 @E05-AC11 Q-196 keyboard ${weapon} with a resting cursor, assist ${setting}`, async ({ page }) => {
    await boot(page);
    await page.evaluate(async ([id, s]) => {
      const a = window.__SS__!; await a.loadScenario('combat-arena'); a.pause(); a.setLoadout(['weapon.bat'], [id]);
      a.input.set({ selectedSlot: { side: 'RIGHT', index: 0 } }); await a.step(20); a.input.clear(); a.settings.set({ aimAssist: s });
    }, [weapon, setting] as const);
    await page.mouse.move(1150, 250); await tick(page, 2);
    expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('mouse-only');
    await page.keyboard.down('d'); await tick(page, 20); await page.keyboard.up('d'); await tick(page, 20);
    const setup = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform, facing = -p.yaw;
      const at = (degrees: number, distance: number) => a.spawn('infected.dummy', { x: p.x + Math.cos(facing + degrees * Math.PI / 180) * distance, z: p.z + Math.sin(facing + degrees * Math.PI / 180) * distance }, { hp: 1e6 });
      const front = at(12, 8); // inside the cone but off the facing: only assist hits it
      for (const [degrees, distance] of [[30, 5], [-30, 6], [60, 3], [-60, 4]]) at(degrees, distance);
      return { front, facing, start: a.events().length };
    });
    await page.keyboard.down('k'); await tick(page, 75); await page.keyboard.up('k'); await tick(page, 20);
    const result = await page.evaluate(([start, front]) => {
      const events = window.__SS__!.events().slice(start);
      const shots = events.filter(e => e.type === 'combat.attack' && e.sourceId === 1) as unknown as Shot[];
      const hitFront = new Set(events.flatMap(e => e.type === 'combat.hit' && e.targetId === front ? [e.attackId] : []));
      return { shots, hitFront: shots.filter(s => hitFront.has(s.attackId)).length, scheme: window.__SS__!.getState().input.scheme };
    }, [setup.start, setup.front] as const);
    const errors = result.shots.map(s => Math.abs(Math.atan2(Math.sin(Math.atan2(s.direction.z, s.direction.x) - setup.facing), Math.cos(Math.atan2(s.direction.z, s.direction.x) - setup.facing))) * 180 / Math.PI);
    test.info().annotations.push({ type: 'aim', description: `${weapon} ${setting}: ${result.shots.length} shots, ${result.hitFront} on the front zombie, max error ${Math.max(...errors).toFixed(2)}°` });
    expect(result.scheme).toBe('keyboard');
    expect(result.shots.length).toBeGreaterThanOrEqual(minShots);
    if (setting === 'Off') for (const error of errors) expect(error).toBeLessThan(3);
    else expect(result.hitFront / result.shots.length).toBeGreaterThanOrEqual(.9);
    // Touching the mouse again hands aiming back to the cursor.
    await page.mouse.move(1151, 250); await tick(page, 2);
    expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('mouse-only');
  });
}
