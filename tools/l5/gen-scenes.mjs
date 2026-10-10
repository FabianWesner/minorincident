// Generates the E23 Scene Lab specs (specs/scenes/qa-l5-*.json). Run: node tools/l5/gen-scenes.mjs
import { writeFileSync } from 'node:fs';

const out = (name, spec) => writeFileSync(`specs/scenes/${name}.json`, JSON.stringify({ name, ...spec }, null, 1) + '\n');
const L5 = { ground: 'district', time: 'L5', tier: 5, clipping: { ignoreFoliage: true } };
const crop = (level, [x, z], r) => ({ level, district: 'D-FAIR', bbox: [[x - r, z - r], [x + r, z + r]] });

// ---------------------------------------------------------------- recognition: the four pair cameras, L4 (safe) and L5 (fallen), identical framing
const pairs = {
  plaza: { at: [-17, 3], stand: [-14, 6], offset: [20, 24, 20], r: 60, note: 'the Reception Plaza' },
  'harbor-street': { at: [-10, -39], offset: [-22, 13, 4], r: 50, note: 'Harbor Street' },
  'metro-entrance': { at: [37.8, -44.2], stand: [34.6, -44.6], offset: [14, 17, 14], r: 40, note: 'the Metro entrance' },
  'kessler-lane': { at: [68, 28.6], offset: [-14, 17, -14], r: 40, note: 'Kessler Lane' },
};
for (const [key, p] of Object.entries(pairs)) {
  const camera = { mode: 'pose', position: [p.at[0] + p.offset[0], p.offset[1], p.at[1] + p.offset[2]], target: [p.at[0], 0, p.at[1]] };
  out(`qa-l5-pair-${key}-l4`, { note: `E23 recognition (AC18): ${p.note} in L4 (clean, intact), the pair camera pair-${key}; compare with qa-l5-pair-${key}-l5.`, ground: 'district', time: 'L4', tier: 0, layout: crop('L4', p.at, p.r), clipping: { ignoreFoliage: true }, camera, actors: [{ id: 'courier', kind: 'courier', at: p.stand ?? p.at, yaw: 0, state: 'idle' }], frames: 6, shots: [5], expect: { consoleErrors: 0 } });
  out(`qa-l5-pair-${key}-l5`, { note: `E23 recognition (AC18): ${p.note} hours later (W5): the same buildings, burned and shot up, the power out, sunset.`, ...L5, layout: crop('L5', p.at, p.r), camera, actors: [{ id: 'courier', kind: 'courier', at: p.stand ?? p.at, yaw: 0, state: 'idle' }], frames: 6, shots: [5], expect: { consoleErrors: 0 } });
}

// ---------------------------------------------------------------- the five hiding places: the courier at the ring, the survivor stepping out
const places = {
  dale: { model: 'npc.dale.aftermath', ring: [-4.6, 2.6], out: [-3.6, 2.4], look: [-5, 4.5], r: 34, note: 'the cab of the second convoy truck on the plaza (a wreck; Dale bangs on the metal)' },
  rosa: { model: 'npc.rosa.aftermath', ring: [58, 41.3], out: [59.2, 41.9], look: [58, 39], r: 30, note: 'the pharmacy back room on Lakeshore Avenue (Rosa knocks from inside)' },
  okafor: { model: 'npc.mr-okafor.aftermath', ring: [-33.5, -2.7], out: [-32.6, -2.7], look: [-37, -3], r: 30, note: 'the church vestry (Mr. Okafor prays softly inside)' },
  mia: { model: 'npc.mia.aftermath', ring: [-76.2, -44.4], out: [-76.2, -43.1], look: [-77, -46], r: 28, note: 'the apartment stairwell above Harbor Street (a radio crackles; a chalk sign by the door)' },
  sam: { model: 'npc.sam.aftermath', ring: [-45, 42.6], out: [-43.8, 42.6], look: [-45, 44], r: 30, note: 'the wrecked bus on Lakeshore Avenue (a flashlight blinks inside)' },
};
for (const [key, p] of Object.entries(places)) {
  out(`qa-l5-hide-${key}`, {
    note: `E23 beat 3: ${p.note}. The courier stands at the ring; the survivor steps out in the aftermath skin; the cue prop (flashlight, radio, chalk sign) is visible.`,
    ...L5, layout: crop('L5', p.look, p.r),
    actors: [
      { id: 'courier', kind: 'courier', at: p.ring, yaw: 0, loadout: ['weapon.fire-axe', 'weapon.army-mg'], state: 'idle' },
      { id: key, kind: 'pedestrian', at: p.out, yaw: 180, look: { model: p.model }, state: 'idle' },
    ],
    camera: { mode: 'game', target: p.look, zoom: 1.1 }, frames: 90, shots: [1, 60, 89], expect: { consoleErrors: 0, undrawnFramesMax: 0 },
  });
}

