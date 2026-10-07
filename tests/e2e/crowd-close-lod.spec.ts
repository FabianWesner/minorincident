import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test, testUrl } from './fixtures';

// P1 guard (PROD "this guy looks terrible"): pedestrians at the game camera and in close-up were drawn from the authored
// far silhouette (LOD2, ~1.8k triangles over ~60 rigid parts: kite torso, floating shoulders and pockets, faceted). The
// low tier forced LOD2 for everyone and high used it below 160 CSS px, which is the default game-camera figure size.
// Every civilian look (and turned pedestrians, which keep their look) must use the near tier at game-camera size and
// closer, on both backends and both quality tiers. Stills land in test-results/epics/E18/crowd-close-lod.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) {
  test(`P1 crowd-close-lod ${renderer} ${quality} @E18 civilian looks at game camera and close-up use the near detail tier`, async ({ page }) => {
    test.setTimeout(150_000);
    if (renderer === 'webgpu') {
      await page.goto('/');
      const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
      test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    }
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`).replace('quality=high', `quality=${quality}`));
    const looks = await page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow();
      const player = a.query({ kind: 'player' })[0].transform, chosen = new Map<string, number>();
      for (const c of a.query({ kind: 'civilian' })) if (c.civilian?.model?.startsWith('npc.civilian-') && !c.hidden && !c.civilian.pet && c.civilian.state === 'calm' && !chosen.has(c.civilian.model)) chosen.set(c.civilian.model, c.id);
      [...chosen.values()].forEach((id, i) => a.teleport(id, { x: player.x - 3 + (i % 4) * 1.6, z: player.z + 2 + Math.floor(i / 4) * 2 }));
      await a.step(20); await a.screenshotReady();
      return [...chosen].map(([model, id]) => ({ model, id }));
    });
    const dir = 'test-results/epics/E18/crowd-close-lod'; mkdirSync(dir, { recursive: true });
    await page.locator('canvas').screenshot({ path: `${dir}/${renderer}-${quality}-game.png` });
    const sample = (ids: number[]) => page.evaluate((ids) => {
      const a = window.__SS__!, figures = a.crowdFigures();
      return ids.map(id => {
        const t = a.query({ kind: 'civilian' }).find(e => e.id === id)!.transform;
        const head = a.camera.project(t.x, t.y + 1.1, t.z), feet = a.camera.project(t.x, t.y - .7, t.z);
        const figure = figures.find(f => f.id === id);
        return { id, pixels: Math.round((head[1] - feet[1]) / 2 * innerHeight), onScreen: Math.abs(head[0]) < 1 && Math.abs(feet[1]) < 1, lod: figure?.lod, drawn: figure?.drawn ?? false };
      });
    }, ids);
    const game = await sample(looks.map(l => l.id));
    const close: typeof game = [];
    for (const look of looks) {
      await page.evaluate(async (id) => {
        const a = window.__SS__!, t = a.query({ kind: 'civilian' }).find(e => e.id === id)!.transform;
        a.camera.cinematic({ position: [t.x - 2.2, t.y + 1.8, t.z - 2.2], target: [t.x, t.y + .2, t.z] }, true); await a.step(1); await a.screenshotReady();
      }, look.id);
      close.push(...await sample([look.id]));
      await page.screenshot({ path: `${dir}/${renderer}-${quality}-${look.model}.png`, clip: { x: 500, y: 150, width: 600, height: 600 } });
    }
    writeFileSync(`${dir}/${renderer}-${quality}.json`, JSON.stringify({ looks, game, close }, null, 2) + '\n');
    expect(looks.map(l => l.model).sort(), 'every civilian look in the L1 start crowd').toEqual(expect.arrayContaining(['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly']));
    // Game camera: every on-screen figure at game-camera size draws the near tier.
    const gameSized = game.filter(f => f.onScreen && f.pixels >= 105);
    expect(gameSized.length, 'figures at game-camera size').toBeGreaterThanOrEqual(3);
    for (const figure of gameSized) expect(figure, `figure ${figure.id} at ${figure.pixels} px`).toMatchObject({ drawn: true, lod: 'lod1' });
    for (const figure of close) expect(figure, `close-up of ${figure.id}`).toMatchObject({ drawn: true, lod: 'lod1' });
  });
}
