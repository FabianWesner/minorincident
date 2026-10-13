import { AudioGraph } from '../audio/AudioGraph';
import { AudioRegistry } from '../audio/AudioRegistry';
import { type AudioBus, audioCues, resolvedAudioCue, ambienceTiers, explosionBeats, musicLayers } from '../data/audioCues';
import { dbGain, reverbPresets, type ReverbPreset } from '../audio/acoustics';
import { wave } from '../audio/synthesis';
import { MusicDirector } from '../audio/MusicDirector';
export interface AudioRenderRequest {
    scenario: 'shot' | 'occlusion' | 'doppler' | 'twist' | 'ambience' | 'duck' | 'audio-mix' | 'mono' | 'music' | 'l5-quiet' | 'cue-log';
    duration?: number;
    cues?: { cue: string; variant: string; time: number; gain: number; rate: number; lowpass?: number; position?: { x: number; y?: number; z: number } }[];
    score?: { file: string; gain: number };
    weather?: import('../data/weather').WeatherKind;
    includeDialogue?: boolean;
    bus?: AudioBus;
    ducked?: boolean;
    zone?: ReverbPreset;
    occluded?: boolean;
    level?: string;
    tier?: number;
    mono?: boolean;
    kind?: 'radio' | 'mega';
}
export interface AudioRenderResult {
    wav: string;
    duration: number;
    sampleRate: number;
    voices: number;
    events: {
        cue: string;
        time: number;
    }[];
    transitions?: {
        time: number;
        layers: string[];
    }[];
    presetBand?: readonly number[];
}
/** Query-gated offline acceptance harness. Calls the production graph and loads production sprite files.
 * Audio is returned as PCM WAV for independent Node/FFmpeg measurement, never scored against synthetic metadata. */
