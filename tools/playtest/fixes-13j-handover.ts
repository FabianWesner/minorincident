import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chromium, type Page } from '@playwright/test';
import type { Game } from '../../src/Game';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import type { MissionCheckpoint } from '../../src/sim/missions/types';

export interface HandoverFixture { campaign: CampaignSave; resume: { current: MissionCheckpoint; checkpoint: MissionCheckpoint } }
export const handoverFixturePath = 'docs/reports/fixes-13j/evidence/l6-result-fixture.json.gz';
export const readHandoverFixture = (): HandoverFixture => JSON.parse(gunzipSync(readFileSync(handoverFixturePath)).toString());
export interface HandoverSample { attempt: number; second: number; tick: number; phase: string | undefined; menu: string | null; x: number; z: number; objective: string; deaths: number }

/** The fixture is an actually reached L6 result, not a graph-completion cheat.
 * All navigation, pickup and movement after it crosses physical browser input.
 */
export async function heldHandoverProbe(page: Page, origin: string, fixture: HandoverFixture, sample?: (value: HandoverSample) => Promise<void>): Promise<HandoverSample[]> {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=low`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(() => window.__SS__!.ready);
  const observations: HandoverSample[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.evaluate(async fixture => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.campaign.restore(fixture.campaign);
      await g.loadLevel('L6', { seed: 1, setup: world => world.missions!.loadResume(fixture.resume) });
      a.pause();
      (document.activeElement as HTMLElement)?.blur();
    }, fixture);
    assert.equal(await page.evaluate(() => window.__SS__!.missions.state()?.phase), 'result');
    await page.keyboard.down('KeyA'); await page.keyboard.down('KeyW');
    await page.getByTestId('mission-button').click();
    await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L7' && document.querySelector<HTMLElement>('[data-testid="level-transition"]')?.hidden, null, { timeout: 120_000 });
    // Loading clears gameplay intents. The player next changes direction to collect
    // the nearby launcher, then holds A/W just as in the reported corridor leg.
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
    const rocket = await page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const rig = g.view.view;
      rig.zoom(Math.log(1.5 / rig.getState().targetZoom), true);
      g.view.update(1);
      return window.__SS__!.input.project(g.world.missions!.def.anchors['l7-rocket'], 'destination');
    });
    await page.mouse.click(rocket.x, rocket.y);
    await page.keyboard.down('KeyE');
    await page.waitForFunction(() => window.__SS__!.missions.state()!.steps.rocket.status === 'completed', null, { timeout: 30_000 });
    await page.keyboard.up('KeyE');
    const start = await page.evaluate(() => ({ tick: window.__SS__!.tick(), at: window.__SS__!.getEntity(1)!.transform }));
    await page.keyboard.down('KeyA'); await page.keyboard.down('KeyW');
    let previous = start.tick;
    for (let second = 5; second <= 90; second += 5) {
      await page.waitForTimeout(5_000);
      const state = await page.evaluate(() => {
        const a = window.__SS__!, m = a.missions.state()!, p = a.getEntity(1)!.transform;
        return { tick: a.tick(), phase: m.phase, menu: [...document.querySelectorAll<HTMLElement>('[data-menu-screen]')].find(panel => !panel.hidden)?.dataset.menuScreen ?? null, x: p.x, z: p.z, objective: document.querySelector('[data-testid="objective-text"]')?.textContent ?? '', deaths: m.stats.deaths };
      });
      const observation = { attempt, second, ...state }; observations.push(observation);
      if (sample) await sample(observation);
      assert.equal(state.phase, 'playing', `handover ${attempt}, ${second}s`);
      assert.equal(state.menu, null, `handover ${attempt} opened a menu`);
      assert.ok(state.tick > previous, `handover ${attempt} froze at tick ${previous}`);
      if (second === 5) assert.ok(Math.hypot(state.x - start.at.x, state.z - start.at.z) > .1, 'Physical A/W must move the courier');
      previous = state.tick;
    }
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
  }
  return observations;
}

// Usage under tools/e2e-lock.sh: tsx tools/playtest/fixes-13j-handover.ts <origin> <outDir>
if (process.argv[1]?.endsWith('fixes-13j-handover.ts')) {
  const [origin, destination] = process.argv.slice(2);
  assert.ok(origin && destination, 'Usage: fixes-13j-handover.ts <origin> <outDir>');
  const out = resolve(destination); mkdirSync(out, { recursive: true });
  const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await chromium.launch({ headless: true, args });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const result = await heldHandoverProbe(page, origin, readHandoverFixture(), async observation => {
      appendFileSync(resolve(out, 'observations.jsonl'), JSON.stringify(observation) + '\n');
      if ([15, 90].includes(observation.second)) await page.screenshot({ path: resolve(out, `handover-${observation.attempt}-${observation.second}s.png`) });
      console.log(JSON.stringify(observation));
    });
    writeFileSync(resolve(out, 'summary.json'), JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
}
