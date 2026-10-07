import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { menuUrl } from '../ui-helpers';
import { pcm, rmsDb, loudness } from '../../../tools/audio/measure';

const previewRoot = process.env.AUDIO_PREVIEW_DIR ?? 'test-results/audio-preview';
interface Capture { start(): void; stop(): { wav: string; time: number; duration: number }; }
declare global { interface Window { __audioCapture: Capture; } }

test('@E16 recorded L1 accident incident and bat fight: live PCM tap, streaming, mix and stinger timing', async ({ page }) => {
    test.setTimeout(180000);
    mkdirSync(previewRoot, { recursive: true });
    await page.addInitScript(() => {
        const connect = AudioNode.prototype.connect as unknown as (this: AudioNode, destination: AudioNode, output?: number, input?: number) => AudioNode;
        let active = false, context: AudioContext, first = 0;
        let chunks: Float32Array[][] = [];
        // Intercept the final production output. Tap PCM and route only silence to the OS.
        Object.defineProperty(AudioNode.prototype, 'connect', { value: function(this: AudioNode, destination: AudioNode, output?: number, input?: number) {
            if (destination === this.context.destination && !context && this.context instanceof AudioContext) {
                context = this.context;
                const tap = context.createScriptProcessor(4096, 2, 2), silent = context.createGain();
                silent.gain.value = 0;
                tap.onaudioprocess = event => {
                    if (!active) return;
                    if (!chunks.length) first = event.playbackTime;
                    chunks.push([event.inputBuffer.getChannelData(0).slice(), event.inputBuffer.getChannelData(1).slice()]);
                };
                connect.call(this, tap); connect.call(tap, silent); connect.call(silent, destination);
                return tap;
            }
            return connect.call(this, destination, output, input);
        } });
        window.__audioCapture = {
            start() { chunks = []; active = true; },
            stop() {
                active = false;
                const frames = chunks.reduce((n, c) => n + c[0].length, 0), bytes = new Uint8Array(44 + frames * 4), view = new DataView(bytes.buffer);
                const word = (at: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };
                word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
                view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
                view.setUint32(24, context.sampleRate, true); view.setUint32(28, context.sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
                word(36, 'data'); view.setUint32(40, frames * 4, true);
                let frame = 0;
                for (const chunk of chunks) for (let i = 0; i < chunk[0].length; i++, frame++) for (let c = 0; c < 2; c++)
                    view.setInt16(44 + (frame * 2 + c) * 2, Math.max(-32768, Math.min(32767, Math.round(chunk[c][i] * 32767))), true);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
                chunks = [];
                return { wav: btoa(binary), time: first, duration: frames / context.sampleRate };
            },
        };
    });
    const requests: string[] = [];
    page.on('request', r => { if (r.url().includes('/score-')) requests.push(r.url()); });
    await page.goto(menuUrl.replace('audio=muted', 'audio=capture'));
    await expect(page.getByTestId('menu-title')).toBeVisible();
    expect(requests).toEqual([]); // No music download before the first gesture.
    await page.getByTestId('start-game').click();
    await page.getByTestId('character-female').click();
    await page.getByTestId('level-L1').click();
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { window.__SS__!.cheats.god(true); window.__SS__!.resume(); });
    const firstTick = await page.evaluate(() => window.__SS__!.tick());
    await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(firstTick + 30);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.streamed.state)).toBe('calm');
    const measurements: unknown[] = [];
    const stop = async (name: string) => {
        const capture = await page.evaluate(() => window.__audioCapture.stop()), bytes = Buffer.from(capture.wav, 'base64'), path = join(previewRoot, `${name}.wav`);
        writeFileSync(path, bytes);
        const data = pcm(bytes), measured = loudness(path);
        let peak = 0, clipped = 0, gap = 0, longestGap = 0;
        for (let i = 0; i < data.channels[0].length; i++) for (const channel of data.channels) {
            peak = Math.max(peak, Math.abs(channel[i]));
            if (Math.abs(channel[i]) >= 0.999) clipped++;
        }
        // 100ms windows: report sustained silence, excluding capture startup.
        for (let t = 0.7; t + 0.1 < capture.duration; t += 0.1) {
            gap = rmsDb(data, t, t + 0.1) < -60 ? gap + 0.1 : 0;
            longestGap = Math.max(longestGap, gap);
        }
        const audio = await page.evaluate(() => window.__SS__!.audio.snapshot());
        const mission = await page.evaluate(() => ({ state: window.__SS__!.missions.state(), player: window.__SS__!.getState().player!.transform, tick: window.__SS__!.tick() }));
        measurements.push({ name, path, duration: capture.duration, audioStart: capture.time, ...measured, peak, clipped, longestGap, music: audio.music, cues: audio.cues, mission });
        writeFileSync(join(previewRoot, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
        expect(capture.duration).toBeGreaterThan(6);
        expect(clipped).toBe(0);
        expect(measured.truePeak).toBeLessThanOrEqual(-1);
        expect(longestGap).toBeLessThan(0.3);
        expect(audio.errors).toEqual([]);
        return { audio, capture };
    };
    await page.evaluate(() => window.__audioCapture.start());
    await page.waitForTimeout(8000);
    await stop('01-morning');
    // L1 v2 has no diner: the incident is the accident at the Medical Annex. Start from the authored accident checkpoint
    // (exit of the first infected); the escape objective, recorded stinger, screams and chaos layer are all real.
    await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.loadLevel('L1', { checkpoint: 'accident' }); a.cheats.god(true); await a.audio.unlock(); a.audio.clearLog(); window.__audioCapture.start(); a.resume(); });
    await page.waitForTimeout(24000);
    const incident = await stop('02-accident-incident');
    // The checkpoint restores the escape objective, whose recorded objective stinger marks the start of the incident.
    expect(incident.audio.cues.some(c => c.cue === 'l1.blast' || c.cue === 'l1.scream')).toBe(true);
    expect(incident.audio.cues.some(c => c.cue === 'civilian.scream' || c.cue === 'civilian.transform')).toBe(true);
    expect(incident.audio.music.state).toBe('tension');
    const sting = incident.audio.cues.find(c => c.cue === 'stinger.objective' || c.cue === 'stinger.elite')!;
    expect(sting).toBeDefined();
    expect(sting.time - incident.capture.time).toBeLessThan(2);
    // The bat checkpoint (weapon objective done, bat granted in L1 v2) avoids repeating the walk; LMB swings the bat.
    await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1', { checkpoint: 'bat' }); a.setLoadout(['weapon.bat'], ['weapon.fists']); a.cheats.god(true);
        // The v2 crowd is not guaranteed to be within reach of the checkpoint: put a pack of chasers beside the player.
        const p = a.getState().player!.transform;
        for (let i = 0; i < 5; i++) a.spawn('infected.runner', { x: p.x + 2 + i * 0.4, z: p.z + (i % 2 ? 1 : -1) }, { state: 'chase' });
        a.resume(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__SS__!.audio.clearLog(); window.__audioCapture.start(); });
    const deadline = Date.now() + 28000;
    while (Date.now() < deadline) {
        const target = await page.evaluate(() => {
            const a = window.__SS__!, p = a.getState().player!.transform;
            return a.query({ kind: 'infected' }).filter(e => e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0]?.transform;
        });
        if (target) {
            const point = await page.evaluate(p => window.__SS__!.input.project(p), target);
            await page.mouse.move(point.x, point.y); await page.mouse.down();
        }
        await page.waitForTimeout(350);
        await page.mouse.up();
    }
    const fight = await stop('03-store-fight');
    expect(fight.audio.cues.some(c => c.cue === 'flesh.bat')).toBe(true);
    expect(fight.audio.music.streamed.transitions.some(t => t.state === 'combat')).toBe(true);
    const variants = fight.audio.cues.filter(c => c.cue === 'flesh.bat').map(c => c.variant);
    for (let i = 1; i < variants.length; i++) expect(variants[i]).not.toBe(variants[i - 1]);
    writeFileSync(join(previewRoot, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
});
