import { mkdirSync, readFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/**
 * L1 ending: the "Get in!" firefighter at the open bay of Fire Station 3 (Main Row) fights an infected that reaches him, in the
 * game camera (PO 2026-10-08: "I also liked that Zombies can attack him"). Captures only; the rules are tests/levels/l1-firefighter.test.ts.
 */
const output = 'test-results/epics/E19/l1v2';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E19-firefighter-fight @E19 the firefighter swings at an infected at the bay (game camera captures)', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await menuStart(page);
  await page.evaluate(() => window.__SS__!.pause());
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  for (let i = 0; i < 8 && (await mission()).steps.firestation.status !== 'active'; i++) await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  for (let i = 0; i < 20 && (await mission()).l1!.beat; i++) await step(30);
  const door = at('fire-bay-door'), trigger = at('fire-bay-trigger');
  // Courier on the sidewalk 7 m west of the bay mouth, god mode so the fight stays on the firefighter; an infected 3 m outside the bay.
  await page.evaluate(({ x, z }) => { window.__SS__!.cheats.god(true); window.__SS__!.teleport('player', { x, z }); }, { x: door.x - 7, z: door.z + 4.6 });
  await step(60);
  const out = { x: door.x + 0.5, z: door.z + 3.2 }, firefighter = (await mission()).l1!.firefighterId!;
  expect(firefighter).toBeGreaterThan(0);
  await page.evaluate(p => window.__SS__!.spawn('infected.runner', p, { state: 'idle' }), out);
  let fought = false;
  for (let i = 0; i < 12 && !fought; i++) {
    await step(20);
    fought = await page.evaluate(id => window.__SS__!.query({ kind: 'civilian' }).some(e => e.id === id && !!(e.civilian?.ally?.targetId || e.civilian?.ally?.strikeAt)), firefighter);
  }
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/firefighter-fight.png` });
  expect(trigger.x).toBeGreaterThan(0);
  expect(fought, 'the firefighter engaged the infected').toBe(true);
});
