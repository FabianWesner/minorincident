import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { GameView } from '../../../src/render/GameView';
import { labAccidentTargets } from '../../../src/render/vfx/labAccidentView';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

vi.mock('../../../src/render/Renderer', () => ({ Renderer: class {
  shadowMap = { enabled: false };
  releaseLevelCaches = vi.fn();
} }));

afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('@E18-AC05 @E24-AC19 unloading L1 releases its window targets even after the accident effects have retired', () => {
  vi.useFakeTimers(); vi.stubGlobal('document', { createElement: () => ({ style: {} }) });
  const view = new GameView({} as SimWorld, new URLSearchParams());
  const building = new Group(); building.name = 'inst:bld.clinic-annex'; view.scene.add(building);
  const geometry = new BoxGeometry(), original = new MeshBasicNodeMaterial(), window = new Mesh(geometry, original);
  window.name = 'window-light'; building.add(window);
  const targets = labAccidentTargets(view.scene, () => {});
  const restore = targets.prewarmWindows();
  const owned = building.children.filter(node => node !== window).map(node => (node as Mesh).material as MeshBasicNodeMaterial);
  expect(owned).toHaveLength(3);
  const disposed = owned.map(material => vi.spyOn(material, 'dispose'));
  restore(); targets.windowLight!(1);
  const state = view as unknown as { labWindows: typeof targets | null; labAccident: unknown };
  state.labWindows = targets;
  expect(state.labAccident).toBeNull();
  try {
    view.reset();
    expect(state.labWindows, 'the persistent GameView must drop the retired level owner').toBeNull();
    for (const dispose of disposed) expect(dispose).toHaveBeenCalledTimes(1);
    view.reset();
    for (const dispose of disposed) expect(dispose).toHaveBeenCalledTimes(1);
    targets.windowFire!(1); const unwarm = targets.prewarmWindows();
    expect(building.children).toEqual([window]); unwarm();
  } finally { geometry.dispose(); original.dispose(); }
});
