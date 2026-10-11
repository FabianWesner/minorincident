import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
import { timeOfDay, type TimeOfDay } from '../../src/data/timeOfDay';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

/** Reproducible headless Scene Lab evidence. Run through tools/e2e-lock.sh on a private SCENE_PORT. */
const session = new SceneSession({ backend: 'webgl2', viewport: { width: 1280, height: 720 } });
const base: SceneSpec = {
  ground: 'asphalt', size: 40, camera: { mode: 'game', target: [0, 0], zoom: 1.5 },
  props: [{ asset: 'prop.street-lamp', at: [-5, 3] }, { asset: 'prop.bench', at: [6, -5] }],
  actors: [{ id: 'courier', kind: 'courier', at: [-4, 4] }, { id: 'infected', kind: 'infected', at: [5, 3], state: 'idle' }],
  frames: 180, shots: [], sheet: 60, expect: { consoleErrors: 0 },
};
const scenes: { epic: string; spec: SceneSpec }[] = Object.keys(timeOfDay).map(time => ({ epic: 'E25', spec: { ...base, name: `preset-${time}`, time: time as TimeOfDay } }));
for (const [name, blast] of Object.entries({ small: 'pipe-bomb', medium: 'propane', large: 'car', mega: 'fuel-truck', incendiary: 'molotov', toxic: 'toxic' })) {
  scenes.push({ epic: 'E27', spec: { ...base, name: `blast-${name}`, time: 'L3', frames: 900, sheet: 60, shots: [0, 2, 6, 15, 40, 180, 900], script: [{ frame: 0, effect: { blast: `explosion.${blast}`, at: [0, 0] } }] } });
}
scenes.push({ epic: 'E27', spec: { ...readSpec('specs/scenes/car-explosion.json'), name: 'car-wreck', video: 0, shots: [], sheet: 30 } });
scenes.push({ epic: 'E27', spec: { ...base, name: 'building-fire-night', time: 'night', frames: 600, sheet: 60,
  props: [...base.props!, { asset: 'bld.house-a', at: [0, -7] }], script: [{ frame: 0, effect: { hazard: 'fire', at: [0, -2], radius: 2.4 } }] } });
for (const hazard of ['toxic', 'tear-gas'] as const) scenes.push({ epic: 'E27', spec: { ...base, name: hazard, script: [{ frame: 0, effect: { hazard, at: [0, 0], radius: 3, duration: 12 } }] } });
scenes.push({ epic: 'E27', spec: { ...base, name: 'extinguisher', frames: 120, sheet: 15, script: [
  { frame: 0, effect: { hazard: 'fire', at: [0, 0], radius: 1.5 } },
  { frame: 30, effect: { hazard: 'extinguisher', at: [1, 0], trigger: 'bullet' } },
] } });
scenes.push({ epic: 'E27', spec: { ...base, name: 'smoke-grenade', frames: 1200, sheet: 60,
  actors: [{ id: 'courier', kind: 'courier', at: [-4, 4], loadout: ['weapon.pistol', 'weapon.smoke-grenade'] }, { id: 'target', kind: 'infected', at: [0, 0], state: 'idle' }],
  script: [{ frame: 5, actor: 'courier', do: { attack: 'target', side: 'RIGHT', seconds: .1 } }],
} });
scenes.push({ epic: 'E25', spec: { name: 'light-lab', ground: 'asphalt', size: 50, time: 'night', dof: false,
  props: [{ id: 'trailer', asset: 'prop.light-tower-trailer', at: [-10, 0], powerGroup: 'trailer' }, { id: 'fence', asset: 'prop.privacy-fence', at: [8, 0], scale: [1, 1, 4] }],
  actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [20, 23, 25], target: [0, 0, 0] }, frames: 120, shots: [120], sheet: 60, expect: { consoleErrors: 0 } } });
scenes.push({ epic: 'E25', spec: { name: 'reflection-lab', ground: 'asphalt', size: 50, time: 'night', weather: 'rain', weatherWarmup: 120, dof: false,
  props: [{ id: 'neon', asset: 'prop.jukebox', at: [-3, 0] }, { id: 'lamp', asset: 'prop.street-lamp', at: [3, 0] }, { asset: 'veh.sedan-green', at: [0, -4] }],
  actors: [{ id: 'courier', kind: 'courier', at: [-12, -8] }], camera: { mode: 'pose', position: [15, 18, 20], target: [0, 0, 0] }, frames: 120, shots: [120], sheet: 60, expect: { consoleErrors: 0 } } });
const results = [];
try {
  await session.open();
  for (const { epic, spec } of scenes) {
    const dir = `test-results/epics/${epic}/scene-lab/${spec.name}`;
    mkdirSync(dir, { recursive: true });
    const path = `${dir}/scene.json`; writeFileSync(path, JSON.stringify(spec, null, 2) + '\n');
    const result = await runSpec(session, spec, { file: path, out: dir });
    results.push(result); console.log(`${spec.name}: ${result.pass ? 'PASS' : 'FAIL'}`);
  }
  writeJson('test-results/epics/E27/closure/scene-lab.json', results);
  if (results.some(r => !r.pass)) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
