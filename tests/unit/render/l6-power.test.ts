import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertNodeMaterial } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { DistrictView } from '../../../src/render/DistrictView';

test('L6 power failure changes uniforms without replacing or invalidating light shaders @E24', () => {
  const states = new Map<string, { material: MeshLambertNodeMaterial; power: { value: number } }>();
  const geometry = new BoxGeometry(), initial = new MeshLambertNodeMaterial();
  const entries = ['int.metro-station', 'prop.emergency-light', 'kit.shelter-camp', 'util.radio'].map(id => {
    const groups = Array.from({ length: 3 }, () => { const group = new Group(), mesh = new Mesh(geometry, initial); mesh.name = 'window-light'; group.add(mesh); return group; });
    return { id, lit: true, hero: groups[0], near: groups[1], far: groups[2] };
  });
  const materials = {
    sample: () => vec3(1),
    shaded: () => Object.assign(new MeshLambertNodeMaterial(), { seeThrough() { return this; } }),
  };
  const view = { lodBatches: entries, metroMaterials: states, materials } as unknown as DistrictView;
  DistrictView.prototype.metroPower.call(view, true, false);
  const before = entries.flatMap(e => [e.hero, e.near, e.far].map(g => (g.children[0] as Mesh).material));
  const versions = before.map(m => (m as MeshLambertNodeMaterial).version);
  DistrictView.prototype.metroPower.call(view, false, true);
  expect(states.get('int.metro-station')!.power.value).toBe(0);
  expect(states.get('prop.emergency-light')!.power.value).toBe(1);
  expect(states.get('kit.shelter-camp')!.power.value).toBe(1);
  expect(states.get('util.radio')!.power.value).toBe(1);
  const after = entries.flatMap(e => [e.hero, e.near, e.far].map(g => (g.children[0] as Mesh).material));
  after.forEach((m, i) => { expect(m).toBe(before[i]); expect((m as MeshLambertNodeMaterial).version).toBe(versions[i]); });
  DistrictView.prototype.metroPower.call(view, true, false);
  expect(states.get('int.metro-station')!.power.value).toBe(1);
  expect(states.get('prop.emergency-light')!.power.value).toBe(0);
  for (const { material } of states.values()) material.dispose(); initial.dispose(); geometry.dispose();
});
