import { l5Survivors } from './l5';
/** E24 tuning in metres/seconds. The shelter falls on a seeded clock; losses never fail the mission. */
export const l6 = {
  shelter: { high: 24, low: 24 }, breach: { model: 'npc.civilian-man-a.aftermath', first: [30, 40], secondDelay: [20, 30], abandonS: 15, telegraphS: 2, streamS: 10 },
  follow: { speed: 2.2, injuredSpeed: 1.4, stragglerM: 15, collectM: 3, rejoinM: 5, strayM: 15, regroupM: 10, strayDwellS: 2, aheadM: 12, columnM: 25 },
  infected: { high: 60, low: 30 }, tunnel: { start: 30, end: 246, z: 15, width: 6.9 },
  exit: { centerZ: 15.9, approachZ: 14.1 }, gates: [90, 150, 210],
  /** PO 10-20 #64: a closed entry hatch takes one bash per second from its waiting arrivals and breaks after `hits` (8 s). */
  hatch: { hits: 8, hitS: 1, promptM: 1.8, standM: .9 }, checkpoints: ['shelter', 'abandon', 'mid-tunnel', 'exit-platform'], caption: 'Night. Still alive.',
} as const;
export const l6BreachModels = [l6.breach.model, 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', 'npc.civilian-woman-a', 'npc.civilian-elderly'] as const;
/** Fixed shelter and maintenance cast, including every possible carried L5 survivor. */
export const l6CastModels = [...new Set([...l6BreachModels, 'npc.marcus.aftermath', 'npc.shelter-survivor.bandaged', 'npc.shelter-survivor.lying', 'npc.shelter-survivor.sitting', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', ...l5Survivors.map(s=>s.model)])];
export const l6Doors = [{ x: -10, z: -18 }, { x: 10, z: -18 }, ...[54, 126, 198].map(x => ({ x, z: 11.2 })), ...[78, 162, 228].map(x => ({ x, z: 18.8 }))];
export const l6PhotoSpots = [
  ['l6-shelter-calm', [0, -2]], ['l6-first-breach', [-10, -14]], ['l6-shelter-fails', [0, -4]],
  ['l6-tunnel-retreat', [110, 15]], ['l6-chokepoint', [150, 15]], ['l6-straggler', [130, 15]], ['l6-exit-night', [268, 15]],
] as const;
export const l6InjuryLines = {
  treatment: 'That ankle is swollen. Keep the wrap tight; I will help you stand.',
  patient: 'It hurts to put weight on it. Please do not leave me behind.',
  retreat: 'The injured cannot run. Stay with them; I will hold the rear.',
  straggler: 'My leg… I cannot keep up. Wait for me!',
  rejoin: 'Lean on me. We will get you to the others.',
};

/** Alternating sides leave the opposite half of the tunnel open. */
export const l6Entries = [2, 5, 3, 6, 4, 7].map((door, i) => ({ door, count: 2, label: i % 2 ? 'Maintenance hatch' : 'Side passage' }));
