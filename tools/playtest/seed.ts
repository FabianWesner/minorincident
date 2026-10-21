// Seeds a progressed campaign save (an L<n>-default preset through the game's own campaign API) into a playtest profile,
// so `play.ts --mode continue --entry continue --keep-profile` resumes it from the menu. From visual-qa-13e2.
// usage (under tools/e2e-lock.sh): tsx tools/playtest/seed.ts <origin> <profileDir> <female|male> [L6-default]
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { playtestSave } from './startup';
const [origin, profile, heroine = 'female', presetName = 'L6-default', kind = 'weapons'] = process.argv.slice(2);
const level = presetName.split('-')[0];
const context = await chromium.launchPersistentContext(resolve(profile), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
const page = context.pages()[0] ?? await context.newPage();
await page.goto(`${origin}/?testApi=1&renderer=webgl&dpr=1&audio=muted&quality=low`);
await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
const save = await page.evaluate(async ({ presetName, level }) => {
  const a = window.__SS__!; await a.ready;
  await a.loadLevel(level as 'L6', { seed: 1, progression: presetName as 'L6-default' });
  return a.campaign.state()!;
}, { presetName, level });
const out = await page.evaluate(s => {
  const a = window.__SS__!;
  a.campaign.restore(s); a.campaign.save();
  const x = a.campaign.state()!;
  return { character: x.character, unlocked: x.unlockedLevel, completed: x.completedLevels, racks: x.racks, owned: x.ownedActions };
}, playtestSave(save, heroine as typeof save.character, kind === 'fists' ? 'fists' : 'weapons'));
console.log(JSON.stringify(out, null, 1));
await context.close();
