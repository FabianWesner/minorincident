import { mkdirSync, writeFileSync } from 'node:fs';
import { createRecorder, mountBike, openL1, prepareView } from './shared';

/** Actual L1 renderer/camera, game angle/FOV at a close review radius, every sim pose evaluated at
 * 60 Hz and captured at 20 fps. Run through e2e-lock, on a dedicated Vite port. */
const out = process.argv[2] ?? 'test-results/player-anim-r1';
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
const bikeOnly = process.argv.includes('--bike-only');
for (const variant of ['female', 'male'] as const) {
  if (process.argv.includes('--female') && variant !== 'female') continue;
  const { page, guard, close } = await openL1('1', { x: -62, z: -2 }, variant);
  try {
    await prepareView(page, 60);
    const { frames, samples, move, scene, encode } = createRecorder(page, { sampleCamera: true, stillPath: (label, tick) => `${out}/game-${variant}-${label}-${tick}.png`, webmPath: name => `${out}/game-${variant}-${name}.webm`, log: (label, ticks) => console.log(variant, label, ticks) });
    if (!bikeOnly) {
      await scene('idle', 90); await move(1, 0, true); await scene('walk', 180); await move(); await scene('stop', 90);
      encode('idle-walk-stop');
      await move(1); await scene('run', 90); await move(-1); await scene('turn180', 75); await move(); await scene('turn-stop', 30);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.fists'], ['weapon.kick']); });
      await scene('unarmed', 240, true);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.bat'], ['weapon.fists']); });
      await scene('bat', 150, true); await scene('fight-recovery', 60);
      encode('run-turn-fight');
      await page.evaluate(() => { window.__SS__!.input.clear(); window.__SS__!.survivor.damage(1); }); await scene('hurt', 45);
      frames.length = 0;
    }
    await mountBike(page);
    await scene('mount', 45);
    // Reposition the already mounted bike into the open street for ride/exit stills.
    await page.evaluate(() => window.__SS__!.teleport('player', { x: -58, z: -2 }));
    await move(1); await scene('ride', 90); await move(); await scene('ride-stop', 60);
    await page.evaluate(async () => { const a = window.__SS__!; a.input.clear(); a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false }); });
    await scene('dismount', 60); frames.length = 0;
    const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
    if (!bikeOnly && (!events.some(e => e.actionId === 'weapon.fists') || !events.some(e => e.actionId === 'weapon.bat'))) throw new Error('Fast clicks did not produce both attack chains');
    results.push({ variant, errors: guard.errors, events, samples });
    if (guard.errors.length) throw new Error(guard.errors.join('\n'));
  } finally { guard.dispose(); await close(); }
}
writeFileSync(`${out}/game-capture.json`, JSON.stringify(results));
