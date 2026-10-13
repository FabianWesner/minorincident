import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { pcm, rmsDb } from '../../../tools/audio/measure';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';
const root = 'test-results/epics/E32/audio';
for (const tier of ['high', 'low']) test(`T-E32-13-live @E32-AC13 ${tier} actual cue RMS and telegraph voice priority`, async ({ page }) => {
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&scenelab=1`);
  await page.evaluate(async () => { await window.__SS__!.audio.unlock(); window.__SS__!.settings.set({ captions: true }); });
  await page.waitForFunction(() => !!window.__SCENE__);
  const rows: { distance: number; rms: number }[] = [];
  mkdirSync(root, { recursive: true });
  for (const distance of [250, 120, 40]) {
    const spec = JSON.parse(readFileSync(`tests/scenes/catalog/l10-mega-audio-${distance}.json`, 'utf8')) as SceneSpec;
    await page.evaluate(async spec => { await window.__SCENE__!.load(spec); window.__SS__!.audio.clearLog(); await window.__SCENE__!.step(1); }, spec);
    const result = await page.evaluate(async () => {
      const a = window.__SS__!, cues = a.audio.snapshot().cues.filter(c => c.cue === 'mega.roar');
      if (!cues.length) throw new Error('Missing live Mega roar');
      return a.audio.render({ scenario: 'cue-log', duration: 2, cues: cues.map(c => ({ ...c, time: 0 })) });
    });
    const bytes = Buffer.from(result.wav, 'base64'); writeFileSync(`${root}/roar-${tier}-${distance}.wav`, bytes);
    rows.push({ distance, rms: rmsDb(pcm(bytes), 0, 1.5) });
  }
  expect(rows[1].rms - rows[0].rms).toBeGreaterThanOrEqual(6); expect(rows[2].rms - rows[1].rms).toBeGreaterThanOrEqual(6);
  const priority = await page.evaluate(() => {
    const a = window.__SS__!; for (let i=0;i<40;i++) a.audio.play('bed.wind', { loop:true }, i+1000);
    const voice = a.audio.play('mega.charge', { rate:.5, dry:true }, 99);
    return { voice, snapshot:a.audio.snapshot(), caption:document.querySelector('[data-audio-captions]')?.textContent };
  });
  expect(priority.voice).toBeTruthy(); expect(priority.snapshot.voices).toBeLessThanOrEqual(tier === 'low' ? 16 : 32);
  expect(priority.caption).toContain('Mega Alpha charging');
  writeFileSync(`${root}/rms-${tier}.json`, JSON.stringify({ rows, priority }, null, 2));
});

for (const tier of ['high', 'low']) for (const zoom of [1, .5]) test(`T-E32-14-HUD @E32-AC14 ${tier} z${zoom} ring/no exact marker, death and phone`, async ({ page }) => {
  await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&scenelab=1`);
  await page.waitForFunction(() => !!window.__SCENE__);
  for (const distance of [250, 120, 40, 20]) {
    const spec = JSON.parse(readFileSync(`tests/scenes/catalog/l10-mega-audio-${distance}.json`, 'utf8')) as SceneSpec; spec.camera = { mode:'game', target:[0,0], zoom };
    await page.evaluate(async spec => { await window.__SCENE__!.load(spec); await window.__SCENE__!.step(1); }, spec);
    const ring = page.getByTestId('mega-distance-ring'); await expect(ring).toBeVisible();
    await expect(page.getByTestId('mega-distance-label')).toHaveText(`Mega Alpha: ${distance>200?'distant':distance>=80?'approaching':'near'}`);
    expect(await page.locator('[data-testid^="minimap-threat-"]:not([hidden])').count()).toBe(0);
    expect(await ring.getAttribute('data-world-x')).toBe(null);
    const labelBounds = await page.getByTestId('mega-distance-label').boundingBox(), weatherBounds = await page.getByTestId('weather-icon').boundingBox();
    if (weatherBounds) expect(labelBounds!.y + labelBounds!.height).toBeLessThanOrEqual(weatherBounds.y);
    const bounds = await ring.boundingBox(), map = await page.getByTestId('minimap').boundingBox();
    expect(Math.abs(bounds!.x+bounds!.width/2-map!.x-map!.width/2)).toBeLessThan(1);
    mkdirSync(root, {recursive:true}); await page.screenshot({ path:`${root}/hud-${tier}-z${zoom}-${distance}.jpg`, type:'jpeg', quality:82 });
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.body.classList.add('full-ui','touch-ui'));
  for(const distance of [250,120,40]) {
    const spec=JSON.parse(readFileSync(`tests/scenes/catalog/l10-mega-audio-${distance}.json`,'utf8')) as SceneSpec;spec.camera={mode:'game',target:[0,0],zoom};
    await page.evaluate(async spec=>{await window.__SCENE__!.load(spec);await window.__SCENE__!.step(1);},spec);
    const label=page.getByTestId('mega-distance-label');await expect(label).toBeVisible();const bounds=await label.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({path:`${root}/phone-${tier}-z${zoom}-${distance}.jpg`,type:'jpeg',quality:82});
  }
  await page.evaluate(async () => { window.__SS__!.cheats.killAll(); await window.__SCENE__!.step(1); });
  await expect(page.getByTestId('mega-distance-ring')).toBeHidden();
});

test('T-E32-15-instrumental @E32-AC15 standard radio action plays instrumental recording with story captions', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { await window.__SS__!.audio.unlock(); window.__SS__!.settings.set({captions:true}); window.__SS__!.audio.play('cure.recording'); });
  await expect.poll(async () => page.evaluate(() => window.__SS__!.audio.play('cure.recording'))).toBeTruthy();
  const cues = await page.evaluate(() => { const a=window.__SS__!; a.audio.clearLog(); a.audio.emit({ type:'dialogue.line', tick:0, id:'L10.research', text:'Airborne agent. Harmless to healthy humans and animals. Immediately kills infected. Deliver to the dispersal complex.' }); return a.audio.snapshot().cues; });
  expect(cues.map(c=>c.cue)).toEqual(['cure.recording']);
  await expect(page.locator('[data-audio-captions]')).toContainText('dispersal complex');
});

test('@E32-AC13 existing music intensity event releases pursuit pressure into resolution', async ({page})=>{
  await boot(page);await page.evaluate(async()=>{await window.__SS__!.audio.unlock();await window.__SS__!.screenshotReady();await window.__SS__!.step(12);window.__SS__!.audio.emit({type:'music.intensity',tick:0,alerted:0,damage:0,vehicleSpeed:0,phase:'normal',minimum:.25});});
  await expect.poll(()=>page.evaluate(()=>{window.__SS__!.audio.emit({type:'music.intensity',tick:0,alerted:0,damage:0,vehicleSpeed:0,phase:'normal',minimum:.25});return window.__SS__!.audio.snapshot().music.state;})).toBe('tension');
  await page.evaluate(()=>window.__SS__!.audio.emit({type:'music.intensity',tick:0,alerted:0,damage:0,vehicleSpeed:0,phase:'normal',complete:true}));
  await expect.poll(()=>page.evaluate(async()=>{await window.__SS__!.step(6);return window.__SS__!.audio.snapshot().music.state;})).toBe('aftermath');
});
