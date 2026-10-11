import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three/webgpu';
import { AssetMaterials } from '../../../src/assets/materials';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { assetIO } from '../../../tools/assets/io';

for (const world of [false, true]) for (const glassFirst of [false, true]) {
  test(`@E09-AC10 @E25-AC11 glass and opaque paint sharing a palette token stay distinct (${world}, ${glassFirst})`, () => {
    const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
    const swap = new AssetMaterials(materials), geometry = new BoxGeometry(), root = new Group();
    root.userData.assetId = 'veh.sedan-red';
    const paintSource = new MeshStandardMaterial(), glassSource = new MeshStandardMaterial({ transparent: true, opacity: .18 });
    paintSource.name = glassSource.name = 'pal_backpackTeal';
    const paint = new Mesh(geometry, paintSource), glass = new Mesh(geometry, glassSource), second = new Mesh(geometry, glassSource);
    root.add(...(glassFirst ? [glass, paint, second] : [paint, glass, second]));
    swap.swap(root, world);
    expect(glass.material).not.toBe(paint.material);
    expect(second.material).toBe(glass.material);
    expect(glass.material).toBeInstanceOf(PaletteMaterial);
    expect((glass.material as unknown as PaletteMaterial).fade.value).toBe(.18);
    expect(glass.material.opacity).toBe(.18);
    expect(glass.material.transparent).toBe(true);
    expect(glass.material.depthWrite).toBe(false);
    expect(glass.material.forceSinglePass).toBe(true);
    expect(paint.material.transparent).toBe(false);
    expect(paint.material.depthWrite).toBe(true);
    expect((paint.material as unknown as PaletteMaterial).fade.value).toBe(1);
    materials.dispose(); lighting.dispose(); geometry.dispose(); paintSource.dispose(); glassSource.dispose();
  });
}

test('@E09-AC10 heavily tinted vehicle glazing reveals seats while other authored translucency is preserved', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), swap = new AssetMaterials(materials), geometry = new BoxGeometry();
  for (const vehicle of [false, true]) {
    const root = new Group(), source = new MeshStandardMaterial({ transparent: true, opacity: .88 });
    source.name = 'pal_asphalt'; root.userData.assetId = vehicle ? 'veh.police-sedan' : 'prop.bench';
    const pane = new Mesh(geometry, source); root.add(pane); swap.swap(root, true);
    expect(pane.material.opacity).toBe(vehicle ? .25 : .88);
    expect((pane.material as unknown as PaletteMaterial).fade.value).toBe(vehicle ? .25 : .88);
    source.dispose();
  }
  materials.dispose(); lighting.dispose(); geometry.dispose();
});

test('T-E09-01-glass @E09-AC01 @E20-AC05 delivered cabin tiers retain translucent glazing and distinct seated hip anchors', async () => {
  const io = await assetIO();
  for (const id of ['fire-engine', 'school-bus']) {
    let baseSeats: number[][] | undefined;
    for (const tier of ['', '.lod1', '.lod2']) {
      const doc = await io.read(`public/assets/models/veh.${id}${tier}.glb`);
      const glass = doc.getRoot().listMaterials().filter(m => m.getAlphaMode() === 'BLEND');
      expect(glass.length).toBeGreaterThan(0);
      expect(glass.every(m => m.getBaseColorFactor()[3] > 0 && m.getBaseColorFactor()[3] < .4)).toBe(true);
      const names = ['driverSeat', ...(id === 'fire-engine' ? Array.from({ length: 6 }, (_, i) => `crewSeat${i}`) : ['passengerSeat0L', 'passengerSeat0R'])];
      const seats = names.map(name => {
        const node = doc.getRoot().listNodes().find(n => n.getName() === name);
        expect(node, `${id}${tier}/${name}`).toBeDefined();
        return node!.getWorldTranslation();
      });
      for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
        expect(Math.hypot(seats[i][0] - seats[j][0], seats[i][2] - seats[j][2])).toBeGreaterThan(.45);
      }
      if (baseSeats) seats.forEach((seat, i) => seat.forEach((value, axis) => expect(value).toBeCloseTo(baseSeats![i][axis], 2)));
      else baseSeats = seats;
      expect(doc.getRoot().listNodes().some(n => n.getName() === 'steeringWheel')).toBe(true);
    }
  }
});
