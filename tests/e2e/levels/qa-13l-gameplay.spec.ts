import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';
import { collapseProof, companionBoardingProof, headlampProof, busSearchProof, consoleDamageProof, mergeClearanceProof } from '../../../tools/playtest/fixes-13l-gameplay';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'off' });
const url = '/?test=poses&testApi=1&scenelab=1&renderer=webgl&quality=low&dpr=1&audio=muted&ui=1';

test('Q-136 real throttle input keeps all six wheels and the APC hull together throughout the fall', async ({ page }) => {
  test.setTimeout(180_000); await boot(page, url);
  const samples = await collapseProof(page); expect(samples).toHaveLength(120);
  for (const sample of samples) {
    expect(sample.phase).toBe('fall'); expect(sample.wheels).toHaveLength(6);
    expect(Math.abs(sample.drawnY - sample.simY), JSON.stringify(sample)).toBeLessThan(.002);
    for (const wheel of sample.wheels) expect(Math.abs(wheel.y - wheel.expected), JSON.stringify(sample)).toBeLessThan(.002);
  }
});

test('Q-137 real throttle input never shows the companion inside the moving APC hull', async ({ page }) => {
  test.setTimeout(180_000); await boot(page, url);
  const samples = await companionBoardingProof(page);
  expect(samples.every(s => s.hidden && s.aboard !== undefined), JSON.stringify(samples.filter(s => !s.hidden))).toBe(true);
});

test('Q-138 physical walking leaves the E-only headlamp at its station; physical E still collects it', async ({ page }) => {
  test.setTimeout(180_000); await boot(page, url);
  const proof = await headlampProof(page);
  expect(proof.away.lamp.x).toBe(proof.lamp.x); expect(proof.away.lamp.z).toBe(proof.lamp.z);
  expect(proof.away.item).toBe(false); expect(proof.away.fetched).toBeNull(); expect(proof.collected).toBe(true);
});

test('Q-140 at zoom 1.5 the bus search ring draws clearly and ordinary click/E rescues Sam', async ({ page }) => {
  test.setTimeout(180_000); await boot(page, url);
  const proof = await busSearchProof(page), hidden = PNG.sync.read(proof.hidden);
  const changed = (buffer: Buffer) => {
    const drawn = PNG.sync.read(buffer); let pixels = 0;
    for (let i = 0; i < drawn.data.length; i += 4) if (Math.abs(drawn.data[i] - hidden.data[i]) + Math.abs(drawn.data[i + 1] - hidden.data[i + 1]) + Math.abs(drawn.data[i + 2] - hidden.data[i + 2]) > 30) pixels++;
    return pixels;
  };
  const actual = changed(proof.actual), full = changed(proof.full), ratio = actual / full;
  writeFileSync('test-results/playtest/fixes-13l-gameplay/Q-140.json', JSON.stringify({ ...proof.state, actual, full, ratio }, null, 2));
  expect(proof.state.zoom).toBe(1.5); expect(actual).toBeGreaterThan(100); expect(ratio).toBeGreaterThan(.6);
  expect(proof.state.status).toBe('following');
});

test('Q-149 ordinary console infected takes damage during 8 seconds of real aimed attacks', async ({ page }) => {
  test.setTimeout(240_000); await boot(page, url);
  const samples = await consoleDamageProof(page);
  for (const sample of samples) { expect(sample.aim.x).toBeGreaterThan(0); expect(sample.aim.x).toBeLessThan(1280); expect(sample.aim.y).toBeGreaterThan(0); expect(sample.aim.y).toBeLessThan(720); expect(sample.hold).toBe('active'); expect(sample.charge).toBeGreaterThan(0); expect(sample.hp, JSON.stringify(sample)).toBeLessThan(sample.initial); }
});

test('Q-139 real forward input escapes the reported debug-entry merge stop', async ({ page }) => {
  test.setTimeout(180_000); await boot(page, url);
  const samples = await mergeClearanceProof(page); expect(samples.at(-1)!.x, JSON.stringify(samples)).toBeGreaterThan(447);
});
