import { BoxGeometry, Color, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer } from 'three/webgpu';
import type { Lifecycle } from '../core/Lifecycle';
import { lerp } from '../core/maths';
import type { SimWorld } from '../sim/world/SimWorld';
import { MeshGridMaterial } from './MeshGridMaterial';
import { PhysicsWireframe } from './PhysicsWireframe';

/** E01 presentation only: plane + debug cube, with state flowing from sim to view. */
export class GameView implements Lifecycle {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(35, 1, 0.1, 250);
  readonly renderer: WebGPURenderer;
  private readonly meshes: Mesh[] = [];
  private cube: Mesh | null = null;
  private wireframe: PhysicsWireframe | null = null;
  constructor(private readonly world: SimWorld, private readonly params: URLSearchParams) {
    this.renderer = new WebGPURenderer({ antialias: true, forceWebGL: params.get('renderer') === 'webgl' });
    this.scene.background = new Color('#293447');
    this.camera.position.set(12, 12, 12); this.camera.lookAt(0, 0, 0);
  }
  async init(): Promise<void> {
    await this.renderer.init(); this.resize();
    this.renderer.domElement.style.display = 'block';
    document.querySelector('#game')!.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.resize);
  }
  private readonly resize = (): void => {
    const dpr = Number(this.params.get('dpr') ?? Math.min(devicePixelRatio, 2));
    this.renderer.setPixelRatio(Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  };
  async load(): Promise<void> {
    this.reset();
    const ground = new Mesh(new PlaneGeometry(100, 100), new MeshGridMaterial());
    ground.rotation.x = -Math.PI / 2;
    this.cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicNodeMaterial({ color: '#ed935c' }));
    this.meshes.push(ground, this.cube); this.scene.add(...this.meshes);
    if (import.meta.env.DEV && this.params.has('debug')) {
      this.wireframe = new PhysicsWireframe(this.world.physics); this.scene.add(this.wireframe.lines);
    }
    await this.renderer.compileAsync(this.scene, this.camera);
    this.update(1);
  }
  update(alpha = 1): void {
    const current = this.world.getEntity(1)?.transform, previous = this.world.previousPlayer;
    if (this.cube && current) {
      this.cube.position.set(lerp(previous?.x ?? current.x, current.x, alpha), lerp(previous?.y ?? current.y, current.y, alpha), lerp(previous?.z ?? current.z, current.z, alpha));
      this.cube.rotation.y = current.yaw;
    }
    this.wireframe?.update();
    // We own RAF, so reset counters per render rather than relying on setAnimationLoop.
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }
  reset(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh); mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
    this.meshes.length = 0; this.cube = null;
    if (this.wireframe) { this.scene.remove(this.wireframe.lines); this.wireframe.dispose(); this.wireframe = null; }
  }
  dispose(): void { this.reset(); window.removeEventListener('resize', this.resize); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
