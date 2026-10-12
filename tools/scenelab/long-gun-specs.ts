// Writes specs/scenes/qa-long-gun-<gun>.json: the courier holding each long gun
// in idle, aim, fire and walk, at close front/side cameras and the game camera.
// Usage: npx tsx tools/scenelab/long-gun-specs.ts
import { writeFileSync } from 'node:fs';

const guns = ['smg', 'assault-rifle', 'hunting-rifle', 'shotgun', 'army-mg', 'rocket-launcher'];
const front = { mode: 'orbit', target: [0, .95, 0], radius: 2.4, azimuth: 90, polar: 78 };
const side = { mode: 'orbit', target: [0, .95, 0], radius: 2.4, azimuth: 0, polar: 78 };
const back = { mode: 'orbit', target: [0, .95, 0], radius: 2.4, azimuth: 225, polar: 70 };
const game = { mode: 'game', target: [0, 0], zoom: .3 };
// The second weapon slot (RIGHT) must draw the same hold: the army MG once more from that slot.
for (const [gun, slot] of [...guns.map(g => [g, 'LEFT']), ['army-mg', 'RIGHT']] as const) {
  const right = slot === 'RIGHT', suffix = right ? '-slot2' : '';
  const loadout = right ? ['weapon.fists', `weapon.${gun}`] : [`weapon.${gun}`, 'weapon.fists'];
  const spec = {
    name: `qa-long-gun-${gun}${suffix}`,
    note: 'PO 10-12: "the way the player holds the MP looks wrong". Courier holds the gun upright, barrel along the aim, stock at the shoulder (MG at the hip), right hand on the grip, left hand on the fore-end; idle, aim, fire and walk.',
    ground: 'asphalt', size: 40,
    actors: [
      { id: 'courier', kind: 'courier', at: [0, 0], yaw: 0, loadout },
      { id: 't', kind: 'infected', at: [12, 0], yaw: 0, state: 'idle' },
    ],
    script: [
      ...(right ? [{ frame: 2, actor: 'courier', do: { select: 'RIGHT' } }] : []),
      { frame: 34, camera: front }, { frame: 44, camera: side }, { frame: 54, camera: back }, { frame: 64, camera: game },
      { frame: 70, actor: 'courier', do: { aim: 't', seconds: 4 } },
      { frame: 104, camera: front }, { frame: 114, camera: side }, { frame: 124, camera: back }, { frame: 134, camera: game },
      { frame: 150, actor: 'courier', do: { attack: 't', seconds: .5, side: slot } },
      { frame: 154, camera: front }, { frame: 160, camera: side },
      { frame: 200, actor: 'courier', do: { walk: [[0, -6]] } },
      { frame: 200, camera: { mode: 'follow', actor: 'courier', zoom: .3 } },
    ],
    camera: front, frames: 260,
    shots: [40, 50, 60, 70, 110, 120, 130, 140, 156, 162, 236, 250],
    expect: { consoleErrors: 0 },
  };
  writeFileSync(`specs/scenes/qa-long-gun-${gun}${suffix}.json`, JSON.stringify(spec, null, 1) + '\n');
}
