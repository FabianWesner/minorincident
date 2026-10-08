import { boot, expect, test } from './fixtures';
// PO QA: the corgi "runs to the player, but looks at a zombie". The courier walks off, an off-screen infected makes the corgi
// freeze (stiffen) while it is still trotting back to her; the rendered body (tail -> head) must face its travel direction.
for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }]) test(`rendered corgi faces its travel direction while moving with a nearby threat (walk ${dir.x}) @E19 @E19-AC17`, async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__SS__!.loadLevel('L1', { seed: 1, checkpoint: 'bat' }));
  const frames = await page.evaluate(async d => {
    const api = window.__SS__!; api.pause(); await api.step(30);
    const dog = api.query({}).find(e => e.companion)!;
    api.input.set({ move: d }); await api.step(70); api.input.set({ move: { x: 0, z: 0 } });
    const p = api.getEntity(1)!.transform;
    api.spawn('infected.runner', { x: p.x + 16, z: p.z + 4 }, { state: 'idle' });
    const out = [];
    for (let i = 0; i < 150; i++) {
      await api.step(1); const e = api.getEntity(dog.id)!, hero = api.getState().render.npcs!.heroes.find(h => h.id === dog.id)!;
      out.push({ v: { ...e.motion!.velocity }, facing: hero.facing, warn: e.companion!.warn?.stage ?? 'none' });
    }
    return out;
  }, dir);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const moving = frames.filter(f => Math.hypot(f.v.x, f.v.z) > .5);
  expect(frames.some(f => f.warn !== 'none')).toBe(true);
  expect(moving.length).toBeGreaterThan(30);
  for (const f of moving) expect(f.facing).not.toBeNull();
  const worst = Math.max(...moving.map(f => Math.abs(wrap(f.facing! + Math.atan2(f.v.z, f.v.x)))));
  expect(worst * 180 / Math.PI).toBeLessThanOrEqual(20);
});
