import { BoxGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SpotLight, Vector3, WebGPURenderer, type Material } from 'three/webgpu';
import { DynamicLighting } from 'three/addons/lighting/DynamicLighting.js';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LightField, footprint } from '../render/LightField';
import { lightPalette } from '../data/lights';

type Mode = 'field' | 'dynamic' | 'clustered';
export interface LightingSpikeResult {
  mode: Mode; lights: number; backend: string; timestampQuery: boolean;
  samples: { submitMs: number; completedMs: number; renderGpuMs: number | null; computeGpuMs: number | null }[];
  counters: { draws: number; triangles: number; geometries: number; textures: number; field: ReturnType<LightField['snapshot']> | null };
}
declare global { interface Window { __LIGHT_SPIKE__?: { ready: Promise<void>; measure(): Promise<LightingSpikeResult> } } }

/** Isolated mechanism comparison, not a replacement campaign renderer or an E18
 * level-budget fixture. Geometry, lamp positions, camera and sample count remain
 * fixed across the three options. The baseline reuses the production LightField. */
export function lightingSpike(): void {
  let measure: () => Promise<LightingSpikeResult>;
  const ready = (async () => {
    const query = new URLSearchParams(location.search), mode = query.get('mode') as Mode;
    const count = Number(query.get('lights'));
    if (!['field', 'dynamic', 'clustered'].includes(mode) || ![16, 256].includes(count)) throw new Error('Choose mode=field|dynamic|clustered and lights=16|256');
    const renderer = new WebGPURenderer({ antialias: true, trackTimestamp: true });
    if (mode === 'dynamic') renderer.lighting = new DynamicLighting({ maxPointLights: count, maxSpotLights: 1 });
    if (mode === 'clustered') renderer.lighting = new ClusteredLighting(256, 32, 24, 64);
    await renderer.init();
    renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.info.autoReset = false;
    document.body.appendChild(renderer.domElement);
    const scene = new Scene(); scene.background = new Color('#171426');
    const camera = new PerspectiveCamera(40, innerWidth / innerHeight, .1, 150);
    camera.position.set(32, 37, 40); camera.lookAt(new Vector3(0, 0, 0));
    scene.add(new HemisphereLight('#727cbd', '#3b2548', .5));
    const moon = new DirectionalLight('#aabaff', .35); moon.position.set(-15, 30, -15); scene.add(moon);
    renderer.shadowMap.enabled = true;
    const hero = new SpotLight('#fff0cb', 120, 25, Math.PI / 5, .4, 2);
    hero.position.set(-9, 8, -7); hero.target.position.set(-5, 0, -3); hero.castShadow = true;
    hero.shadow.mapSize.set(1024, 1024); scene.add(hero, hero.target);
    const field = mode === 'field' ? new LightField() : null;
    if (field) field.strength.value = 1;
    const surfaces = new Map<Material, MeshStandardNodeMaterial>();
    const shaded = (color: Color | string, emissive = false) => {
      const material = new MeshStandardNodeMaterial({ color, roughness: 1, metalness: 0, ...(emissive ? { emissive: color, emissiveIntensity: 2 } : {}) });
      if (field && !emissive) material.emissiveNode = field.sample();
      return material;
    };
    const ground = new Mesh(new PlaneGeometry(64, 64), shaded('#514460')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const [file, x, z] of [['prop.light-tower-trailer', -10, -7], ['prop.privacy-fence', 8, 0], ['veh.sedan-green', -4, 7]] as const) {
      const root = (await loader.loadAsync(`/assets/models/${file}.glb`)).scene;
      root.position.set(x, 0, z);
      root.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const convert = (source: Material) => {
          let material = surfaces.get(source);
          if (!material) {
            material = shaded((source as Material & { color: Color }).color, source.name.startsWith('emi_'));
            surfaces.set(source, material);
          }
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
        node.castShadow = node.receiveShadow = true;
      }); scene.add(root);
    }
    // Fixed occluders expose the field's 2D approximation versus analytic depth.
    for (let i = 0; i < 12; i++) {
      const box = new Mesh(new BoxGeometry(2, 2 + i % 3, 2), shaded(i % 2 ? '#be6b47' : '#5c83a0'));
      box.position.set((i % 4 - 1.5) * 8, 1 + (i % 3) / 2, (Math.floor(i / 4) - 1) * 9);
      box.castShadow = box.receiveShadow = true; scene.add(box);
    }
    const colours = ['light_window_warm', 'light_neon_blue', 'light_fire', 'light_fluorescent'] as const;
    const lamps = Array.from({ length: count }, (_, i) => {
      const side = Math.sqrt(count), x = ((i % side) / (side - 1) - .5) * 44, z = (Math.floor(i / side) / (side - 1) - .5) * 44;
      const color = colours[i % colours.length];
      if (!field) { const light = new PointLight(lightPalette[color], 20, 9, 2); light.position.set(x, 3, z); scene.add(light); }
      return footprint({ type: 'point', color, intensity: 1.8, range: 9, flicker: 'none', position: [x, 3, z], direction: [0, -1, 0] });
    });
    field?.setStatic(lamps);
    const draw = () => { renderer.info.reset(); field?.update(0, 0, 0); field?.render(renderer); renderer.render(scene, camera); };
    const finish = async () => {
      await renderer.resolveTimestampsAsync('render');
      if (mode === 'clustered') await renderer.resolveTimestampsAsync('compute');
      const device = (renderer.backend as unknown as { device: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device;
      await device.queue.onSubmittedWorkDone();
    };
    measure = async () => {
      for (let i = 0; i < 30; i++) { draw(); await finish(); }
      const samples: LightingSpikeResult['samples'] = [], timestampQuery = renderer.hasFeature('timestamp-query');
      for (let i = 0; i < 120; i++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const start = performance.now(); draw(); const submitted = performance.now(); await finish();
        samples.push({ submitMs: submitted - start, completedMs: performance.now() - start, renderGpuMs: timestampQuery ? renderer.info.render.timestamp : null, computeGpuMs: timestampQuery && mode === 'clustered' ? renderer.info.compute.timestamp : null });
      }
      return { mode, lights: count, backend: renderer.backend.constructor.name, timestampQuery, samples,
        counters: { draws: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, field: field?.snapshot() ?? null } };
    };
    draw(); await finish();
  })();
  window.__LIGHT_SPIKE__ = { ready, measure: async () => { await ready; return measure(); } };
}
