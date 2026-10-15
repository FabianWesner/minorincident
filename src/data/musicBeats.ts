import type { MissionState } from '../sim/missions/types';

/** Story floors: 0 = ambient, 0.25 = tension, 0.5 = dramatic rock. Save/load reads the current beat. */
export const musicBeats: Record<string, Readonly<Record<string, number>>> = {
    L8: { sanctuary: 0, breach: .25 },
    L1: { morning: 0, handover: 0, calm: 0, accident: 0.25, spread: 0.25, safe: 0 },
    L2: { calm: 0, alarm: 0.25, ride: 0.25, arrived: 0.25, doors: 0.25, collapse: 0.5, escape: 0.5, checkpoint: 0, done: 0 },
    L3: { forecourt: 0.5, car: 0.25, 'market-route': 0.25, 'park-route': 0.25, 'market-bypass': 0.25,
        'market-supplies': 0.25, 'market-cover': 0.5, 'park-rescue': 0.25, 'park-cover': 0.5,
        approach: 0.5, checkpoint: 0.5, 'checkpoint-cover': 0.5, patient: 0.25, gates: 0.5, safe: 0 },
    // E22: a calm bed through the ride and the plaza, the loudest mix from the turn, the cellar keeps the tension low.
    L4: { convoy: 0, plaza: 0, war: 0.5, collapse: 0.5, cellar: 0.25, done: 0.25, safe: 0 },
};

export function storyMusic(level: string, mission?: MissionState): { beat: string; minimum: number } {
    if (!mission || mission.id !== level || mission.phase !== 'playing') return { beat: 'safe', minimum: 0 };
    const beats = musicBeats[level];
    if (level === 'L8') { const beat = mission.states.breached ? 'breach' : 'sanctuary'; return { beat, minimum: beats[beat] }; }
    let beat = mission.l1?.phase ?? mission.l2?.phase ?? mission.l4?.phase ?? 'safe';
    if (level === 'L1' && mission.steps.firestation?.status === 'completed') beat = 'safe';
    if (level === 'L3') {
        for (const [id, step] of Object.entries(mission.steps))
            if (step.status === 'active' && (beats?.[id] ?? 0) > (beats?.[beat] ?? 0)) beat = id;
    }
    return { beat, minimum: beats?.[beat] ?? 0 };
}

/** L5's first found survivor unlocks its existing recording, including checkpoint restores. */
export function l5MusicReady(mission?: MissionState): boolean {
    return mission?.id === 'L5' && (mission.l5?.found ?? 0) > 0;
}
