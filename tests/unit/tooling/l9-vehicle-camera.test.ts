import { expect, test } from 'vitest';
import { SceneLab } from '../../../src/debug/scenelab/SceneLab';
import { cameraFraming } from '../../../src/data/cameraFraming';
import type { Game } from '../../../src/Game';
import type { CameraPose } from '../../../src/render/View';

test('T-E31-camera-S3 @E31-AC13 vehicle matrix cameras mirror the driving pull-back at both zooms', () => {
  for (const aspect of [16 / 9, 390 / 844]) for (const zoom of [1, .5]) {
    let pose!: CameraPose;
    const view = { camera: { aspect }, polar: cameraFraming.polar, azimuth: Math.PI / 4, preset: (_name: string, next: CameraPose) => { pose = next; } };
    const lab = new SceneLab({ world: { entities: { get: () => ({ transform: { x: 10, y: 0, z: 8 } }) } }, view: { view, update: () => {} } } as unknown as Game);
    lab.vehicles.set('apc', 10);
    const radius = aspect >= 1 ? cameraFraming.radiusM : Math.max(cameraFraming.radiusM, cameraFraming.portraitWidthM / (2 * Math.tan(cameraFraming.fovDeg * Math.PI / 360) * aspect));
    for (const camera of [{ mode: 'game', target: 'apc', zoom }, { mode: 'follow', actor: 'apc', zoom }] as const) {
      lab.setCamera(camera);
      expect(Math.hypot(...pose.position.map((v, i) => v - pose.target[i]))).toBeCloseTo(radius * zoom * 1.15, 8);
    }
    lab.setCamera({ mode: 'game', target: [10, 8], zoom });
    expect(Math.hypot(...pose.position.map((v, i) => v - pose.target[i]))).toBeCloseTo(radius * zoom, 8);
  }
});