// ---------------------------------------------------------------- the group of five behind the courier, then the Metro arrival
const survivors = [['dale', 'npc.dale.aftermath'], ['rosa', 'npc.rosa.aftermath'], ['okafor', 'npc.mr-okafor.aftermath'], ['mia', 'npc.mia.aftermath'], ['sam', 'npc.sam.aftermath']];
out('qa-l5-group', {
  note: 'E23 beat 3-4 (photo spot l5-group-of-five): the courier leads the five survivors east along Harbor Street at sunset, seen from the west down the street; they follow in their slots (behind, alternating sides, 2-5 m) and keep to the pace; all drawn, no clipping, no skating.',
  ...L5, layout: crop('L5', [14, -39], 44),
  actors: [
    { id: 'courier', kind: 'courier', at: [8, -39.8], yaw: 0, loadout: ['weapon.fire-axe', 'weapon.army-mg'], state: { walk: [[34, -39.8]] } },
    ...survivors.map(([id, model], i) => ({ id, kind: 'pedestrian', at: [5 - i * 0.9, -38.8 - (i % 2) * 1.4], yaw: 0, look: { model }, state: { survivor: { slot: i } } })),
  ],
  camera: { mode: 'pose', position: [-2, 10, -36.5], target: [18, 0, -39.5] }, frames: 420, shots: [30, 150, 300, 419],
  expect: { consoleErrors: 0, undrawnFramesMax: 0, bodyOverlapMaxCm: 12 },
});
out('qa-l5-metro-arrival', {
  note: 'E23 beat 4-5 (photo spot l5-metro-shelter): the courier and the five survivors arrive at the foot of the Metro entrance, seen from the west down Harbor Street; the lookout waves from the half-open shutter; fires and smoke over the ruined block.',
  ...L5, layout: crop('L5', [37.8, -42], 36),
  actors: [
    { id: 'courier', kind: 'courier', at: [24, -39.8], yaw: 0, loadout: ['weapon.fire-axe', 'weapon.army-mg'], state: { walk: [[37.8, -42.6]] } },
    ...survivors.map(([id, model], i) => ({ id, kind: 'pedestrian', at: [20 - i * 0.9, -39 - (i % 2) * 1.4], yaw: 0, look: { model }, state: { survivor: { slot: i } } })),
    { id: 'lookout', kind: 'pedestrian', at: [37.8, -44.9], yaw: 90, look: { model: 'npc.marcus.aftermath' }, state: 'idle' },
  ],
  script: [{ frame: 0, effect: { fire: [30, -43.4] } }, { frame: 0, effect: { smoke: [44, -47] } }],
  camera: { mode: 'pose', position: [14, 9, -37.5], target: [34, 0, -42.5] }, frames: 360, shots: [20, 180, 359],
  expect: { consoleErrors: 0, undrawnFramesMax: 0 },
});
out('qa-l5-sparse-infected', {
  note: 'E23 section 5.2: a few infected loiter in the ruined plaza (ones and twos) around the burned convoy column; the courier approaches with the machine gun. Silent, wide.',
  ...L5, layout: crop('L5', [-14, 6], 40),
  actors: [
    { id: 'courier', kind: 'courier', at: [4, 2], yaw: 180, loadout: ['weapon.fire-axe', 'weapon.army-mg'], state: { walk: [[-4, 2]] } },
    { id: 'w1', kind: 'infected', at: [-24, 8], yaw: 20, state: 'idle' }, { id: 'w2', kind: 'infected', at: [-22.6, 9.2], yaw: 200, state: 'idle' },
    { id: 'w3', kind: 'infected', at: [-14, -8], yaw: 90, state: 'idle' },
  ],
  script: [{ frame: 0, effect: { fire: [-12.4, 8] } }, { frame: 0, effect: { fire: [-20, 24.6] } }],
  camera: { mode: 'game', target: [-12, 4], zoom: 1.6 }, frames: 180, shots: [1, 90, 179], expect: { consoleErrors: 0 },
});
