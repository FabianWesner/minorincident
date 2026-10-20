import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

/**
 * L7 start-position probe (playtest-all, 10-20): where does the courier stand when L7 starts via
 *  a) the L6 → L7 handover after the L6 objectives are completed with the debug cheat,
 *  b) menu Continue at L7 (reload, Start game, resume level),
 *  c) the ?debug=1 level select straight into L7 from a new game.
 * Usage (under tools/e2e-lock.sh): tsx tools/playtest/probe-l7.ts <origin> <outDir>
 */
const [origin, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const url = `${origin}/?testApi=1&renderer=webgl&dpr=1&audio=muted&quality=low&debug=1`;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const state = (page: Page) => page.evaluate(() => {
  const a = window.__SS__!, m = a.missions.state(), p = a.getEntity(1)?.transform;
  return { level: m?.id, phase: m?.phase, checkpoint: m?.checkpoint, tick: a.tick(), player: p ? { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } : null };
});
async function boot(profile: string) {
  rmSync(profile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profile, { headless: true, args, viewport: { width: 1280, height: 720 } });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(url); await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
  return { context, page };
}
async function startFromMenu(page: Page, level: string) {
  await page.getByTestId('start-game').click(); await wait(400);
  if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
  await page.getByTestId(`level-${level}`).click({ force: true });
}
async function untilL7(page: Page, label: string) {
  for (let i = 0; i < 600; i++) {
    const s = await state(page).catch(() => null);
    if (s?.level === 'L7' && (s.phase === 'playing' || s.phase === 'briefing')) {
      if (s.phase === 'briefing') { await page.getByTestId('mission-button').click({ timeout: 2000 }).catch(() => undefined); await wait(300); continue; }
      await wait(8000); const after = await state(page);
      await page.screenshot({ path: join(out, `${label}.jpg`), type: 'jpeg', quality: 70 });
      console.log(JSON.stringify({ case: label, first: s, after1500ms: after })); return;
    }
    await wait(200);
  }
  console.log(JSON.stringify({ case: label, error: 'L7 never started', last: await state(page).catch(() => null) }));
}
// a) and b): L6 via the debug level select, cheat-complete it, real Continue into L7; then reload and resume.
{
  const profile = join(out, 'profile-ab'), { context, page } = await boot(profile);
  await startFromMenu(page, 'L6');
  for (let i = 0; i < 900; i++) {
    const s = await state(page).catch(() => null);
    if (s?.level === 'L7') break;
    if (s?.level === 'L6' && s.phase === 'briefing') await page.getByTestId('mission-button').click({ timeout: 2000 }).catch(() => undefined);
    else if (s?.level === 'L6' && s.phase === 'playing') await page.evaluate(() => { try { window.__SS__!.cheats.completeObjective(); } catch { /* scripted gap without an active objective */ } });
    else if (s?.level === 'L6' && s.phase === 'result') await page.getByTestId('mission-button').click({ timeout: 2000 }).catch(() => undefined);
    await wait(300);
  }
  await untilL7(page, 'a-handover-after-cheat');
  await page.goto(url); await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
  await startFromMenu(page, 'L7');
  await untilL7(page, 'b-menu-continue');
  await context.close(); rmSync(profile, { recursive: true, force: true });
}
// c) new game, debug level select straight to L7.
{
  const profile = join(out, 'profile-c'), { context, page } = await boot(profile);
  await startFromMenu(page, 'L7');
  await untilL7(page, 'c-debug-select');
  await context.close(); rmSync(profile, { recursive: true, force: true });
}
process.exit(0);
