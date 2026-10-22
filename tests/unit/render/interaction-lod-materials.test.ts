import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, Scene, Vector3, type Material } from 'three/webgpu';
import { InteractionView } from '../../../src/render/InteractionView';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import type { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { View } from '../../../src/render/View';
import type { AssetRegistry } from '../../../src/assets/registry';

afterEach(() => vi.unstubAllGlobals());

test('T-E22-20-interaction-materials @E22-AC20 equivalent interaction LODs retain the warmed palette graph', async () => {
  const element = () => ({ style: {}, dataset: {}, append() {}, setAttribute() {}, remove() {} });
  vi.stubGlobal('document', { createElement: element, querySelector: element });
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), geometry = new BoxGeometry();
  const world = { scenario: 'L4' } as SimWorld;
  const view = new InteractionView(world, materials, { cameraTarget: new Vector3() } as View);
  const internal = view as unknown as { registry: AssetRegistry; create(entity: EntitySnapshot, lod: string): Promise<Group> };
  vi.spyOn(internal.registry, 'definition').mockReturnValue({ lods: { lod1: {}, lod2: {} } } as ReturnType<AssetRegistry['definition']>);
  vi.spyOn(internal.registry, 'loadAsset').mockImplementation(async () => {
    const root = new Group(); root.userData.assetId = 'prop.picket-fence';
    root.add(new Mesh(geometry, materials.get('picketWhite'))); return root;
  });
  const entity = { archetype: 'prop.fence' } as EntitySnapshot;
  const material = (root: Group) => (root.getObjectByName('static-body') as Mesh).material as PaletteMaterial;
  try {
    const far = material(await internal.create(entity, 'lod2'));
    const near = material(await internal.create(entity, 'lod1'));
    expect(near === far, 'a LOD change must borrow the already warmed feature graph').toBe(true);
    const disposed = vi.spyOn(far as Material, 'dispose');
    view.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
  } finally { geometry.dispose(); materials.dispose(); lighting.dispose(); }
});
