import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { infectedDefinitions } from '../../../src/data/infected';
import { audioCues, explosionBeats, propMaterials } from '../../../src/data/audioCues';
import type { GameEvent } from '../../../src/sim/world/types';
const root = 'test-results/epics/E16';
function artifact(name: string, data: unknown) { mkdirSync(root, { recursive: true }); writeFileSync(`${root}/${name}.json`, JSON.stringify(data, null, 2) + '\n'); }
async function start(page: import('@playwright/test').Page, scenario = 'horde-arena') {
    await boot(page);
    await page.mouse.click(200, 250);
    await page.evaluate(async (scenario) => { const a = window.__SS__!; await a.loadScenario(scenario); a.pause(); await a.audio.unlock(); a.cheats.god(true); a.audio.clearLog(); }, scenario);
}
test('T-E16-01b @E16 @E16-AC01 every production cue decodes in both native Opus and AAC', async ({ page }) => {
    await boot(page);
    const formats = await page.evaluate(async () => ({ opus: await window.__SS__!.audio.decode('webm'), aac: await window.__SS__!.audio.decode('m4a') }));
    expect(formats.opus.map(c => c.id).sort()).toEqual(Object.keys(audioCues).sort());
    expect(formats.aac.map(c => c.id).sort()).toEqual(Object.keys(audioCues).sort());
    for (const row of [...formats.opus, ...formats.aac])
        expect(row.frames).toBeGreaterThan(0);
    artifact('decode', { opus: formats.opus.length, aac: formats.aac.length });
});
test('T-E16-03 @E16 @E16-AC03 real archetype events play before damage, offscreen gain is +3dB and protected', async ({ page }) => {
    await boot(page);
    await page.mouse.click(200, 250);
    const rows = [];
    for (const def of infectedDefinitions) {
        const data = await page.evaluate(async (id) => {
            const a = window.__SS__!;
            await a.loadScenario('horde-arena');
            a.pause();
            a.input.set({ move: { x: 0, z: 0 } });
            await a.audio.unlock();
            const source = a.spawn(id, { x: 0.9, z: 0 }, { state: 'chase' });
            if (id === 'infected.bloated')
                a.cheats.killAll();
            await a.step(130);
            return { source, events: a.events(), audio: a.audio.snapshot() };
        }, def.id);
        const telegraphs = data.events.filter(e => e.type === 'telegraph' && e.sourceId === data.source), attacks = data.events.filter(e => e.type === 'infected.attack' && e.sourceId === data.source);
        expect(telegraphs.length, def.id).toBeGreaterThan(0);
        expect(data.audio.cues.some(c => c.cue === `telegraph.${def.id.split('.')[1]}`), def.id).toBe(true);
        for (const attack of attacks) {
            if (attack.type !== 'infected.attack')
                continue;
            const tell = telegraphs.find(e => e.type === 'telegraph' && e.attackId === attack.attackId)!;
            expect((attack.tick - tell.tick) / 60).toBeGreaterThanOrEqual(def.special === 'scream' ? 0.8 : 0.35);
        }
        if (def.special === 'scream')
            expect(telegraphs[0]).toMatchObject({ duration: 0.8 });
        rows.push({ archetype: def.id, telegraphs: telegraphs.length, attacks: attacks.length });
    }
    const gain = await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); await a.audio.unlock(); const on = a.audio.play('telegraph.runner', { position: { x: 0, z: -2 }, offscreen: false }, 100)!; const off = a.audio.play('telegraph.runner', { position: { x: 0, z: -2 }, offscreen: true }, 101)!; a.audio.emit({ type: 'explosion.beat', tick: 0, sourceId: 50, position: { x: 15, z: 0 }, size: 'mega', beat: 'crack' }); const voices = a.audio.emitters(); return { on: voices.find(v => v.id === on)!.gain, off: voices.find(v => v.id === off)!.gain, bus: a.audio.snapshot().buses.telegraph }; });
    expect(20 * Math.log10(gain.off / gain.on)).toBeCloseTo(3, 3);
    expect(gain.bus).toBeGreaterThanOrEqual(10 ** (-6 / 20));
    artifact('telegraphs', { rows, gain });
});
test('T-E16-05b @E16 @E16-AC05 150-infected crowd plays only clusters plus four nearby vocals', async ({ page }) => {
    await start(page);
    const data = await page.evaluate(async () => {
        const a = window.__SS__!;
        for (let i = 0; i < 150; i++) {
            const radius = i < 4 ? 5 : 22, angle = i < 4 ? i * Math.PI / 2 : i * Math.PI * 2 / 150;
            a.spawn('infected.runner', { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }, { state: 'idle' });
        }
        await a.step(60);
        const snapshot = a.audio.snapshot(), emitters = a.audio.emitters();
        return { snapshot, emitters };
    });
    const clusters = data.emitters.filter(v => v.cue.startsWith('horde.loop.'));
    expect(clusters.length).toBeGreaterThanOrEqual(3);
    expect(clusters.length).toBeLessThanOrEqual(6);
    const vocals = data.emitters.filter(v => v.cue === 'infected.vocal');
    expect(vocals.length).toBeGreaterThan(0);
    expect(vocals.length).toBeLessThanOrEqual(4);
    for (const v of vocals)
        expect(Math.hypot(v.position!.x, v.position!.z)).toBeLessThanOrEqual(6);
    for (const v of clusters)
        expect(data.snapshot.clusters.some(c => Math.hypot(v.position!.x - c.x, v.position!.z - c.z) < 2)).toBe(true);
    expect(data.snapshot.voices).toBeLessThanOrEqual(32);
    artifact('horde', data);
});
test('T-E16-09 @E16 @E16-AC09 sim walking reads asphalt→grass→wood→glass from the surface map', async ({ page }) => {
    await start(page, 'survivor');
    const data = await page.evaluate(async () => {
        const a = window.__SS__!;
        a.audio.map({ buildings: [], zones: [], surfaces: ['asphalt', 'grass', 'wood', 'glass'].map((surface, i) => ({ surface: surface as 'asphalt' | 'grass' | 'wood' | 'glass', polygon: [[i * 3 - 1, -2], [i * 3 + 2, -2], [i * 3 + 2, 2], [i * 3 - 1, 2]] })) });
        a.input.set({ move: { x: 1, z: 0 } });
        for (let i = 0; i < 36; i++) {
            await a.step(6);
            await new Promise(r => setTimeout(r, 30));
        }
        a.input.clear();
        return { x: a.getEntity(1)!.transform.x, cues: a.audio.snapshot().cues.filter(c => c.cue.startsWith('footstep.survivor.')) };
    });
    expect(data.x).toBeGreaterThan(9);
    const unique = [...new Set(data.cues.map(c => c.cue))];
    expect(unique.slice(0, 4)).toEqual(['footstep.survivor.asphalt', 'footstep.survivor.grass', 'footstep.survivor.wood', 'footstep.survivor.glass']);
    for (const cue of data.cues) {
        const expected = cue.position!.x < 2 ? 'asphalt' : cue.position!.x < 5 ? 'grass' : cue.position!.x < 8 ? 'wood' : cue.position!.x < 11 ? 'glass' : 'asphalt';
        expect(cue.cue).toBe(`footstep.survivor.${expected}`);
    }
    artifact('footsteps', data);
});
test('T-E16-10b @E16 @E16-AC10 real alerted count activates drive within a bar; offline schedules stay on grid', async ({ page }) => {
    await start(page);
    await page.evaluate(() => {
        const a = window.__SS__!;
        for (let i = 0; i < 10; i++)
            a.spawn('infected.runner', { x: 8 + i * 0.4, z: -2 }, { state: 'chase' });
        a.resume();
    });
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().music.layers), { timeout: 4500 }).toContain('drive');
    const data = await page.evaluate(async () => { const a = window.__SS__!; a.pause(); const live = a.audio.snapshot().music; const offline = await a.audio.render({ scenario: 'music' }); return { live, transitions: offline.transitions }; });
    expect(data.transitions!.length).toBeGreaterThanOrEqual(3);
    for (const t of data.transitions!)
        expect(Math.abs(t.time - Math.round(t.time / 2) * 2)).toBeLessThanOrEqual(0.02);
    artifact('music', data);
});
test('T-E16-12 @E16 @E16-AC12 positional jukebox/jingle variants and radio lowpass/emergency duck', async ({ page }) => {
    await start(page);
    const data = await page.evaluate(async () => {
        const a = window.__SS__!;
        const sources = ['jukebox', 'ice-cream', 'car-radio', 'emergency', 'school-bell', 'pa', 'megaphone'] as const;
        let id = 100;
        for (const kind of sources)
            for (const level of ['L1', 'L6'])
                a.audio.emit({ type: 'diegetic', tick: 0, sourceId: id++, kind, level, inCar: kind === 'car-radio' || kind === 'emergency', position: { x: kind === 'jukebox' ? -3 : 3, z: -2 } });
        // Observe applied native automation after a render quantum.
        await new Promise(r => setTimeout(r, 30));
        return { cues: a.audio.snapshot().cues, voices: a.audio.emitters(), buses: a.audio.snapshot().buses };
    });
    const ids = data.cues.map(c => c.cue);
    for (const kind of ['jukebox', 'ice-cream']) {
        expect(ids).toContain(`diegetic.${kind}`);
        expect(ids).toContain(`diegetic.${kind}.warped`);
    }
    for (const v of data.voices.filter(v => v.cue.startsWith('diegetic.') || v.cue === 'dialogue.radio')) {
        expect(v.panner).toBe('HRTF');
        expect(v.position).not.toBeNull();
        if (v.cue === 'diegetic.car-radio' || v.cue === 'dialogue.radio')
            expect(v.cutoff).toBe(2400);
        if (v.cue.endsWith('.warped'))
            expect(v.rate).toBeLessThan(1);
    }
    expect(ids).toContain('dialogue.radio');
    expect(data.buses.music).toBeCloseTo(10 ** (-8 / 20), 3);
    artifact('diegetic', data);
});
test('T-E16-14b @E16 @E16-AC14 tinnitus only within 4m and respects its setting; overlaps compose ducks', async ({ page }) => {
    await start(page);
    const rows = [];
    for (const [distance, enabled] of [[3, true], [4, true], [3, false]] as const) {
        const row = await page.evaluate(async ({ distance, enabled }) => { const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); await a.audio.unlock(); a.settings.set({ tinnitus: enabled }); a.audio.emit({ type: 'explosion.beat', tick: 0, sourceId: 10, position: { x: distance, z: 0 }, beat: 'crack', size: 'mega' }); return { distance, enabled, snapshot: a.audio.snapshot() }; }, { distance, enabled });
        rows.push(row);
        expect(row.snapshot.cues.some(c => c.cue === 'tinnitus')).toBe(distance < 4 && enabled);
        expect(row.snapshot.buses.telegraph).toBe(1);
        expect(row.snapshot.buses.dialogue).toBe(1);
    }
    const overlap = await page.evaluate(async () => { const a = window.__SS__!; a.audio.emit({ type: 'dialogue', tick: 0, text: 'Head to safety.', duration: 3 }); await new Promise(r => setTimeout(r, 30)); return a.audio.snapshot().buses; });
    expect(20 * Math.log10(overlap.music)).toBeCloseTo(-20, 2);
    expect(20 * Math.log10(overlap.ambience)).toBeCloseTo(-18, 2);
    artifact('tinnitus', { rows, overlap });
});
test('T-E16-15 @E16 @E16-AC15 light-lab, prop-yard and blast-lab use real bus event→cue adapters', async ({ page }) => {
    await start(page);
    const events: GameEvent[] = [];
    let sourceId = 100;
    for (const phase of ['pull', 'sputter', 'idle'] as const)
        events.push({ type: 'light.generator', tick: 0, sourceId: sourceId++, position: { x: 2, z: 0 }, phase });
    for (const phase of ['hum', 'flicker', 'break'] as const)
        events.push({ type: 'light.lamp', tick: 0, sourceId: sourceId++, position: { x: 2, z: 0 }, phase });
    events.push({ type: 'light.power', tick: 0, sourceId: sourceId++, position: { x: 2, z: 0 }, on: false });
    for (const material of propMaterials)
        for (const impulse of [2, 20])
            events.push({ type: 'prop.impact', tick: 0, sourceId: sourceId++, position: { x: 2, z: 0 }, material, impulse });
    for (const hp of [100, 50, 5])
        events.push({ type: 'barricade.sound', tick: 0, sourceId: sourceId++, position: { x: 2, z: 0 }, phase: 'hit', hp, maxHp: 100 });
    for (const beat of explosionBeats)
        events.push({ type: 'explosion.beat', tick: 0, sourceId: sourceId++, position: { x: 15, z: 0 }, beat, size: 'mega' });
    const data = await page.evaluate(events => {
        const a = window.__SS__!;
        for (const event of events)
            a.audio.emit(event);
        return { sim: a.events().filter(e => e.type !== 'sim.tick'), cues: a.audio.snapshot().cues };
    }, events);
    for (const event of events)
        expect(data.sim).toContainEqual(event);
    const ids = data.cues.map(c => c.cue);
    for (const phase of ['pull', 'sputter', 'idle'])
        expect(ids).toContain(`generator.${phase}`);
    for (const phase of ['hum', 'flicker', 'break', 'power-off'])
        expect(ids).toContain(`lamp.${phase}`);
    for (const beat of explosionBeats)
        expect(ids).toContain(`explosion.${beat}`);
    for (const material of propMaterials) {
        const gains = data.cues.filter(c => c.cue === `prop.${material}`).map(c => c.gain);
        expect(gains).toHaveLength(2);
        expect(gains[1] / gains[0]).toBeCloseTo(10, 3);
    }
    const creaks = data.cues.filter(c => c.cue === 'prop.creak').map(c => c.rate);
    expect(creaks[1]).toBeGreaterThan(creaks[0]);
    expect(creaks[2]).toBeGreaterThan(creaks[1]);
    artifact('system-coupling', data);
});
test('T-E16-17a @E16 @E16-AC17 captions show important direction cues and noise rings obey settings', async ({ page }) => {
    await start(page);
    await page.evaluate(() => { const a = window.__SS__!; a.settings.set({ captions: true, noiseRings: true }); a.audio.emit({ type: 'noise', tick: 0, sourceId: 100, position: { x: -12, y: 0.7, z: 12 }, kind: 'scream', actionId: 'infected.screamer', radius: 20, loudness: 1 }); a.audio.emit({ type: 'noise', tick: 0, sourceId: 1, actionId: 'weapon.pistol', kind: 'ranged', position: { x: 0, y: 0.7, z: 0 }, radius: 25, loudness: 1 }); });
    await expect(page.locator('[data-audio-captions]')).toContainText('[Screamer shrieking — left]');
    await expect(page.locator('[data-noise-ring]')).toBeVisible();
    // A short-range melee ring fits entirely on screen beside the pistol's 25m ring.
    await page.evaluate(() => window.__SS__!.audio.emit({ type: 'noise', tick: 0, sourceId: 1, actionId: 'weapon.fists', kind: 'melee', position: { x: 0, y: 0.7, z: 0 }, radius: 6, loudness: 1 }));
    await page.locator('[data-audio-controls]').evaluate(e => (e as HTMLDetailsElement).open = true);
    await page.screenshot({ path: `${root}/accessibility-desktop.png` });
    await page.evaluate(() => {
        const a = window.__SS__!;
        a.audio.play('telegraph.runner', { position: { x: 2, z: -2 } }, 200);
        a.audio.emit({ type: 'noise', tick: 0, sourceId: 201, actionId: 'alarm', kind: 'alarm', position: { x: -3, y: 0.7, z: 3 }, radius: 20, loudness: 1 });
        a.audio.emit({ type: 'dialogue', tick: 0, text: 'Head to safety.', position: { x: 2, z: -2 } });
    });
    await expect(page.locator('[data-audio-captions]')).toContainText('Runner snarling');
    await expect(page.locator('[data-audio-captions]')).toContainText('Car alarm');
    await expect(page.locator('[data-audio-captions]')).toContainText('Head to safety.');
    await page.evaluate(() => { const a = window.__SS__!; a.settings.set({ captions: false, noiseRings: false }); });
    await expect(page.locator('[data-audio-captions]')).toBeHidden();
    await expect(page.locator('[data-noise-ring]')).toHaveCount(0);
});
test('T-E16-01c @E16 @E16-AC01 full L1 composition coverage bot logs zero missing cues with graph active/output muted', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);
    await page.mouse.click(200, 250);
    const data = await page.evaluate(async () => { const a = window.__SS__!, result = await a.audio.l1Bot(); return { ...result, snapshot: a.audio.snapshot() }; });
    expect(data.visited.length).toBeGreaterThanOrEqual(3);
    expect(data.distance).toBeGreaterThan(30);
    expect(data.ticks).toBeGreaterThan(600);
    expect(data.cues).toBeGreaterThan(0);
    expect(data.errors).toEqual([]);
    expect(data.snapshot.state).toBe('running');
    expect(data.snapshot.output).toBe(0);
    artifact('L1-audio-bot', data);
});
test('T-E16-02b @E16 @E16-AC02 production audio consumes the same pistol noise as AI exactly once', async ({ page }) => {
    await start(page);
    const data = await page.evaluate(async () => {
        const a = window.__SS__!;
        const inside = a.spawn('infected.runner', { x: 24, z: 0 }, { state: 'idle' }), outside = a.spawn('infected.runner', { x: 26, z: 0 }, { state: 'idle' });
        a.setLoadout(['weapon.pistol'], ['weapon.fists']);
        a.input.set({ move: { x: 0, z: 0 }, left: { down: true, held: true, up: false }, aim: { x: 0, z: -1 } });
        await a.step(1);
        a.input.clear();
        return { noise: a.events().filter(e => e.type === 'noise'), cues: a.audio.snapshot().cues.filter(e => e.cue === 'action.weapon.pistol'), inside: a.getEntity(inside)!.infected!.state, outside: a.getEntity(outside)!.infected!.state };
    });
    expect(data.noise).toHaveLength(1);
    expect(data.noise[0]).toMatchObject({ radius: 25 });
    expect(data.cues).toHaveLength(1);
    expect(data.inside).toBe('alerted');
    expect(data.outside).toBe('idle');
    artifact('noise-consumers', data);
});
test('T-E16-perf @E16 @E16-AC04 @E16-AC05 @perf 150 infected with native audio stay within sim/voice budgets', async ({ page }) => {
    await start(page);
    const data = await page.evaluate(() => { const a = window.__SS__!; a.input.set({ move: { x: 0, z: 0 } }); for (let i = 0; i < 150; i++)
        a.spawn('infected.runner', { x: i % 15 - 7, z: Math.floor(i / 15) - 5 }, { state: 'chase' }); return a.audio.profile(); });
    expect(data.p95Ms).toBeLessThanOrEqual(4);
    expect(data.maxVoices).toBeLessThanOrEqual(data.limit);
    artifact('runtime-perf', data);
});