export async function renderAudio(request: AudioRenderRequest): Promise<AudioRenderResult> {
    const duration = request.scenario === 'cue-log' ? request.duration ?? 60 : request.scenario === 'audio-mix' || request.scenario === 'l5-quiet' ? 60 : request.scenario === 'twist' ? 5 : request.scenario === 'music' ? 14 : request.scenario === 'doppler' ? 4 : 3;
    const rate = 24000, context = new OfflineAudioContext(2, Math.ceil(duration * rate), rate), graph = new AudioGraph(context), registry = new AudioRegistry(context);
    const events: {
        cue: string;
        time: number;
    }[] = [];
    graph.setWeather(request.weather ?? 'clear');
    let maxVoices = 0;
    let scoreVoices = 0;
    await registry.prepare(request.level ?? 'L1');
    // Weapons, vehicles, dialogue and telegraphs are lazy banks in the live game; the offline render needs them up front.
    await registry.preloadLazy();
    // Offline renders schedule all sources before startRendering; retire finished handles against the
    // scheduled time so the same limiter models simultaneous voices rather than all events in 60s.
    const play = (id: string, time = 0, options: Parameters<AudioGraph['play']>[2] = {}) => {
        graph.retire(time);
        const cue = audioCues[id], buffer = registry.buffers.get(cue.category)!;
        const voice = graph.play(cue, buffer, { ...options, time });
        if (voice) {
            events.push({ cue: id, time });
            maxVoices = Math.max(maxVoices, graph.active.size + scoreVoices);
        }
        return voice;
    };
    if (request.scenario === 'shot')
        play('action.weapon.pistol', 0, { position: { x: 0, z: -2 }, zone: request.zone ?? 'street' });
    if (request.scenario === 'occlusion') {
        if (request.occluded)
            graph.map.buildings.push({ min: { x: -1, z: -1.5 }, max: { x: 1, z: -0.5 } });
        play('action.weapon.pistol', 0, { position: { x: 0, z: -2 }, dry: true });
    }
    if (request.scenario === 'doppler') {
        const v = play('vehicle.engine-high', 0, { position: { x: -30, z: -4 }, velocity: { x: 15, z: 0 }, loop: true, dry: true })!;
        for (let t = 0; t < 4; t += 0.05) {
            v.position!.x = -30 + 15 * t;
            graph.updateEmitter(v, t);
        }
    }
    if (request.scenario === 'mono') {
        graph.setMono(request.mono ?? true);
        play('diegetic.ice-cream', 0, { position: { x: -4, z: 4 }, dry: true });
    }
    if (request.scenario === 'twist') {
        const level = request.level ?? 'L1';
        play(`music.${level}.base`, 0, { loop: true });
        play('stinger.twist', graph.twist(0.5));
        if (level === 'L6')
            play('stinger.dawn', 2.8);
    }
    if (request.scenario === 'ambience') {
        for (const bed of ambienceTiers[request.tier ?? 0].beds)
            play(`bed.${bed}`, 0, { loop: true, gain: request.tier === 5 ? dbGain(-16) : 1 });
    }
    if (request.scenario === 'duck') {
        const kind = request.kind ?? 'radio';
        play('music.L1.base', 0, { loop: true });
        play('bed.wind', 0, { loop: true });
        play('telegraph.screamer', 0, { loop: true });
        play('dialogue.radio', 0, { loop: true, gain: 0.2 });
        if (request.ducked !== false)
            graph.duck(kind, 0.8, kind === 'mega' ? 0.8 : 1.2);
        if (request.bus)
            for (const [bus, node] of Object.entries(graph.buses))
                if (bus !== request.bus)
                    node.disconnect();
    }
    let transitions: AudioRenderResult['transitions'];
    if (request.scenario === 'music') {
        const music = new MusicDirector('L1'), stems = musicLayers.map(layer => ({ layer, v: play(`music.L1.${layer}`, 0, { gain: layer === 'base' ? 1 : 0, loop: true })! }));
        let last: object | undefined;
        for (let t = 0; t < 14; t += 0.01) {
            music.update(t, { alerted: t < 0.3 ? 10 : t >= 12.3 ? 10 : 0 });
            const transition = music.pending ?? music.transitions.at(-1);
            if (transition && transition !== last) {
                last = transition;
                for (const { layer, v } of stems) {
                    v.gain.gain.setValueAtTime(transition.layers.includes(layer) ? audioCues[v.cue].gain : 0, transition.time);
                }
            }
        }
        transitions = music.transitions;
    }
    if (request.scenario === 'cue-log') {
        // Replay observed production cues in mission time, retaining sprite variation,
        // emitter gain/rate and listener-relative position rather than inventing a battle.
        if (request.score) {
            let recording: AudioBuffer | undefined;
            for (const format of ['webm', 'm4a']) {
                try {
                    const response = await fetch(`/assets/audio/score-${request.score.file}.${format}`);
                    if (!response.ok) throw new Error(`Score request failed: ${response.status}`);
                    recording = await context.decodeAudioData(await response.arrayBuffer()); break;
                } catch { /* The production media deck uses the same codec fallback. */ }
            }
            if (!recording) throw new Error('Recorded score could not decode either codec');
            const source = context.createBufferSource(), trim = context.createGain();
            source.buffer = recording;
            source.loop = true; trim.gain.value = request.score.gain;
            source.connect(trim).connect(graph.buses.music); source.start(0); scoreVoices = 1;
        }
        for (const event of [...request.cues ?? []].sort((a, b) => a.time - b.time)) {
            if (event.time < 0 || event.time >= duration) continue;
            const variant = resolvedAudioCue(event.variant);
            if (!variant) throw new Error(`Missing recorded cue variant: ${event.variant}`);
            graph.retire(event.time);
            const voice = graph.play({ ...variant, id: event.cue }, registry.buffers.get(variant.category)!, {
                time: event.time, gain: event.gain / variant.gain, rate: event.rate, position: event.position, lowpass: event.lowpass,
            });
            if (voice) { events.push({ cue: event.cue, time: event.time }); maxVoices = Math.max(maxVoices, graph.active.size + scoreVoices); }
            if (event.cue === 'dialogue.radio') graph.duck('radio', event.time, variant.duration);
            if (event.cue === 'explosion.roar') graph.duck('mega', event.time, .8);
        }
    }
    if (request.scenario === 'l5-quiet') {
        // The first 60 s of L5 as the production rules play them (E23-AC14): no music at all, the W5 beds (wind, fire) at the W5 gain, a distant
        // collapse, an infected's breathing now and then, two signs of life (a knock, a clang) and one machine-gun burst.
        for (const bed of ambienceTiers[5].beds)
            play(`bed.${bed}`, 0, { loop: true, gain: dbGain(-16) });
        for (const t of [14, 33, 49])
            play('ambient.collapse', t, { position: { x: 30, z: -30 } });
        for (const t of [9, 31, 52])
            play('infected.vocal', t, { position: { x: 12, z: 5 }, gain: 0.6 });
        for (const t of [20, 35])
            play(t === 20 ? 'door.wood' : 'impact.body.metal', t, { position: { x: 14, z: 2 } });
        for (let k = 0; k < 6; k++)
            play('action.weapon.army-mg', 41 + k * 0.1, { position: { x: 0, z: -2 }, dry: true });
    }
    if (request.scenario === 'audio-mix') {
        // 60s deterministic combat + dialogue + explosion, including the same gain/ducking envelopes as live.
        // Offline contexts cannot stream MediaElements. Decode the exact shipped stereo
        // recording and feed the same bus with the live deck trim and accent gain.
        let recording: AudioBuffer | undefined;
        for (const format of ['webm', 'm4a']) {
            try {
                const response = await fetch(`/assets/audio/score-combat.${format}`);
                if (!response.ok) throw new Error(`Score request failed: ${response.status}`);
                recording = await context.decodeAudioData(await response.arrayBuffer());
                break;
            } catch { /* Match the production codec fallback. */ }
        }
        if (!recording) throw new Error('Offline score could not decode either codec');
        const score = context.createBufferSource(), trim = context.createGain();
        score.buffer = recording; score.loop = true; trim.gain.value = 0.5;
        score.connect(trim).connect(graph.buses.music); score.start(0); scoreVoices = 1;
        for (const layer of ['pulse', 'drive'])
            play(`music.L1.${layer}`, 0, { loop: true, gain: 0.18 });
        for (const bed of ambienceTiers[2].beds)
            play(`bed.${bed}`, 0, { loop: true, gain: 0.6 });
        const sequence: {
            time: number;
            run: () => void;
        }[] = [];
        for (let time = 0; time < 60; time += 0.4) {
            const at = time;
            sequence.push({ time: at, run: () => play('action.weapon.pistol', at, { position: { x: 0, z: -2 }, dry: true }) });
            if (Math.round(at * 10) % 20 === 0)
                sequence.push({ time: at, run: () => play('prop.metal', at, { position: { x: 3, z: -2 }, dry: true, gain: 0.4 }) });
        }
        for (const t of [8, 23, 43])
            sequence.push({ time: t, run: () => { if (request.includeDialogue !== false)
                    play('dialogue.radio', t); graph.duck('radio', t, 3); } });
        for (const t of [16, 36, 54]) {
            for (const [i, beat] of explosionBeats.entries())
                sequence.push({ time: t + i * 0.09, run: () => play(`explosion.${beat}`, t + i * 0.09, { position: { x: 0, z: -2 }, dry: true, gain: 0.6 }) });
            sequence.push({ time: t + 0.09, run: () => graph.duck('mega', t + 0.09, 0.8) });
        }
        sequence.sort((a, b) => a.time - b.time);
        for (const event of sequence)
            event.run();
    }
    const buffer = await context.startRendering(), bytes = wave([buffer.getChannelData(0), buffer.getChannelData(1)], rate);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 16384)
        binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    graph.dispose();
    return { wav: btoa(binary), duration, sampleRate: rate, voices: maxVoices, events, transitions, presetBand: request.zone ? reverbPresets[request.zone].band : undefined };
}
