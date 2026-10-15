import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Scene } from 'three/webgpu';
import { WeatherSystem } from '../../../src/sim/weather/WeatherSystem';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { WeatherView, weatherSurface } from '../../../src/render/WeatherView';
import { Lighting } from '../../../src/render/Lighting';
import { View } from '../../../src/render/View';
import { rasterFootprints, TRACK_LIFETIME } from '../../../src/render/FootprintMask';
import { installTextureRanges } from '../../../src/render/TextureRanges';

test('partial track uploads reproduce every mask byte through fading, recentering, clearing and expiry', () => {
  for (const [scenario, tier] of [['L5', 'high'], ['L7', 'low'], ['L3', 'low']] as const) {
    const world = { scenario, tick: 0, entities: { get: () => undefined }, events: { on: () => () => {} } } as unknown as SimWorld;
    world.weather = new WeatherSystem(world, 2);
    const lighting = new Lighting(new Scene()), weather = new WeatherView(world, lighting), view = new View();
    const texture = weatherSurface.tracks, resource = { textureGPU: {}, glTextureType: 1, glFormat: 2, glType: 3 };
    let gpu = new Uint8Array(0), uploadedVersion = -1;
    const original = vi.fn((...args: unknown[]) => { gpu = ((args[0] as typeof texture).image.data as Uint8Array).slice(); });
    const upload = vi.fn((_target: number, _level: number, _x: number, y: number, width: number, _height: number, _format: number, _type: number, bytes: Uint8Array) => { gpu.set(bytes, y * width * 4); });
    const backend = { updateTexture: original, get: () => resource, gl: { texSubImage2D: upload }, state: { bindTexture: vi.fn() }, textureUtils: { setTextureParameters: vi.fn() } };
    installTextureRanges(backend);
    const disposed = () => { resource.textureGPU = {}; }; texture.addEventListener('dispose', disposed);
    const track = { id: 1, x: 0, y: 0, z: 0, yaw: .7, tick: 0, length: .28, paw: false, side: -1 };
    try {
      for (const [tick, x, z, tracks] of [
        [0, 0, 0, [track, { ...track, y: 3.9 }]],
        [6, 0, 0, [track, { ...track, y: 3.9 }]],
        [120, 4, -4, [track, { ...track, y: 3.9 }]],
        [180, 0, 0, [track]],
        [TRACK_LIFETIME, 0, 0, [track]],
        [TRACK_LIFETIME + 6, 0, 0, [{ ...track, x: 64 }]],
      ] as const) {
        world.tick = tick; view.focus.set(x, 0, z); world.weather.tracks.splice(0, Infinity, ...tracks);
        weather.update(view, tier, false);
        const expected = new Uint8Array((texture.image.data as Uint8Array).length);
        rasterFootprints(expected, world.weather.tracks, tick, x, z);
        if (texture.version !== uploadedVersion) { backend.updateTexture(texture, {}); uploadedVersion = texture.version; }
        expect(createHash('sha256').update(gpu).digest('hex')).toBe(createHash('sha256').update(expected).digest('hex'));
      }
      expect(original).toHaveBeenCalledTimes(1); expect(upload.mock.calls.length).toBeGreaterThan(0);
      expect(Math.max(...upload.mock.calls.map(c => c[8].byteLength))).toBeLessThan(gpu.byteLength / 4);
      const version = texture.version; world.tick += 6; weather.update(view, tier, false);
      expect(texture.version).toBe(version); // All tracks are outside the window; mask remains identical.
    } finally { texture.removeEventListener('dispose', disposed); weather.dispose(); lighting.dispose(); }
  }
});
