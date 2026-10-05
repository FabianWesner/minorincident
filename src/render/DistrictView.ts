// Assembly/reference pattern adapted from folio-2025 World.js / References.js (Bruno Simon, MIT).
import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three/webgpu";
import type { DistrictWorld } from "../sim/world/DistrictWorld";
import type { AssetRegistry } from "../assets/registry";
import type { Materials } from "./Materials";
import { InstancedGroup } from "./InstancedGroup";
import { Grass, windPhase } from "./Grass";
import { resolvePosition } from "../levels/districts/validate";
import type { CameraPose } from "./View";

/** All district geometry is assembled before ready resolves. Static instance matrices never update per frame. */
export class DistrictView extends Group {
  readonly spots = new Map<string, CameraPose>();
  readonly batches: InstancedGroup[] = [];
  readonly windows: Mesh[] = [];
  readonly player = new Group();

  private readonly grass: Grass[] = [];
  private readonly ownedGeometry: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];
  private readonly windowMask = new MeshBasicNodeMaterial({ color: "#ffffff" });
  private readonly black = new MeshBasicNodeMaterial({ color: "#000000" });
  private readonly saved = new Map<Mesh, Material | Material[]>();
  private readonly textures: CanvasTexture[] = [];
  private readonly fireViews: Mesh[] = [];
  constructor(
    readonly world: DistrictWorld,
    private readonly materials: Materials,
    private readonly registry: AssetRegistry,
    readonly phase: ReturnType<typeof windPhase>,
    private readonly grassMaterial: ReturnType<typeof Grass.material>,
  ) {
    super();
    this.name = "sunset-grove";
  }
  async load(seed: number): Promise<void> {
    this.phase.value = 0;
    await Promise.all(
      this.world.districts.map(async (d) => {
        const root = new Group();
        root.name = d.id;
        root.position.set(d.origin[0], 0, d.origin[1]);
        this.add(root);
        const scenes = await Promise.all(
          Array.from({ length: this.world.composition.tier + 1 }, (_, tier) =>
            this.registry.glb(
              `/assets/layouts/${d.id}.${tier === 0 ? "base" : `w${tier}`}.glb`,
            ),
          ),
        );
        for (const scene of scenes) {
          const clone = scene.clone(true);
          clone.traverse((o) => {
            if (d.decay.removed.includes(o.name)) o.visible = false;
          });
          root.add(clone);
        }
        const references = new Map<string, Object3D[]>();
        const base = scenes[0];
        base.updateMatrixWorld(true);
        base.traverse((o) => {
          if (
            typeof o.userData.assetId !== "string" ||
            o.userData.minTier > this.world.composition.tier ||
            o.userData.maxTier < this.world.composition.tier
          )
            return;
          const lit = d.decay.lights.includes(o.userData.lightGroup),
            key = `${o.userData.assetId}:${lit}`;
          const reference = new Object3D();
          o.matrixWorld.decompose(
            reference.position,
            reference.quaternion,
            reference.scale,
          );
          if (!references.has(key)) references.set(key, []);
          references.get(key)!.push(reference);
        });
        await Promise.all(
          [...references].map(async ([key, refs]) => {
            const [id, power] = key.split(":"),
              prototype = await this.registry.asset(id, power === "true"),
              batch = new InstancedGroup(prototype, refs);
            batch.name = `inst:${id}`;
            this.batches.push(batch);
            root.add(batch);
            batch.traverse((o) => {
              if (o instanceof Mesh && o.name === "window-light")
                this.windows.push(o);
            });
          }),
        );
        // Dynamic nav-blockers use the same positions/extents as their Rapier colliders.
        for (const blocker of d.blockers) {
          const s = blocker.max.map((v, i) => v - blocker.min[i]),
            p = blocker.min.map((v, i) => (v + blocker.max[i]) / 2);
          this.box(
            root,
            "woodWarm",
            s as [number, number, number],
            p as [number, number, number],
          );
        }
        const grass = new Grass(d.layout, this.grassMaterial, seed);
        this.grass.push(grass);
        root.add(grass);
        for (const b of d.layout.buildings) {
          const p = d.layout.placements.find((p) => p.id === b.id)!;
          this.sign(root, b.label, [
            p.position[0],
            Math.min(3, b.aabb.max[1] * 0.6),
            b.aabb.max[2] + 0.1,
          ]);
        }
        for (const spot of d.gameplay.photoSpots) {
          const p = resolvePosition(spot.target, d.layout),
            target: [number, number, number] = [
              p[0] + d.origin[0],
              0,
              p[1] + d.origin[1],
            ];
          for (let tier = 0; tier <= 5; tier++)
            this.spots.set(`${d.id}/W${tier}/${spot.name}`, {
              target,
              position: [
                target[0] + spot.offset[0],
                spot.offset[1],
                target[2] + spot.offset[2],
              ],
            });
        }
      }),
    );
    // Runtime-only emitter placeholders; gameplay damage remains in the fixed-step sim.
    for (const f of this.world.fires) {
      for (let i = 0; i < 3; i++) {
        const geometry = new ConeGeometry(0.55, 2.4 - i * 0.4, 7),
          mesh = new Mesh(
            geometry,
            this.materials.get(
              i === 0 ? "sirenRed" : "schoolBusYellow",
              i === 0 ? 1.4 : 3,
            ),
          );
        mesh.position.set(f.x + (i - 1) * 0.45, 1.2 - i * 0.2, f.z);
        this.ownedGeometry.push(geometry);
        this.fireViews.push(mesh);
        this.add(mesh);
      }
      const geometry = new SphereGeometry(1.3, 8, 6),
        material = new MeshBasicNodeMaterial({
          color: "#443d54",
          transparent: true,
          opacity: 0.55,
        });
      this.ownedMaterials.push(material);
      for (let i = 0; i < 3; i++) {
        const mesh = new Mesh(geometry, material);
        mesh.position.set(f.x + 0.5 * i, 3 + i * 1.2, f.z);
        this.add(mesh);
      }
      this.ownedGeometry.push(geometry);
    }
    this.box(this.player, "survivorRed", [0.6, 0.7, 0.5], [0, 0.8, 0]);
    this.box(this.player, "backpackTeal", [0.3, 0.45, 0.5], [-0.4, 0.85, 0]);
    const head = new SphereGeometry(0.25, 10, 7);
    this.ownedGeometry.push(head);
    const mesh = new Mesh(head, this.materials.get("infectedSkin"));
    mesh.position.y = 1.4;
    this.player.add(mesh);
    for (const z of [-0.2, 0.2])
      this.box(this.player, "uiDark", [0.25, 0.4, 0.2], [0, 0.25, z]);
    this.add(this.player);
  }
  private box(
    root: Group,
    token: import("../data/palette").PaletteToken,
    size: [number, number, number],
    p: [number, number, number],
  ): void {
    const geometry = new BoxGeometry(...size);
    this.ownedGeometry.push(geometry);
    const mesh = new Mesh(geometry, this.materials.get(token));
    mesh.position.fromArray(p);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  /** TextCanvas pattern: one small canvas per landmark, fictional place names only. */
  private sign(root: Group, text: string, p: [number, number, number]): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffc773";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#352c38";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48, 480);
    const texture = new CanvasTexture(canvas);
    this.textures.push(texture);
    const material = new MeshBasicMaterial({ map: texture });
    this.ownedMaterials.push(material);
    const geometry = new BoxGeometry(4, 0.75, 0.06);
    this.ownedGeometry.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.fromArray(p);
    root.add(mesh);
  }
  advance(seconds: number): void {
    this.phase.value += seconds;
  }
  /** Probe-only mask; render normal view immediately afterwards so it cannot leak across frames. */
  mask(on: boolean): void {
    if (on) {
      this.traverse((o) => {
        if (o instanceof Mesh) {
          this.saved.set(o, o.material);
          o.material = this.windows.includes(o) ? this.windowMask : this.black;
        }
      });
    } else {
      for (const [mesh, material] of this.saved) mesh.material = material;
      this.saved.clear();
    }
  }
  getState() {
    return {
      districts: this.world.districts.map((d) => d.id),
      batches: this.batches.map((b) => ({
        assetId: b.name.slice(5),
        instances: b.references.length,
        meshes: b.children.filter((c) => c instanceof InstancedMesh).length,
      })),
      grassBlades: this.grass.reduce(
        (n, g) => n + g.geometry.getAttribute("position").count / 3,
        0,
      ),
      windPhase: this.phase.value,
      photoSpots: [...this.spots.keys()],
      windowMeshes: this.windows.length,
    };
  }
  dispose(): void {
    for (const b of this.batches) b.dispose();
    for (const g of this.grass) g.dispose();
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.windowMask.dispose();
    this.black.dispose();
    this.clear();
  }
}
