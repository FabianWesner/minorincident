import { mkdirSync, writeFileSync } from 'node:fs';
import { createRecorder, mountBike, openL1, prepareView } from './shared';

/** Game-camera evidence for the courier figure: idle/walk/stop, click-to-move turns (the PO's
 * input), keyboard run/turn, fast-click fights, hurt and the bike, for skin=1 and skin=0 side by
 * side. Actual L1 renderer, 25° game FOV at an 8 m review radius, every sim pose at 60 Hz,
 * captured at 20 fps. Run through e2e-lock against a Vite server on E2E_PORT.
 *   npx tsx tools/playeranim/fable-capture.ts <out> --tag=before --skin=1 [--variant=female] [--only=turns] */
const args = process.argv.slice(2), out = args.find(a => !a.startsWith('--')) ?? 'test-results/player-anim-fable';
const option = (name: string, fallback: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const tag = option('tag', 'after'), skin = option('skin', '1'), only = option('only', ''), variants = option('variant', 'female,male').split(',') as ('female' | 'male')[];
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
for (const variant of variants) {
  const stem = `${out}/${tag}-skin${skin}-${variant}`;
  const { page, guard, close } = await openL1(skin, { x: -62, z: -2 }, variant);
  try {
    await prepareView(page, 60);
    const { frames, samples, move, scene, encode } = createRecorder(page, { stillPath: (label, tick) => `${stem}-${label}-${tick}.png`, webmPath: name => `${stem}-${name}.webm`, log: (label, ticks) => console.log(tag, 'skin', skin, variant, label, ticks) });
    /** Click-to-move relative to the current facing: `turn` radians from the heading, `distance` metres. */
    const clickRelative = async (turn: number, distance: number) => page.evaluate(({ turn, distance }) => {
      const a = window.__SS__!, p = a.getState().player!.transform, yaw = p.yaw + turn;
      a.input.set({ moveTarget: { x: p.x + Math.cos(yaw) * distance, z: p.z - Math.sin(yaw) * distance } });
    }, { turn, distance });
    const want = (group: string) => !only || only.split(',').includes(group);
    if (want('walk')) {
      await scene('idle', 90); await move(1, 0, true); await scene('walk', 150); await move(); await scene('stop', 60);
      encode('idle-walk-stop');
    }
    if (want('turns')) {
      // The PO's input: click-to-move. Turn 180° from standing, then 90° and 180° while moving.
      await clickRelative(Math.PI, 4); await scene('click-turn180-idle', 90, false, [0, 6, 12, 18, 24, 30, 45]);
      await clickRelative(Math.PI / 2, 4); await scene('click-turn90-move', 75, false, [0, 6, 12, 18, 24, 30]);
      await clickRelative(Math.PI, 4); await scene('click-turn180-move', 75, false, [0, 6, 12, 18, 24, 30]);
      await page.evaluate(() => window.__SS__!.input.set({ cancelMove: true })); await scene('click-stop', 45);
      await page.evaluate(() => window.__SS__!.input.clear());
      encode('click-turns');
    }
    if (want('run')) {
      await move(1); await scene('run', 90); await move(-1); await scene('run-turn180', 75, false, [0, 6, 12, 18, 24, 30, 45]); await move(0, 1); await scene('run-turn90', 60, false, [0, 6, 12, 18, 24, 30]); await move(); await scene('run-stop', 45);
      encode('run-turns');
    }
    if (want('fight')) {
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.fists'], ['weapon.kick']); });
      await scene('unarmed', 240, true);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.bat'], ['weapon.fists']); });
      await scene('bat', 150, true); await scene('fight-recovery', 60);
      encode('fight');
      await page.evaluate(() => { window.__SS__!.input.clear(); window.__SS__!.survivor.damage(1); }); await scene('hurt', 45);
      frames.length = 0;
    }
    if (want('bike')) {
      await mountBike(page);
      await scene('mount', 45);
      await page.evaluate(() => window.__SS__!.teleport('player', { x: -58, z: -2 }));
      await move(1); await scene('ride', 90); await move(); await scene('ride-stop', 60);
      await page.evaluate(async () => { const a = window.__SS__!; a.input.clear(); a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false }); });
      await scene('dismount', 60);
      encode('bike');
    }
    const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
    if (want('fight') && (!events.some(e => e.actionId === 'weapon.fists') || !events.some(e => e.actionId === 'weapon.bat'))) throw new Error('Fast clicks did not produce both attack chains');
    results.push({ variant, skin, tag, errors: guard.errors, attacks: events.length, samples });
    if (guard.errors.length) throw new Error(guard.errors.join('\n'));
  } finally { guard.dispose(); await close(); }
}
writeFileSync(`${out}/${tag}-skin${skin}-capture.json`, JSON.stringify(results));
