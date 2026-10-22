import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from '../fixtures';

const backends = process.env.L6_READABILITY_BACKEND === 'both' ? ['webgl', 'webgpu'] as const : [process.env.L6_READABILITY_BACKEND === 'webgpu' ? 'webgpu' : 'webgl'] as const;
const luminance = (rgb: number[]) => rgb.map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const backend of backends) for (const tier of ['high', 'low'] as const) test.describe(tier, () => {
  if (tier === 'low') test.use({ viewport: { width: 390, height: 844 } });
  for (const zoom of [.5, 1, 1.5]) for (const [name, spot] of [['l6-shelter-fails', { x: 0, z: -4 }], ['l6-tunnel-retreat', { x: 110, z: 15 }]] as const) {
    test(`T-E24-15-matrix @E24-AC15 ${name} ${backend} ${tier} z${zoom}: player contrast and isolated brightest-body eye`, async ({ page }) => {
      test.setTimeout(300_000);
      const out = `test-results/ac-close/readability/${backend}-${tier}-${name}-z${zoom}`;
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      await boot(page, `/?test=1&scenelab&renderer=${backend}&quality=${tier}&audio=muted&dpr=1`);
      await page.addStyleTag({ content: '#hud,.hud,.mission-ui,.story-bubble,.mission-subtitle,.mission-hud,.objective-hud{visibility:hidden!important}' });
      const setup = await page.evaluate(async ({ spot, zoom }) => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
        await a.loadLevel('L6', { seed: 1, progression: 'L6-default' }); a.pause(); a.missions.begin(); a.cheats.god(true);
        const lamp = a.query({}).find(e => e.archetype === 'pickup.headlamp')!;
        a.teleport(1, lamp.transform); a.input.set({ interact: true }); await a.step(24); a.input.clear();
        a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.teleport(1, spot);
        await a.step(30);
        // Use the shipping follow rig, including portrait framing, and a visible contact-distance threat.
        // The old offset static pose cropped the 3.6 m rear subject at the closest zoom.
        const rig = game.view.view, playerAt = a.getEntity(1)!.transform;
        rig.reset(playerAt); rig.zoom(Math.log(zoom), true); rig.update(playerAt, 0);
        // The landscape rig is vertically tighter; portrait is horizontally tighter.
        // Keep both subjects separate and fully visible at their real closest zoom.
        const subjectOffset = innerWidth < innerHeight ? { x: 0, z: -1.4 } : { x: 1.2, z: -.4 };
        const id = a.spawn('infected.runner', { x: spot.x + subjectOffset.x, z: spot.z + subjectOffset.z }, { state: 'idle', yaw: -Math.PI / 4 });
        a.vfx.stepRender(.3); game.view.probeVisibility({ courier: false, crowd: false, bars: true }); await a.screenshotReady();
        const e = a.getEntity(id)!, p = a.getEntity(1)!.transform;
        const batches = (game.view as unknown as { crowd: { batches: Map<string, { mesh: import('three').InstancedMesh; state: import('three').InterleavedBufferAttribute; tint: import('three').InterleavedBufferAttribute; poses: import('../../../src/render/characters/CrowdPosePalette').CrowdPosePalette; probe: { figures: { id: number }[] } }> } }).crowd.batches;
        const body: number[][] = [], eyes: number[][] = [], triangles: number[][][] = [];
        for (const batch of batches.values()) {
          const slot = batch.probe.figures.findIndex(f => f.id === id); if (slot < 0) continue;
          const instance = batch.mesh.matrix.clone(), part = instance.clone(), point = game.view.camera.position.clone();
          batch.mesh.getMatrixAt(slot, instance);
          const packed = batch.tint.getW(slot), frame = batch.state.getX(slot), geometry = batch.mesh.geometry;
          const positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts'), projected = new Map<number, number[]>();
          const appearance = batch.tint.getX(slot), selected = Math.floor(appearance / 16) % 32, covered = Math.floor(appearance / 512) % 2 === 1;
          for (let i = 0; i < positions.count; i++) {
            // Match crowdHeadwearVisibility: the atlas also contains every unselected hat.
            const flags = parts.getW(i) % 128, accessory = Math.floor(flags / 8);
            if (accessory > 0 ? accessory !== selected : (parts.getY(i) === -2 || flags >= 4) && covered) continue;
            batch.poses.part(frame, Math.floor(packed / 2), packed % 2, parts.getX(i), part);
            point.fromBufferAttribute(positions, i).applyMatrix4(part).applyMatrix4(instance);
            const screen = a.camera.project(point.x, point.y, point.z); body.push(screen); projected.set(i, screen); if (parts.getZ(i) > .5) eyes.push(screen);
          }
          const indices = geometry.index;
          for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
            const triangle = [0, 1, 2].map(k => projected.get(indices ? indices.getX(i + k) : i + k));
            if (triangle.every(p => !!p)) triangles.push(triangle as number[][]);
          }
        }
        const bounds = (points: number[][]) => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
        return { id, subjectOffset, alive: e.health.current > 0, body: bounds(body), eyes: bounds(eyes), triangles, bodyVertices: body.length, eyeVertices: eyes.length,
          ring: Array.from({ length: 16 }, (_, k) => a.camera.project(p.x + 2 * Math.cos(k * Math.PI / 8), p.y - .7, p.z + 2 * Math.sin(k * Math.PI / 8))),
          backend: a.perf().backend, tier: a.perf().quality.tier, lighting: a.perf().lighting, emergency: a.missions.state()!.l6!.emergency, flashlight: a.missions.state()!.l6!.flashlight };
      }, { spot, zoom });
      writeFileSync(`${out}/setup.json`, JSON.stringify(setup, null, 2));
      expect(setup.alive).toBe(true); expect(setup.bodyVertices).toBeGreaterThan(0); expect(setup.eyeVertices).toBeGreaterThan(0);
      expect(setup.backend).toBe(backend); expect(setup.tier).toBe(tier); expect(setup.emergency).toBe(true); expect(setup.flashlight).toBe(true);
      for (const coordinate of [...setup.body, ...setup.eyes]) expect(Math.abs(coordinate), 'readability subject inside viewport').toBeLessThan(.99);
      const image = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/scene.png` }));
      await page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ idPass: true }); await a.screenshotReady(); });
      const mask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/player-mask.png` }));
      await page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
        a.settings.set({ idPass: false }); game.view.probeCrowdMask(true); await a.screenshotReady();
      });
      const infectedMask = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/infected-mask.png` }));
      await page.evaluate(() => (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game.view.probeCrowdMask(false));
      await page.evaluate(async () => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../../src/Game').Game }).game;
        a.settings.set({ idPass: false }); game.view.probeVisibility({ courier: false, crowd: true, bars: true }); await a.screenshotReady();
      });
      const background = PNG.sync.read(await page.locator('canvas').screenshot({ path: `${out}/without-crowd.png` }));
      let playerSum = 0, playerPixels = 0;
      for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { playerSum += luminance([...image.data.subarray(i, i + 3)]); playerPixels++; }
      const ring = setup.ring.flatMap(p => {
        const cx = Math.round((p[0] + 1) * image.width / 2), cy = Math.round((1 - p[1]) * image.height / 2), values: number[] = [];
        for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
          if (x < 0 || y < 0 || x >= image.width || y >= image.height || Math.hypot(x - cx, y - cy) > 5) continue;
          const i = (y * image.width + x) * 4;
          if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) continue;
          values.push(luminance([...image.data.subarray(i, i + 3)]));
        }
        return values.length ? [values.reduce((s, v) => s + v, 0) / values.length] : [];
      });
      const player = playerSum / playerPixels, surrounding = ring.reduce((s, v) => s + v, 0) / ring.length, contrast = (player + .05) / (surrounding + .05);
      // The unchanged whole-body maximum is restricted to pixels that actually
      // disappear with the infected draw, excluding unrelated lamps/survivors.
      const x0 = Math.max(0, Math.floor((setup.body[0] + 1) * image.width / 2) - 3), x1 = Math.min(image.width - 1, Math.ceil((setup.body[2] + 1) * image.width / 2) + 3);
      const y0 = Math.max(0, Math.floor((1 - setup.body[3]) * image.height / 2) - 3), y1 = Math.min(image.height - 1, Math.ceil((1 - setup.body[1]) * image.height / 2) + 3);
      // Restrict the maximum to submitted body triangles, rather than lamps/ground inside its box.
      const pixels = new Set<number>(), cross = (a: number[], b: number[], x: number, y: number) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      for (const triangle of setup.triangles) {
        const p = triangle.map(v => [(v[0] + 1) * image.width / 2, (1 - v[1]) * image.height / 2]);
        const area = cross(p[0], p[1], p[2][0], p[2][1]); if (Math.abs(area) < 1e-6) continue;
        for (let y = Math.max(y0, Math.floor(Math.min(...p.map(v => v[1])))); y <= Math.min(y1, Math.ceil(Math.max(...p.map(v => v[1])))); y++)
          for (let x = Math.max(x0, Math.floor(Math.min(...p.map(v => v[0])))); x <= Math.min(x1, Math.ceil(Math.max(...p.map(v => v[0])))); x++)
            if ([cross(p[0], p[1], x + .5, y + .5), cross(p[1], p[2], x + .5, y + .5), cross(p[2], p[0], x + .5, y + .5)].every(v => v * area >= 0)) pixels.add(y * image.width + x);
      }
      let bodyPixels = 0, brightest = { x: -1, y: -1, rgb: [0, 0, 0], luminance: -1 };
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!pixels.has(y * image.width + x)) continue;
        const i = (y * image.width + x) * 4, rgb = [...image.data.subarray(i, i + 3)];
        if (infectedMask.data[i] <= 240 || infectedMask.data[i + 1] >= 20 || infectedMask.data[i + 2] <= 240 || rgb.every((v, c) => v === background.data[i + c])) continue;
        bodyPixels++; const l = luminance(rgb); if (l > brightest.luminance) brightest = { x, y, rgb, luminance: l };
      }
      const eyeBox = [(setup.eyes[0] + 1) * image.width / 2, (1 - setup.eyes[3]) * image.height / 2, (setup.eyes[2] + 1) * image.width / 2, (1 - setup.eyes[1]) * image.height / 2];
      const redMargin = brightest.rgb[0] - Math.max(brightest.rgb[1], brightest.rgb[2]);
      const hue = ((60 * (brightest.rgb[1] - brightest.rgb[2]) / Math.max(1, Math.max(...brightest.rgb) - Math.min(...brightest.rgb))) % 360 + 360) % 360;
      const proof = { setup, playerPixels, player, surrounding, backgroundSamples: ring.length, contrast, bodyPixels, brightest, eyeBox, redMargin, hue };
      writeFileSync(`${out}/proof.json`, JSON.stringify(proof, null, 2));
      expect(playerPixels).toBeGreaterThan(200); expect(ring.length).toBeGreaterThanOrEqual(6); expect(contrast).toBeGreaterThanOrEqual(3);
      expect(bodyPixels).toBeGreaterThan(20); expect(redMargin).toBeGreaterThanOrEqual(60);
      expect(hue >= 330 || hue <= 20).toBe(true);
      expect(brightest.x).toBeGreaterThanOrEqual(eyeBox[0] - 2); expect(brightest.x).toBeLessThanOrEqual(eyeBox[2] + 2);
      expect(brightest.y).toBeGreaterThanOrEqual(eyeBox[1] - 2); expect(brightest.y).toBeLessThanOrEqual(eyeBox[3] + 2);
      expect(setup.lighting!.heroShadow).toBe(tier === 'high' ? 1 : 0);
    });
  }
});
