import { describe, expect, it } from 'vitest';
import { BoxGeometry, DirectionalLight, Mesh, MeshBasicNodeMaterial, Scene, WebGLRenderTarget } from 'three/webgpu';
import { float, normalView, positionLocal } from 'three/tsl';
import { ShadowRefresh } from '../../../src/render/ShadowRefresh';
function fixture() {
  const scene = new Scene(), light = new DirectionalLight(), mesh = new Mesh(new BoxGeometry(), new MeshBasicNodeMaterial());
  light.castShadow = mesh.castShadow = true; scene.add(light, mesh); light.shadow.map = new WebGLRenderTarget(1, 1);
  const cache = new ShadowRefresh();
  const frame = () => { scene.updateMatrixWorld(); const restore = cache.prepare(scene); const result = light.shadow.needsUpdate; light.shadow.needsUpdate = false; restore(); return result; };
  return { scene, light, mesh, cache, frame };
}
describe('exact shadow input refresh', () => {
  it('reuses stable maps, but refreshes caster, geometry, material and light changes', () => {
    const { light, mesh, frame } = fixture();
    expect(frame()).toBe(true); expect(frame()).toBe(false); expect(light.shadow.autoUpdate).toBe(true);
    mesh.position.x++; expect(frame()).toBe(true); expect(frame()).toBe(false);
    mesh.geometry.attributes.position.needsUpdate = true; expect(frame()).toBe(true);
    mesh.material.side = 2; expect(frame()).toBe(true);
    light.position.y++; expect(frame()).toBe(true);
    light.shadow.normalBias++; expect(frame()).toBe(true);
    mesh.visible = false; expect(frame()).toBe(true); expect(frame()).toBe(false);
    mesh.visible = true; expect(frame()).toBe(true);
    light.shadow.needsUpdate = true; expect(frame()).toBe(true);
  });
  it('keeps unknown shader effects dynamic and accepts the standard normal', () => {
    const { mesh, frame } = fixture(); mesh.material.normalNode = normalView;
    expect(frame()).toBe(true); expect(frame()).toBe(false);
    mesh.material.positionNode = positionLocal; expect(frame()).toBe(true); expect(frame()).toBe(true);
    mesh.material.positionNode = null; mesh.material.opacityNode = float(1); expect(frame()).toBe(true); expect(frame()).toBe(true);
  });
  it('respects explicitly managed shadow maps', () => {
    const { scene, light, cache } = fixture(); light.shadow.autoUpdate = false; light.shadow.needsUpdate = false;
    const restore = cache.prepare(scene); expect(light.shadow.autoUpdate).toBe(false); expect(light.shadow.needsUpdate).toBe(false); restore(); expect(light.shadow.autoUpdate).toBe(false);
  });
});
