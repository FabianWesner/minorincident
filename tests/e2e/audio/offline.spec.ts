import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from '../fixtures';
import type { AudioRenderRequest } from '../../../src/debug/audioHarness';
import { pcm, rmsDb, centroid, pitch, rt60, loudness, bandEnergy } from '../../../tools/audio/measure';
const root = 'test-results/epics/E16';
async function render(page: import('@playwright/test').Page, request: AudioRenderRequest, name: string) {
    const result = await page.evaluate(req => window.__SS__!.audio.render(req), request), bytes = Buffer.from(result.wav, 'base64');
    mkdirSync(root, { recursive: true });
    writeFileSync(`${root}/${name}.wav`, bytes);
    return { result, pcm: pcm(bytes), path: `${root}/${name}.wav` };
}
function artifact(name: string, data: unknown) { writeFileSync(`${root}/${name}.json`, JSON.stringify(data, null, 2) + '\n'); }
test('T-E16-06 @E16 @E16-AC06 native convolution gives ordered measured RT60 within preset bands', async ({ page }) => {
    await boot(page);
    const rows = [];
    for (const zone of ['street', 'interior-large', 'tunnel'] as const) {
        const r = await render(page, { scenario: 'shot', zone }, `reverb-${zone}`), estimate = rt60(r.pcm);
        rows.push({ zone, estimate, band: r.result.presetBand! });
    }
    artifact('reverb', rows);
    for (const row of rows) {
        expect(row.estimate).toBeGreaterThanOrEqual(row.band[0]);
        expect(row.estimate).toBeLessThanOrEqual(row.band[1]);
    }
    expect(rows[0].estimate).toBeLessThan(rows[1].estimate);
    expect(rows[1].estimate).toBeLessThan(rows[2].estimate);
});
test('T-E16-07 @E16 @E16-AC07 one building reduces measured centroid ≥30% and level 4–8dB', async ({ page }) => {
    await boot(page);
    const clear = await render(page, { scenario: 'occlusion' }, 'occlusion-clear'), wall = await render(page, { scenario: 'occlusion', occluded: true }, 'occlusion-wall');
    const data = { clearCentroid: centroid(clear.pcm), wallCentroid: centroid(wall.pcm), levelLoss: rmsDb(clear.pcm, 0, 0.3) - rmsDb(wall.pcm, 0, 0.3) };
    artifact('occlusion', data);
    expect(data.wallCentroid / data.clearCentroid).toBeLessThanOrEqual(0.7);
    expect(data.levelLoss).toBeGreaterThanOrEqual(4);
    expect(data.levelLoss).toBeLessThanOrEqual(8);
});
test('T-E16-08 @E16 @E16-AC08 15m/s pass-by has a measured 6–12% pitch drop', async ({ page }) => {
    await boot(page);
    const r = await render(page, { scenario: 'doppler' }, 'doppler'), approach = pitch(r.pcm, 0.3, 0.8), departure = pitch(r.pcm, 3.2, 3.7), drop = (approach - departure) / approach;
    artifact('doppler', { approach, departure, drop });
    expect(drop).toBeGreaterThanOrEqual(0.06);
    expect(drop).toBeLessThanOrEqual(0.12);
});
test('T-E16-11 @E16 @E16-AC11 each twist gives one second below −50dBFS then a stinger; L6 dawn reprise', async ({ page }) => {
    await boot(page);
    const rows = [];
    for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
        const r = await render(page, { scenario: 'twist', level }, `twist-${level}`), silence = rmsDb(r.pcm, 0.53, 1.53), stinger = rmsDb(r.pcm, 1.6, 2.3);
        rows.push({ level, silence, stinger });
        expect(silence).toBeLessThanOrEqual(-50);
        expect(stinger).toBeGreaterThan(-40);
        expect(r.result.events).toContainEqual({ cue: 'stinger.twist', time: 1.55 });
        if (level === 'L6')
            expect(r.result.events).toContainEqual({ cue: 'stinger.dawn', time: 2.8 });
    }
    artifact('twists', rows);
});
test('T-E16-13b @E16 @E16-AC13 burnt W5 streets measure at least 10dB quieter than W2', async ({ page }) => {
    await boot(page);
    const normal = await render(page, { scenario: 'ambience', tier: 2 }, 'ambience-W2'), burnt = await render(page, { scenario: 'ambience', tier: 5 }, 'ambience-W5');
    const data = { w2: rmsDb(normal.pcm, 0.1, 2.9), w5: rmsDb(burnt.pcm, 0.1, 2.9) };
    artifact('ambience', data);
    expect(data.w2 - data.w5).toBeGreaterThanOrEqual(10);
});
test('T-E16-14a @E16 @E16-AC14 measured radio and mega duck envelopes respect protected buses', async ({ page }) => {
    await boot(page);
    const rows = [];
    for (const kind of ['radio', 'mega'] as const)
        for (const bus of ['music', 'ambience', 'telegraph', 'dialogue'] as const) {
            const control = await render(page, { scenario: 'duck', bus, kind, ducked: false }, `duck-${kind}-${bus}-control`), duck = await render(page, { scenario: 'duck', bus, kind }, `duck-${kind}-${bus}`);
            const loss = rmsDb(control.pcm, 0.9, 1.4) - rmsDb(duck.pcm, 0.9, 1.4);
            rows.push({ kind, bus, loss });
            const target = kind === 'radio' ? (bus === 'music' ? 8 : bus === 'ambience' ? 6 : 0) : bus === 'telegraph' || bus === 'dialogue' ? 0 : 12;
            expect(loss).toBeGreaterThanOrEqual(target - 1);
            expect(loss).toBeLessThanOrEqual(target + 1);
            if (kind === 'mega')
                expect(Math.abs(rmsDb(control.pcm, 1.7, 2) - rmsDb(duck.pcm, 1.7, 2))).toBeLessThan(1);
        }
    artifact('ducking', rows);
});
test('T-E16-16 @E16 @E16-AC16 60s production graph mix meets EBU R128 loudness, true peak and dialogue dominance', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);
    const mix = await render(page, { scenario: 'audio-mix' }, 'audio-mix'), rest = await render(page, { scenario: 'audio-mix', includeDialogue: false }, 'audio-mix-rest');
    const measured = loudness(mix.path);
    const dominance = [8, 23, 43].map(t => { const total = bandEnergy(mix.pcm, t + 0.2, t + 2.8), background = bandEnergy(rest.pcm, t + 0.2, t + 2.8); return 10 * Math.log10(Math.max(1e-15, total - background) / background); });
    artifact('mix', { ...measured, dominance, voices: mix.result.voices });
    expect(measured.lufs).toBeGreaterThanOrEqual(-18);
    expect(measured.lufs).toBeLessThanOrEqual(-14);
    expect(measured.truePeak).toBeLessThanOrEqual(-1);
    for (const db of dominance)
        expect(db).toBeGreaterThanOrEqual(6);
    expect(mix.result.voices).toBeLessThanOrEqual(32);
});
test('T-E16-17b @E16 @E16-AC17 mono sums both channels to equal output', async ({ page }) => {
    await boot(page);
    const mono = await render(page, { scenario: 'mono', mono: true }, 'mono'), stereo = await render(page, { scenario: 'mono', mono: false }, 'stereo');
    let difference = 0, stereoDiff = 0;
    for (let i = 0; i < mono.pcm.channels[0].length; i++) {
        difference = Math.max(difference, Math.abs(mono.pcm.channels[0][i] - mono.pcm.channels[1][i]));
        stereoDiff += Math.abs(stereo.pcm.channels[0][i] - stereo.pcm.channels[1][i]);
    }
    expect(difference).toBeLessThan(1 / 32768);
    expect(stereoDiff).toBeGreaterThan(1);
});
