import { SceneSession, stopServer } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
const session = new SceneSession();
try {
  await session.open();
  await session.page.evaluate(async () => {
    const path = '/src/data/vehicles.ts';
    const module = await import(/* @vite-ignore */ path);
    module.vehicleDef('vehicle.sedan').asset = 'veh.sedan-green';
  });
  for (const mode of ['game', 'close'] as const) {
    const result = await runSpec(session, { name: `runtime-${mode}`, ground: 'asphalt', size: 35,
      vehicles: [{ id: 'normal', asset: 'vehicle.sedan', at: [0,-5] }, { id: 'wrecked', asset: 'vehicle.sedan', at: [0,0], decay: 'wrecked' }, { id: 'burned', asset: 'vehicle.sedan', at: [0,5], decay: 'burned' }],
      camera: mode === 'game' ? { mode, target: [0,0], zoom: 1.4 } : { mode, target: [0,.8,0], radius: 23, azimuth: 135 }, frames: 1, shots: [1], expect: { consoleErrors: 0 } }, { out: `${process.argv[2]}/runtime-${mode}`, openMs: 0 });
    if (!result.pass) throw Error(JSON.stringify(result.failed));
  }
} finally { await session.close(); stopServer(); }
