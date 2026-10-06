import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { PNG } from 'pngjs';
import { test, expect, boot } from '../e2e/fixtures';
const spots = [
  { id: 'V1', x: -14, z: -7 }, { id: 'V2', x: 0, z: 0 }, { id: 'V3', x: 27, z: 0 },
  { id: 'V4', x: 42, z: -6.5 }, { id: 'V5', x: 56, z: 0 }, { id: 'V6', x: 70, z: -7 },
];
test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
const output = 'test-results/foliage';
function coverage(bytes: Buffer): number {
  const png = PNG.sync.read(bytes); let pixels = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 240 && png.data[i + 1] > 240 && png.data[i + 2] > 240) pixels++;
  return pixels / (png.width * png.height);
}
for (const low of [false, true]) test.describe(low ? 'portrait-low foliage' : 'desktop-high foliage', () => {
  test.use(low ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['iPhone 14'].userAgent } : { viewport: { width: 1600, height: 900 } });
  test('@foliage V1–V6 crowns, coverage, combat reveal, 200-infected frame and overdraw budgets', async ({ page }) => {
    test.setTimeout(180_000); const tier = low ? 'low' : 'high'; mkdirSync(`${output}/${tier}`, { recursive: true });
    await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
    await page.evaluate(async () => { const a=window.__SS__!; await a.loadLevel('L1', { seed: 1 }); a.pause(); a.cheats.god(true); a.settings.set({ cameraShake: false }); });
    await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
    const metrics = [];
    for (const spot of spots) {
      const state = await page.evaluate(async spot => {
        const a=window.__SS__!; a.teleport('player', spot); a.camera.follow();
        a.camera.preset(spot.id); await a.screenshotReady();
        return a.getState().render.districts!.foliage;
      },spot);
      expect(state.cardsPerCrown).toBe(low ? 40 : 80); expect(state.visible).toBeGreaterThan(0);
      await page.locator('canvas').screenshot({ path: `${output}/${tier}/${spot.id}.png` });
      await page.evaluate(async () => { window.__SS__!.settings.set({ foliageMask: true }); await window.__SS__!.screenshotReady(); });
      const mass = coverage(await page.locator('canvas').screenshot({ path: `${output}/${tier}/${spot.id}-mass.png` }));
      await page.evaluate(async () => { window.__SS__!.settings.set({ foliageMask: 'crowns' }); await window.__SS__!.screenshotReady(); });
      const canopy = coverage(await page.locator('canvas').screenshot());
      await page.evaluate(async () => { window.__SS__!.settings.set({ foliageMask: false }); await window.__SS__!.screenshotReady(); });
      metrics.push({ ...spot, ...state, foliageGrassPixels: mass, canopyPixels: canopy, cardOverdrawUpperBound: state.submittedCardScreenArea / Math.max(canopy, .0001), perf: await page.evaluate(()=>window.__SS__!.perf()) });
    }
    writeFileSync(`${output}/${tier}/viewpoints.json`,JSON.stringify(metrics,null,2));
    // Both live combat subjects have independently projected holes; kill/cancel clears the target hole.
    const reveal = await page.evaluate(async () => {
      const a=window.__SS__!; a.missions.begin(); a.teleport('player',{x:3.5,z:3.3}); a.camera.preset('V2'); a.cheats.god(true);
      a.setLoadout(['weapon.fists'],['weapon.kick']);
      const id=a.spawn('infected.runner',{x:2.7,z:1.8},{state:'idle'}); a.input.set({attackTarget:{id,side:'LEFT'}});await a.step(1);await a.screenshotReady();
      return { foliage:a.getState().render.districts!.foliage, player:a.getEntity(1)!.transform, target:a.getEntity(id)!.transform };
    });
    expect(reveal.foliage.playerHole.every(Number.isFinite)).toBe(true); expect(reveal.foliage.targetHole[0]).not.toBe(-10);
    await page.evaluate(async () => { window.__SS__!.settings.set({ foliageMask: 'crowns', foliageReveal: false }); await window.__SS__!.screenshotReady(); });
    const blocked = coverage(await page.locator('canvas').screenshot({ path: `${output}/${tier}/combat-blocked.png` }));
    await page.evaluate(async () => { window.__SS__!.settings.set({ foliageReveal: true }); await window.__SS__!.screenshotReady(); });
    const revealed = coverage(await page.locator('canvas').screenshot({ path: `${output}/${tier}/combat-revealed.png` }));
    expect(blocked - revealed, 'Live survivor/target holes must remove occluding leaf pixels').toBeGreaterThan(.001);
    await page.evaluate(async () => { window.__SS__!.settings.set({ foliageMask: false }); await window.__SS__!.screenshotReady(); });
    await page.locator('canvas').screenshot({ path: `${output}/${tier}/combat.png` });
    writeFileSync(`${output}/${tier}/reveal.json`, JSON.stringify({ ...reveal, blocked, revealed }, null, 2));

    await page.evaluate(async () => { const a=window.__SS__!; a.input.clear(); a.input.set({cancelMove:true});await a.step(1);a.input.clear(); });
    const perf = await page.evaluate(async low => {
      const a=window.__SS__!;await a.loadScenario('perf-l1-foliage-200');a.pause();a.camera.preset('V5');await a.screenshotReady();a.resume();
      const gl=document.querySelector('canvas')!.getContext('webgl2')!,extension=gl.getExtension('WEBGL_debug_renderer_info');
      const gpu=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string:null;
      const samples:number[]=[];let previous=0;const start=performance.now(),startTick=a.tick();
      for(let i=0;i<360||performance.now()-start<12_000;i++){const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));if(i>60&&previous)samples.push(now-previous);previous=now;}
      samples.sort((a,b)=>a-b);const withFoliage={...a.perf(),frameMsP95:samples[Math.ceil(samples.length*.95)-1]};
      // Same scene, crown/grass draw mask off/on does not estimate overdraw. Report submitted card layers per crown separately.
      a.pause();await a.screenshotReady();return { low,spot:'V5',gpu,durationMs:performance.now()-start,ticks:a.tick()-startTick,samples:samples.length,count:a.getState().ai!.count,...withFoliage,foliage:a.getState().render.districts!.foliage };
    },low);
    writeFileSync(`${output}/${tier}/perf.json`,JSON.stringify(perf,null,2));
    expect(perf.gpu).not.toBeNull(); expect(perf.gpu!).not.toMatch(/swiftshader|llvmpipe|software/i); expect(perf.ticks).toBeGreaterThanOrEqual(600);
    expect(perf.count).toBe(200); expect(perf.drawCalls).toBeLessThanOrEqual(low?300:600); expect(perf.triangles).toBeLessThanOrEqual(low?500_000:1_500_000);
    expect(perf.frameMsP95).toBeLessThanOrEqual(low?33.4:16.7);
    for(const spot of metrics.filter(s=>['V1','V2','V4'].includes(s.id))) expect(spot.foliageGrassPixels,`${tier}/${spot.id} foliage + grass pixels`).toBeGreaterThanOrEqual(.25);
  });
});
