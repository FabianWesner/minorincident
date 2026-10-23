import { chromium } from '@playwright/test';
import type { Game } from '../../src/Game';
/** Q-132 probe: lists large thin visible meshes near the L9 dry-stretch station (x -60, z -30). Not a gate. */
const [origin, renderer, quality] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', ...(renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.goto(`${origin}/?test=1&scenelab=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async q => { const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: q }); await a.loadLevel('L9', { seed: 31 }); a.pause(); }, quality as 'low' | 'high');
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  await page.evaluate(({ x, z }) => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
    car.physics.body.setTranslation({ x, y: 1, z }, true);
  }, { x: -60, z: -30 });
  await page.evaluate(async () => { await window.__SS__!.step(60); });
  const hide = process.env.HIDE?.split(',') ?? [];
  await page.evaluate(async hide => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view.view;
    view.follow(); view.zoom(Math.log(1.5 / view.getState().targetZoom), true); for (let i = 0; i < 40; i++) game.view.advance(1 / 30);
    game.view.scene.traverse((o: any) => { if (hide.includes(o.name) || hide.includes(o.material?.name)) o.visible = false; });
    await window.__SS__!.step(2); await window.__SS__!.screenshotReady();
  }, hide);
  await page.screenshot({ path: `${process.env.OUT ?? 'test-results/streak'}.png` });
  const rows = await page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, out: unknown[] = [];
    const stack: [any, number][] = [[game.view.scene, 0]];
    while (stack.length) { const [o, depth] = stack.pop()!; if (depth > 2) continue; out.push(depth + ' ' + o.type + ' "' + o.name + '" kids=' + o.children.length + ' vis=' + o.visible); for (const c of o.children.slice(0, 40).reverse()) stack.push([c, depth + 1]); }
    return out;
  });
  console.log(rows.join('\n'));

} finally { await browser.close(); }
