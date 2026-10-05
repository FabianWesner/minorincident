import {
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  SphereGeometry,
  Shape,
  type BufferGeometry,
} from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PaletteToken } from "../data/palette";
import type { Materials } from "../render/Materials";
import type { WorldAssetDef } from "./worldDefinitions";
/** Correct-scale code assets until art is integrated. Merge each palette group before instancing. */
export function placeholder(
  def: WorldAssetDef,
  materials: Materials,
  lit = true,
): Group {
  const { x, y, z } = def.dimensions,
    root = new Group(),
    parts = new Map<
      string,
      {
        token: PaletteToken;
        emissive: number;
        window: boolean;
        geometries: BufferGeometry[];
      }
    >();
  const add = (
    token: PaletteToken,
    g: BufferGeometry,
    p: [number, number, number],
    emissive = 0,
    window = false,
  ) => {
    g.translate(...p);
    const key = `${token}:${emissive}:${window}`;
    if (!parts.has(key))
      parts.set(key, { token, emissive, window, geometries: [] });
    parts.get(key)!.geometries.push(g);
  };
  const box = (
    token: PaletteToken,
    size: [number, number, number],
    p: [number, number, number],
    emissive = 0,
    window = false,
  ) =>
    add(
      token,
      new RoundedBoxGeometry(...size, 1, Math.min(...size, 0.2) * 0.15),
      p,
      emissive,
      window,
    );
  const glow = lit ? "windowGlow" : "backpackTeal",
    power = lit ? 2 : 0,
    token = def.world.token;
  if (def.category === "building") {
    const house = def.id.startsWith("bld.house") || def.id === "bld.park-lodge";
    box(token, [x, y * 0.65, z * 0.94], [0, y * 0.325, 0]);
    if (house) {
      const shape = new Shape();
      shape.moveTo(-x / 2, 0);
      shape.lineTo(0, y * 0.35);
      shape.lineTo(x / 2, 0);
      shape.closePath();
      add(
        "brick",
        new ExtrudeGeometry(shape, { depth: z, bevelEnabled: false }),
        [0, y * 0.65, -z / 2],
      );
      box("picketWhite", [x * 0.55, 0.16, z * 0.2], [0, 0.12, z * 0.45]);
      for (const xx of [-x * 0.22, x * 0.22])
        box("picketWhite", [0.18, y * 0.4, 0.18], [xx, y * 0.2, z * 0.45]);
    } else {
      box("uiDark", [x, 0.3, z], [0, y - 0.15, 0]);
      box("picketWhite", [x * 0.96, 0.25, z * 0.97], [0, y * 0.7, 0]);
    }
    for (const xx of [-x * 0.27, x * 0.27]) {
      box("picketWhite", [x * 0.23, y * 0.23, 0.12], [xx, y * 0.4, z * 0.47]);
      box(glow, [x * 0.2, y * 0.2, 0.05], [xx, y * 0.4, z * 0.48], power, true);
    }
    box("woodWarm", [x * 0.14, y * 0.4, 0.14], [0, y * 0.2, z * 0.47]);
    // Side windows make the high 3/4 silhouettes readable in both orientations.
    for (const zz of [-z * 0.25, z * 0.25])
      box(
        glow,
        [0.06, y * 0.2, z * 0.22],
        [x * 0.48, y * 0.4, zz],
        power,
        true,
      );
  } else if (def.category === "vehicle") {
    const wreck = def.id === "veh.wreck";
    box(token, [x * 0.94, y * 0.4, z * 0.95], [0, y * 0.4, 0]);
    box("backpackTeal", [x * 0.45, y * 0.35, z * 0.8], [-x * 0.06, y * 0.7, 0]);
    box(token, [x * 0.46, 0.1, z * 0.85], [-x * 0.06, y * 0.94, 0]);
    for (const xx of [-x * 0.28, x * 0.28])
      for (const zz of [-z * 0.44, z * 0.44]) {
        const g = new CylinderGeometry(y * 0.22, y * 0.22, z * 0.15, 10);
        g.rotateX(Math.PI / 2);
        add("uiDark", g, [xx, y * 0.22, zz]);
      }
    if (!wreck)
      for (const zz of [-z * 0.28, z * 0.28])
        box(
          "windowGlow",
          [0.05, 0.2, 0.25],
          [x * 0.47, y * 0.45, zz],
          lit ? 1 : 0,
        );
  } else if (def.id === "prop.tree") {
    add("woodWarm", new CylinderGeometry(0.15, 0.3, y * 0.55, 8), [
      0,
      y * 0.275,
      0,
    ]);
    for (const [dx, dy, dz, r] of [
      [0, y * 0.7, 0, x * 0.47],
      [-x * 0.22, y * 0.64, 0.2, x * 0.3],
      [x * 0.23, y * 0.7, -0.2, x * 0.3],
    ])
      add("foliage", new SphereGeometry(r, 10, 7), [dx, dy, dz]);
  } else if (def.id === "prop.flower") {
    add("foliage", new CylinderGeometry(0.025, 0.035, 0.35, 6), [0, 0.175, 0]);
    add("schoolBusYellow", new SphereGeometry(0.15, 8, 6), [0, 0.4, 0]);
  } else if (def.id === "prop.hedge") {
    add("foliage", new SphereGeometry(0.5, 10, 7).scale(x, y, z), [
      0,
      y / 2,
      0,
    ]);
  } else if (def.id === "prop.picket-fence") {
    for (const zz of [-z * 0.4, -z * 0.2, 0, z * 0.2, z * 0.4])
      box("picketWhite", [x, y, 0.13], [0, y / 2, zz]);
    for (const yy of [y * 0.3, y * 0.7])
      box("picketWhite", [x * 0.8, 0.12, z], [0, yy, 0]);
  } else if (def.id === "prop.street-lamp") {
    add("uiDark", new CylinderGeometry(0.065, 0.1, y - 0.2, 8), [
      0,
      (y - 0.2) / 2,
      0,
    ]);
    box("uiDark", [x, 0.1, 0.12], [x * 0.3, y - 0.2, 0]);
    add(
      glow,
      new SphereGeometry(0.17, 8, 6),
      [x * 0.7, y - 0.25, 0],
      lit ? 4 : 0,
    );
  } else if (def.id === "prop.traffic-cone") {
    box("uiDark", [x, 0.1, z], [0, 0.05, 0]);
    add("schoolBusYellow", new ConeGeometry(x * 0.4, y - 0.1, 8), [
      0,
      (y + 0.1) / 2,
      0,
    ]);
    box("picketWhite", [x * 0.5, 0.15, z * 0.5], [0, y * 0.5, 0]);
  } else if (def.id === "prop.picnic-table") {
    box(token, [x, 0.15, z * 0.7], [0, y - 0.1, 0]);
    for (const xx of [-x * 0.3, x * 0.3])
      box(token, [0.2, y, 0.2], [xx, y / 2, 0]);
    for (const zz of [-z * 0.43, z * 0.43])
      box(token, [x, 0.15, 0.3], [0, y * 0.5, zz]);
  } else if (def.id === "prop.tent") {
    const shape = new Shape();
    shape.moveTo(-x / 2, 0);
    shape.lineTo(0, y);
    shape.lineTo(x / 2, 0);
    shape.closePath();
    add(token, new ExtrudeGeometry(shape, { depth: z, bevelEnabled: false }), [
      0,
      0,
      -z / 2,
    ]);
  } else if (def.id === "prop.bus-stop") {
    box(token, [x, 0.18, z], [0, y - 0.09, 0]);
    for (const xx of [-x * 0.45, x * 0.45])
      box("uiDark", [0.14, y, 0.14], [xx, y / 2, 0]);
    box("woodWarm", [x * 0.8, 0.15, z * 0.6], [0, 0.65, 0]);
  } else {
    box(token, [x, y, z], [0, y / 2, 0]);
    box("uiDark", [x * 0.7, y * 0.25, 0.06], [0, y * 0.7, z / 2]);
  }
  for (const { token, emissive, window, geometries } of parts.values()) {
    // Primitive attribute layouts are normalized before merging (extrudes may omit UVs).
    for (const g of geometries) {
      if (!g.getAttribute("normal")) g.computeVertexNormals();
    }
    const source = geometries.map((g) => (g.index ? g.toNonIndexed() : g)),
      g = mergeGeometries(source, false)!;
    for (const geometry of new Set([...geometries, ...source]))
      geometry.dispose();
    const mesh = new Mesh(g, materials.get(token, emissive));
    mesh.name = window ? "window-light" : `pal_${token}`;
    mesh.castShadow = emissive === 0;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
