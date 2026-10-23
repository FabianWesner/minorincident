// Seeds a progressed campaign save (an L<n>-default preset through the game's own campaign API) into a playtest profile,
// so `play.ts --mode continue --entry continue --keep-profile` resumes it from the menu. From visual-qa-13e2.
// usage (under tools/e2e-lock.sh): tsx tools/playtest/seed.ts <origin> <profileDir> <female|male> [L6-default] [weapons|fists] [checkpoint] [anchor]
import { launchProfile } from '../browser-pool/client';
import { resolve } from 'node:path';
import { playtestSave } from './startup';
import { cure } from '../../src/levels/L10/district';
import type { Game } from '../../src/Game';
const [origin, profile, heroine = 'female', presetName = 'L6-default', kind = 'weapons', checkpoint, anchor] = process.argv.slice(2);
const level = presetName.split('-')[0];
const at = checkpoint && level === 'L10' ? cure.anchors[anchor ?? checkpoint] : undefined;
if (anchor && !at) throw new Error(`Unknown diagnostic seed anchor ${anchor}`);
const context = await launchProfile(resolve(profile), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`${origin}/?testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=low`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
  const save = await page.evaluate(async ({ presetName, level, checkpoint, at }) => {
    const a = window.__SS__!; await a.ready;
    await a.loadLevel(level as 'L6', { seed: 1, progression: presetName as 'L6-default', checkpoint });
    if (at) {
      a.pause(); a.teleport('player', { x: at[0], z: at[1] });
      await a.step(2);
      // A late-region fixture has already passed the ordinary 90-second boss
      // introduction. Seed its existing pursuit near this fixture, rather than
      // leaving a not-yet-introduced boss at the campaign's distant crash start.
      (window.__SCENE__ as unknown as { game: Game }).game.world.megaPursuit!.introduce({ x: at[0] - 80, z: at[1] });
      a.campaign.save();
    }
    return a.campaign.state()!;
  }, { presetName, level, checkpoint, at });
  const out = await page.evaluate(s => {
    const a = window.__SS__!;
    a.campaign.restore(s); a.campaign.save();
    const x = a.campaign.state()!;
    return { character: x.character, unlocked: x.unlockedLevel, completed: x.completedLevels, racks: x.racks, owned: x.ownedActions };
  }, playtestSave(save, heroine as typeof save.character, kind === 'fists' ? 'fists' : 'weapons'));
  console.log(JSON.stringify(out, null, 1));
} finally { await context.close(); }
