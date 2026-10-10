import { mkdirSync, readFileSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { menuStart } from '../ui-helpers';

/**
 * L1 ending: the "Get in!" firefighter at the open bay of Fire Station 3 (Main Row) fights an infected that reaches him, in the
 * game camera (PO 2026-10-08: "I also liked that Zombies can attack him"). Includes night late-arrival survival, entry and a capture; sim rules are tests/levels/l1-firefighter.test.ts.
 */
const output = 'test-results/epics/E19/l1v2';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test('T-E19-firefighter-fight @E19 the firefighter swings at an infected at the bay (game camera captures)', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(output, { recursive: true });
  await menuStart(page);
  await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.settings.set({ timeOfDay: 'night' }); window.__SS__!.cheats.god(true); });
  const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
  const mission = () => page.evaluate(() => window.__SS__!.missions.state()!);
  for (let i = 0; i < 8 && (await mission()).steps.firestation.status !== 'active'; i++) await page.evaluate(() => window.__SS__!.cheats.completeObjective());
  for (let i = 0; i < 20 && (await mission()).l1!.beat; i++) await step(30);
  const door = at('fire-bay-door'), trigger = at('fire-bay-trigger');
  // Infected pressure begins while the courier is still far away; arrive a minute late.
  await step(60);
  const firefighter = (await mission()).l1!.firefighterId!;
  expect(firefighter).toBeGreaterThan(0);
  const post = await page.evaluate(id => window.__SS__!.query({ kind: 'civilian' }).find(e => e.id === id)!.transform, firefighter);
  const out = { x: post.x + .3, z: post.z + 2.5 };
  await page.evaluate(({ out, post }) => {
    for (let i = 0; i < 10; i++) window.__SS__!.spawn('infected.runner', out, { state: 'idle', yaw: -Math.atan2(post.z - out.z, post.x - out.x) });
  }, { out, post });
  for (let i = 0; i < 60; i++) await step(60);
  expect((await mission()).l1!.firefighterId).toBe(firefighter);
  const alive = await page.evaluate(id => window.__SS__!.query({ kind: 'civilian' }).find(e => e.id === id), firefighter);
  expect(alive?.health.current).toBeGreaterThan(0);
  expect(['down', 'rising', 'finished', 'grabbed']).not.toContain(alive?.civilian?.state);
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: door.x - 5, z: door.z + 3.2 });
  await step(5);
  // Fresh arrivals keep visible infected by the invitation while the courier arrives.
  await page.evaluate(post => {
    for (let i = 0; i < 3; i++) window.__SS__!.spawn('infected.runner', { x: post.x + i * .7, z: post.z + 2.5 }, { state: 'idle', yaw: Math.PI / 2 });
  }, alive!.transform);
  let fought = false;
  for (let i = 0; i < 15 && !fought; i++) {
    await step(20);
    fought = await page.evaluate(id => window.__SS__!.events(0).some(e => e.type === 'ally.attack' && (e as { sourceId?: number }).sourceId === id), firefighter);
  }
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/firefighter-fight.png` });
  const invitation = await mission();
  expect(invitation.l1!.say?.text).toBe('Get in!');
  expect(invitation.steps.firestation.status).toBe('active');
  expect(await page.evaluate(() => window.__SS__!.query({ kind: 'infected' }).some(e => e.health.current > 0))).toBe(true);
  // The ordinary level-exit interaction remains available at the truck bay.
  await page.evaluate(trigger => window.__SS__!.teleport('player', trigger), trigger);
  await step(120);
  expect((await mission()).steps.firestation.status).toBe('completed');
  expect(fought, 'the firefighter engaged the infected').toBe(true);
});
