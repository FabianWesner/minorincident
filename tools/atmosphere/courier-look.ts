/** Courier night look: L6 + L7 (rocket, horde) x both survivors x zoom, night vs a daylight reference of the same pose.
 * Run under tools/e2e-lock.sh: `sh tools/e2e-lock.sh npx tsx tools/atmosphere/courier-look.ts <phase> <backend>`.
 * Writes crops + full frames + index.json to $LOOK_OUT/<phase>/<backend>; tools/atmosphere/courier-look-sheet.py builds the sheets. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import { courierColourStats, courierFrames, colourFailures, maskLuminance } from '../../tests/visual/courier-colours';

const phase = process.argv[2] ?? 'after', backend = (process.argv[3] ?? 'webgl2') as Backend;
const out = `${process.env.LOOK_OUT ?? 'test-results/courier-look'}/${phase}/${backend}`;
const variants = (process.env.LOOK_VARIANTS ?? 'female,male').split(',') as ('female' | 'male')[];
const spots = (process.env.LOOK_SPOTS ?? 'L5-qa,L6,L6-shaft,L7-rocket,L7-horde').split(',');
/** QA #28 spots (L5 tick 6858, L6 shelter light shaft tick 142) plus the T-E29-14 rocket/horde spots. */
const spotAt: Record<string, { x: number; z: number } | undefined> = { 'L5-qa': { x: 36.46, z: 41.23 }, 'L6-shaft': { x: .33, z: 3.56 }, 'L7-rocket': { x: 273, z: 15 }, 'L7-horde': { x: -48, z: 46 } };
const luminance = (r: number, g: number, b: number) => {
  const c = [r, g, b].map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
const rows: Record<string, unknown>[] = [];
mkdirSync(out, { recursive: true });
/** Crop the courier (mask bbox, padded) from both frames into one side-by-side PNG: daylight | night. */
function crop(day: PNG, night: PNG, mask: PNG, file: string) {
  let x0 = mask.width, y0 = mask.height, x1 = 0, y1 = 0;
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const i = (y * mask.width + x) * 4;
    if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (x1 < x0) return;
  const pad = Math.max(12, Math.round((y1 - y0) * .25)), size = Math.max(x1 - x0, y1 - y0) + 2 * pad;
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2), sx = cx - Math.round(size / 2), sy = cy - Math.round(size / 2);
  const png = new PNG({ width: size * 2, height: size });
  for (const [k, src] of [day, night].entries()) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = sx + x, Y = sy + y, o = (y * size * 2 + k * size + x) * 4;
    if (X < 0 || Y < 0 || X >= src.width || Y >= src.height) { png.data[o + 3] = 255; continue; }
    const i = (Y * src.width + X) * 4; png.data[o] = src.data[i]; png.data[o + 1] = src.data[i + 1]; png.data[o + 2] = src.data[i + 2]; png.data[o + 3] = 255;
  }
  writeFileSync(file, PNG.sync.write(png));
}
try {
  for (const tier of (process.env.LOOK_TIERS ?? 'high,low').split(',') as ('high' | 'low')[]) {
    const s = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 } });
    try {
      await s.open();
      await s.page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility:hidden!important }' });
      let loaded = '';
      for (const spotName of spots) {
        const level = spotName.split('-')[0], at = spotAt[spotName];
        if (loaded !== level) {
          await s.page.evaluate(async ({ level, tier }) => {
            const a = window.__SS__!; await a.loadLevel(level, level === 'L7' ? { seed: 29, progression: 'L7-default' } : { seed: 1 }); a.pause(); a.cheats.god(true); a.settings.set({ quality: tier, cameraShake: false });
          }, { level, tier });
          loaded = level;
        }
        for (const variant of variants) for (const zoom of (process.env.LOOK_ZOOMS ?? '0.5,1,1.5').split(',').map(Number)) {
          const setup = await s.page.evaluate(async ({ at, zoom, variant }) => {
            const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            const player = game.world.entities.get(1)!; player.survivor!.variant = variant;
            if (at) { a.teleport('player', at); a.camera.follow(); await a.step(1); }
            else {
              const dog = [...game.world.entities.iterate()].find(e => e.companion);
              if (dog) a.teleport(dog.id, { x: player.transform.x - 2.8, z: player.transform.z + 1 });
              game.view.view.follow(); game.view.view.pull(0, 0, 0);
            }
            const p = a.getEntity(1)!.transform, rig = game.view.view;
            rig.reset(p); rig.zoom(Math.log(zoom), true); rig.update(p, 0);
            for (let i = 0; i < 4; i++) game.view.update(1);
            await a.screenshotReady();
            const perf = a.perf();
            return { py: p.y, ground: game.world.districts?.groundHeight(p.x, p.z), backend: perf.backend, preset: perf.lighting?.preset, ring: Array.from({ length: 16 }, (_, i) => a.camera.project(p.x + 2 * Math.cos(i * Math.PI / 8), p.y - .7, p.z + 2 * Math.sin(i * Math.PI / 8))) };
          }, { at, zoom, variant });
          const { image, mask, day } = await courierFrames(s.page);
          let sum = 0, pixels = 0, clipped = 0;
          for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); pixels++; if (Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) / 255 >= .97) clipped++; }
          const ringPx = setup.ring.filter(p => Math.abs(p[0]) < .99 && Math.abs(p[1]) < .99).map(p => [Math.round((p[0] + 1) * image.width / 2), Math.round((1 - p[1]) * image.height / 2)]);
          // Ring samples hidden behind her own body (the ground 2 m behind her, under the iso camera) measure her against herself.
          const onCourier = ([x, y]: number[]) => { const i = (y * mask.width + x) * 4; return mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240; };
          const ring = ringPx.filter(p => !onCourier(p)).map(([x, y]) => { const i = (y * image.width + x) * 4; return luminance(image.data[i], image.data[i + 1], image.data[i + 2]); });
          const background = ring.reduce((a, b) => a + b, 0) / ring.length;
          const night = courierColourStats(image, day, mask), daylight = courierColourStats(day, day, mask);
          const name = `${spotName}-${variant}-${tier}-z${zoom}`;
          crop(day, image, mask, `${out}/${name}-crop.png`);
          writeFileSync(`${out}/${name}.png`, PNG.sync.write(image));
          const row = { py: setup.py, ground: setup.ground, name, spot: spotName, variant, tier, zoom, backend: setup.backend, preset: setup.preset, pixels, contrast: (sum / pixels + .05) / (background + .05), subject: sum / pixels, background, ring, ringPx, clippedShare: clipped / pixels, dayLuminance: maskLuminance(day, mask), night, daylight, failures: colourFailures(night, daylight) };
          rows.push(row);
          console.log(`${phase} ${backend} ${name}: contrast ${row.contrast.toFixed(2)} (S ${row.subject.toFixed(3)} / B ${background.toFixed(3)}, day S ${row.dayLuminance.toFixed(3)}), clipped ${(row.clippedShare * 100).toFixed(1)}%, hair ${night.hair.hue.toFixed(0)}deg s${night.hair.saturation.toFixed(2)} (day ${daylight.hair.hue.toFixed(0)}deg s${daylight.hair.saturation.toFixed(2)}, ${daylight.hair.pixels}px), outfit s${night.outfit.saturation.toFixed(2)}/${daylight.outfit.saturation.toFixed(2)} (${daylight.outfit.pixels}px) ${row.failures.join('; ')}`);
        }
      }
      if (s.errors.length) throw new Error(s.errors.join('\n'));
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/index.json`, JSON.stringify(rows, null, 2)); }
