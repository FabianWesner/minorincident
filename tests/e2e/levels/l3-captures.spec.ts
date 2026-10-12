import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../fixtures';

/** Brief l3-finish visual proof: the real L3 (seed 1, the L3 bot's ordinary inputs, god mode only so the bot reaches every
 * beat) at the game camera, desktop high and phone low: the alarm wave, the on-ramp horde, the army finale and the bus with
 * the waiting survivors (close safe-zone framing). Counts of drawn living infected are written next to the PNGs. */
const dir = 'test-results/epics/E21/captures';
for (const profile of ['desktop', 'phone'] as const) test.describe(profile, () => {
  if (profile === 'phone') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`T-E21-captures @E21 L3 alarm, horde, finale and bus ${profile}`, async ({ page }) => {
    test.setTimeout(900_000); mkdirSync(dir, { recursive: true });
    await page.goto(`/?test=1&renderer=webgl&quality=${profile === 'phone' ? 'low' : 'high'}&audio=muted`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L3', { seed: 1, progression: 'L3-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); });
    const step = async (until: string, max = 400) => { for (let i = 0; i < max && !await page.evaluate(until); i++) await page.evaluate(() => window.__SS__!.step(30)); };
    const report: Record<string, unknown> = {};
    /** Living infected inside the game camera's view. */
    const drawn = () => page.evaluate(() => { const a = window.__SS__!; return a.query({ kind: 'infected' }).filter(e => { if (e.health.current <= 0 || e.hidden) return false; const q = a.camera.project(e.transform.x, e.transform.y + .6, e.transform.z); return Math.abs(q[0]) < 1 && Math.abs(q[1]) < 1 && Math.abs(q[2]) < 1; }).length; });
    /** Step until `until` holds and at least `n` infected are drawn (or `max` steps pass). */
    const stepDrawn = async (until: string, n: number, max: number) => { for (let i = 0; i < max && !(await page.evaluate(until) && await drawn() >= n); i++) await page.evaluate(() => window.__SS__!.step(15)); };
    const shot = async (name: string) => {
      await page.evaluate(async () => { const a = window.__SS__!; a.bot.stop(); a.input.clear(); await a.screenshotReady(); });
      report[name] = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform;
        const drawn = a.query({ kind: 'infected' }).filter(e => { if (e.health.current <= 0 || e.hidden) return false; const q = a.camera.project(e.transform.x, e.transform.y + .6, e.transform.z); return Math.abs(q[0]) < 1 && Math.abs(q[1]) < 1 && Math.abs(q[2]) < 1; }).length;
        return { tick: a.getState().tick, player: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, alive: a.getState().ai!.count, drawn }; });
      await page.locator('canvas').screenshot({ path: `${dir}/l3-${name}-${profile}.png`, scale: 'css' });
      await page.evaluate(() => window.__SS__!.bot.start('complete'));
    };
    await step('window.__SS__.missions.state().l3.attackAt > 0', 400);
    await step('window.__SS__.getState().tick - window.__SS__.missions.state().l3.attackAt >= 360', 40);
    await shot('alarm');
    // The on-ramp horde: the finale packs streaming after the group up the ramp (first frame with 6 drawn, else at x 200).
    await step('window.__SS__.getState().player.transform.x >= 150', 1600);
    await stepDrawn('window.__SS__.getState().player.transform.x >= 150', 6, 200);
    await shot('horde');
    // The finale: a staged pack surging into the army line (rescue camera).
    await step('window.__SS__.getState().player.transform.x >= 196', 1600);
    await stepDrawn('(window.__SS__.missions.state().l3.surgedIds?.length ?? 0) > 0', 8, 2400);
    await shot('finale');
    await step('window.__SS__.missions.state().l3.barrierClosedAt > 0 || window.__SS__.getState().player.transform.x >= 221', 1600);
    await page.evaluate(() => { const a = window.__SS__!; a.bot.stop(); a.input.clear(); a.camera.cinematic({ position: [234, 8, -6], target: [226.3, .8, 3.4] }, true); });
    await page.evaluate(() => window.__SS__!.step(2));
    await shot('bus');
    writeFileSync(`${dir}/l3-captures-${profile}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ profile, report }));
    expect((report.alarm as { drawn: number }).drawn).toBeGreaterThan(0);
  });
});
