import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { getBounds } from '@gltf-transform/functions';
import { assetIO } from '../../tools/assets/io';
import { pushableProps } from '../../src/data/pushableProps';
import { explosionDef } from '../../src/data/explosions';

/** E26 owns movable environment props; vehicles and held pickups retain their dedicated contracts. */
test('T-E26-01 @E26 @E26-AC01 every movable prop GLB validates mass band, collider bounds, COM and explosion references', async () => {
  const io = await assetIO();
  expect(Object.keys(pushableProps).length).toBeGreaterThan(30);
  for (const [id, p] of Object.entries(pushableProps)) {
    const bytes = readFileSync(p.source), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const raw = json.nodes.find((n: { extras?: { ss_physics?: unknown } }) => n.extras?.ss_physics).extras.ss_physics;
    const authored = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(authored.class, id).toBe(p.class); expect(authored.mass, id).toBe(p.mass);
    expect(p.mass, id).toBeGreaterThan(0);
    if (p.class === 'light') expect(p.mass, id).toBeLessThanOrEqual(15);
    if (p.class === 'medium') { expect(p.mass, id).toBeGreaterThanOrEqual(15); expect(p.mass, id).toBeLessThanOrEqual(150); }
    if (p.class === 'heavy') { expect(p.mass, id).toBeGreaterThanOrEqual(150); expect(p.mass, id).toBeLessThanOrEqual(2000); }
    const doc = await io.read(p.source), visual = getBounds(doc.getRoot().listScenes()[0]);
    const min = [0, 1, 2].map(a => Math.min(...p.boxes.map(b => b.min[a]))), max = [0, 1, 2].map(a => Math.max(...p.boxes.map(b => b.max[a])));
    for (let a = 0; a < 3; a++) {
      const extent = visual.max[a] - visual.min[a];
      expect(Math.abs(min[a] - visual.min[a]) / extent, `${id} min ${a}`).toBeLessThanOrEqual(.15);
      expect(Math.abs(max[a] - visual.max[a]) / extent, `${id} max ${a}`).toBeLessThanOrEqual(.15);
      expect(p.centerOfMass![a], `${id} COM ${a}`).toBeGreaterThanOrEqual(min[a]); expect(p.centerOfMass![a], `${id} COM ${a}`).toBeLessThanOrEqual(max[a]);
    }
    if (p.explosive) expect(() => explosionDef(String(p.explosive))).not.toThrow();
  }
}, 30000);
