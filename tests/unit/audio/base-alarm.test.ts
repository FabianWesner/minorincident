import { expect, test } from 'vitest';
import { BaseAlarm } from '../../../src/audio/BaseAlarm';
import { klaxon } from '../../../src/audio/synthesis';
import { l4 } from '../../../src/data/l4';
import { storyMusic } from '../../../src/data/musicBeats';
import type { GameEvent } from '../../../src/sim/world/types';
import type { MissionState } from '../../../src/sim/missions/types';

/** PO 2026-10-12: "L4: when contact starts, play an alarm sound (typical for military)". */
function fakeGraph() {
    const plays: { options: Record<string, unknown>; voice: { stopped: boolean; baseGain: number; position: unknown } }[] = [];
    const ctx = { sampleRate: 8000, createBuffer: (_c: number, n: number, rate: number) => ({ length: n, sampleRate: rate, copyToChannel() { } }) };
    const graph = {
        context: ctx,
        play(_cue: unknown, _buffer: unknown, options: Record<string, unknown>) {
            const voice = { stopped: false, baseGain: 0.3 * Number(options.gain ?? 1), position: options.position ?? null, gain: { gain: { setValueAtTime() { } } }, stop() { voice.stopped = true; } };
            plays.push({ options, voice });
            return voice;
        },
        updateEmitter() { },
    };
    return { graph: graph as never, plays };
}
const turn = { type: 'l4.firstTurn', tick: 100, ids: [1], humansNear: 3 } as GameEvent;

test('the alarm triggers on the contact event only: three positional loudspeakers plus one quiet non-positional bed, looping', () => {
    const { graph, plays } = fakeGraph(), captions: string[] = [], alarm = new BaseAlarm(graph, t => captions.push(t));
    for (const type of ['l4.convoyArrived', 'l4.gun', 'l4.war', 'l4.wave'] as const) expect(alarm.onEvent({ type, tick: 1 } as GameEvent, 0)).toBe(false);
    expect(plays).toHaveLength(0);
    expect(alarm.onEvent(turn, 5)).toBe(true);
    expect(plays).toHaveLength(l4.alarm.speakers.length + 1);
    const positional = plays.filter(p => p.options.position), bed = plays.filter(p => !p.options.position);
    expect(positional).toHaveLength(3); expect(bed).toHaveLength(1);
    expect(plays.every(p => p.options.loop === true)).toBe(true);
    expect(Number(bed[0].options.gain)).toBeLessThan(Number(positional[0].options.gain));
    expect(positional.map(p => (p.options.position as { x: number; z: number }).x)).toEqual(l4.alarm.speakers.map(s => s[0]));
    expect(captions).toEqual(['Base alarm sounding']);
});

test('the alarm holds, then fades out inside the 20-40 s window and releases its voices', () => {
    const { graph, plays } = fakeGraph(), alarm = new BaseAlarm(graph);
    alarm.onEvent(turn, 10);
    const a = l4.alarm, total = a.holdS + a.fadeS;
    expect(total).toBeGreaterThanOrEqual(20); expect(total).toBeLessThanOrEqual(40);
    expect(alarm.level(10 + a.holdS - 1)).toBe(1);
    expect(alarm.level(10 + a.holdS + a.fadeS / 2)).toBeCloseTo(0.5, 5);
    alarm.update(10 + a.holdS + a.fadeS / 2);
    expect(plays[0].voice.baseGain).toBeCloseTo(0.3 * a.speakerGain * 0.5, 5);
    expect(alarm.active).toBe(true);
    alarm.update(10 + total + 0.1);
    expect(alarm.active).toBe(false);
    expect(plays.every(p => p.voice.stopped)).toBe(true);
});

test('the klaxon wail rises and falls, loops without a click and stays within the mixer ceiling', () => {
    const rate = 16000, a = l4.alarm, data = klaxon(rate, a.periodS, a.lowHz, a.highHz);
    expect(data.length).toBe(a.periodS * rate);
    expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(0.8001);
    let step = 0; for (let i = 1; i < data.length; i++) step = Math.max(step, Math.abs(data[i] - data[i - 1]));
    expect(Math.abs(data[0] - data[data.length - 1])).toBeLessThanOrEqual(step * 1.05);
    const zeroCrossings = (from: number, to: number) => { let n = 0; for (let i = from + 1; i < to; i++) if (data[i - 1] < 0 && data[i] >= 0) n++; return n; };
    const q = data.length / 8, lowRate = zeroCrossings(0, q) / (q / rate), highRate = zeroCrossings(Math.round(3.5 * q), Math.round(4.5 * q)) / (q / rate);
    expect(highRate).toBeGreaterThan(lowRate * 1.25);
});

test('the fight music floor starts with the turn (war beat), not before', () => {
    const state = (phase: string) => ({ id: 'L4', phase: 'playing', steps: {}, l4: { phase } }) as unknown as MissionState;
    expect(storyMusic('L4', state('plaza')).minimum).toBe(0);
    expect(storyMusic('L4', state('war')).minimum).toBe(0.5);
});
