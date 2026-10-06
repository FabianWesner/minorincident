import { AmbientLight, Color, DirectionalLight, GridHelper, Group, Mesh, MeshLambertNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, SkinnedMesh, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LibraryAnimator } from './LibraryAnimator';
import { strideScale } from '../../render/characters/clips';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { Renderer } from '../../render/Renderer';
import { AssetRegistry } from '../../assets/registry';
import { Physics } from '../../physics/Physics';
import { KinematicController } from '../../sim/locomotion/KinematicController';
import type { AnimationAction } from 'three';
import { characterNodes, type SurvivorState } from '../../data/survivor';
import { emptyInput } from '../../input/InputFrame';
import { KeyframeAnimator } from '../../render/characters/KeyframeAnimator';
import type { CharacterRig } from '../../render/characters/rig';
import { skinFigure } from './Skin';
import { LabCrowd } from './Crowd';
import { angleDelta, dt, intent, motion, percentile, rootMetrics, steer, type Motion } from './Motion';

interface Side {
  scene: Scene; hero: Group; animator: KeyframeAnimator | LibraryAnimator; civilian: LabCrowd; crowd: LabCrowd;
  physics: Physics; controller: KinematicController; transform: { x: number; y: number; z: number; yaw: number };
  states: Motion[]; heroMotion: Motion; traces: { x: number; z: number; yaw: number }[][];
  drawCalls: number; triangles: number; updateMs: number[]; submitMs: number[]; frameMs: number[]; gpuMs: number[];
  footSlide: number[]; pops: number[]; npcFoot: number[][]; npcPops: number[][]; lastNpcFoot: Vector3[]; lastNpcHead: Vector3[]; lastSpeed: number[]; lastFoot?: Vector3; lastHead?: Vector3; lastClip: string; transitionTick: number;
}
export async function startMotionLab(params: URLSearchParams): Promise<void> {
  const count = Math.max(50, Math.min(200, Number(params.get('count')) || 200));
  const skins = params.get('candidate') === 'skin';
  const close = params.get('view') === 'close', only = params.get('side');
  const host = document.querySelector<HTMLElement>('#game')!;
  const style = document.createElement('style'); style.textContent = 'body{font:14px system-ui;color:#fff}#lab-ui{position:absolute;inset:12px 12px auto;background:#172137e8;border-radius:12px;padding:12px;z-index:2}#lab-ui a{color:#91e8dc;margin-right:12px}#lab-labels{display:flex;justify-content:space-around;margin-top:10px;font-weight:bold}#lab-status{font-size:12px;color:#cee0ea;margin-top:6px}'; document.head.append(style);
  const ui = document.createElement('div'); ui.id = 'lab-ui'; ui.innerHTML = '<strong>Minor Incident · Motion lab</strong><div><a href="?motionlab&renderer=webgl&view=close&count=50">Figures</a><a href="?motionlab&renderer=webgl&view=close&count=50&candidate=mesh2motion">Mesh2Motion</a><a href="?motionlab&renderer=webgl&count=50">50 infected</a><a href="?motionlab&renderer=webgl&count=200">200 infected</a><button id="lab-pause">Pause</button></div><div id="lab-labels"><span>Reference · abrupt NPC steering + raw keyboard</span><span>Stage 1 · bounded navigation + rigid pose fades</span></div><div id="lab-status">Loading actual game assets…</div>'; host.append(ui);
  const renderer = new Renderer(params); (renderer.backend as unknown as { trackTimestamp: boolean }).trackTimestamp = true; await renderer.init(); renderer.setPixelRatio(1); host.append(renderer.domElement);
  const registry = new AssetRegistry(event => { throw new Error(JSON.stringify(event)); });
  const [survivor, civilian, infected] = await Promise.all(['char.survivor-female', 'npc.civilian-man-a', 'inf.jogger'].map(id => registry.loadAsset(id, 'lod1') as Promise<Group>));
  const mesh2motion = params.get('candidate') === 'mesh2motion' ? await new GLTFLoader().loadAsync('/assets/motionlab/survivor-mesh2motion.glb') : undefined;
  if (mesh2motion) document.querySelector('#lab-labels span:last-child')!.textContent = 'Mesh2Motion · fitted template + CC0 library';
  const sides: Side[] = [];
  for (const prototype of [false, true]) {
    const scene = new Scene(); scene.background = new Color('#bac4c8'); scene.add(new AmbientLight('#d5d0ee', 1.7));
    const light = new DirectionalLight('#fff2d5', 2.7); light.position.set(-5, 12, 7); scene.add(light);
    const ground = new Mesh(new PlaneGeometry(100, 100), new MeshLambertNodeMaterial({ color: '#7e9a85' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new GridHelper(60, 60, '#748d89', '#92aaa1'); grid.position.y = .004; scene.add(grid);
    const heroModel = prototype ? mesh2motion ? cloneSkeleton(mesh2motion.scene) as Group : skins ? skinFigure(survivor.clone(true)) : survivor.clone(true) : survivor.clone(true);
    if (mesh2motion && prototype) heroModel.traverse(node => { if (node instanceof Mesh) { const original = (Array.isArray(node.material) ? node.material[0] : node.material) as MeshLambertNodeMaterial; node.material = new MeshLambertNodeMaterial({ color: original.color, vertexColors: original.vertexColors }); } });
    // Exercise the official safe cloning route; geometry/material may be shared.
    const hero = new Group(); hero.add(prototype ? cloneSkeleton(heroModel) : heroModel); scene.add(hero);
    const rig = Object.fromEntries(characterNodes.map(name => [name, hero.getObjectByName(name)!])) as CharacterRig;
    const animator = prototype && mesh2motion ? new LibraryAnimator(hero.children[0], mesh2motion.animations, .9 * strideScale(survivor)) : new KeyframeAnimator(rig);
    const civ = new LabCrowd(prototype && skins ? skinFigure(civilian.clone(true)) : civilian.clone(true), 1, prototype, true);
    const crowd = new LabCrowd(prototype && skins ? skinFigure(infected.clone(true)) : infected.clone(true), count, prototype);
    scene.add(civ.mesh, crowd.mesh);
    const physics = new Physics(); await physics.init(); physics.load({ name: 'motion-lab', survivor: true, ground: { width: 100, depth: 100 }, player: { x: 0, y: .7, z: 0 } });
    sides.push({ scene, hero, animator, civilian: civ, crowd, physics, controller: new KinematicController(physics), transform: { x: 0, y: .7, z: 0, yaw: 0 }, states: Array.from({ length: count + 1 }, motion), heroMotion: motion(), traces: Array.from({ length: 3 }, () => []), drawCalls: 0, triangles: 0, updateMs: [], submitMs: [], frameMs: [], gpuMs: [], footSlide: [], pops: [], npcFoot: [[], []], npcPops: [[], []], lastNpcFoot: [], lastNpcHead: [], lastSpeed: [], lastClip: 'idle', transitionTick: 0 });
  }
  const camera = new OrthographicCamera(); let tick = 0, paused = params.get('paused') === '1', raf = 0, last = 0, accumulated = 0, disposed = false;
  const status = document.querySelector('#lab-status')!;
  const pose: SurvivorState = { variant: 'female', gearTier: 0, animation: 'idle', animationTick: 0, velocity: { x: 0, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: .7, z: 0 }, diedAt: null };
  const input = emptyInput(), foot = new Vector3(), head = new Vector3();
  function update(): void {
    tick++;
    const command = intent(tick);
    for (let s = 0; s < sides.length; s++) {
      if (only && (only === 'current' ? s !== 0 : s !== 1)) continue;
      const side = sides[s], start = performance.now(), h = side.heroMotion;
      const beforeX = side.transform.x, beforeZ = side.transform.z;
      input.move = command; input.navigation = s === 1; side.controller.move(input, side.transform, true); side.physics.update(); Object.assign(side.transform, side.physics.playerBody!.translation());
      h.x = side.transform.x; h.z = side.transform.z; h.yaw = side.transform.yaw; h.vx = (h.x - beforeX) / dt; h.vz = (h.z - beforeZ) / dt; h.speed = Math.hypot(h.vx, h.vz); h.distance += h.speed * dt;
      for (let i = 0; i < side.states.length; i++) steer(side.states[i], command, i === 0 ? 1.4 : 2.4, s === 1, i === 0);
      side.hero.position.set(h.x - 5, side.transform.y - .7, h.z); side.hero.rotation.y = h.yaw;
      pose.velocity = { x: h.vx, z: h.vz }; pose.animation = h.speed > 2.5 ? 'run' : h.speed > .06 ? 'walk' : 'idle'; if (side.animator instanceof KeyframeAnimator) side.animator.update(pose, tick); else side.animator.update(pose);
      const civ = side.states[0]; side.civilian.update([civ], [new Vector3(civ.x, 0, civ.z)], 'civilian');
      const crowdStates = close ? side.states.slice(1, 2) : side.states.slice(1);
      side.crowd.update(crowdStates, crowdStates.map((m, i) => new Vector3(m.x + (close ? 5 : (i % 20 - 9.5) * 1.5), 0, m.z + (close ? 0 : Math.floor(i / 20) * 1.8 + 5))));
      for (const [index, state] of [h, civ, side.states[1]].entries()) side.traces[index].push({ x: state.x, z: state.z, yaw: state.yaw });
      for (const [n, batch] of [side.civilian, side.crowd].entries()) {
        const state = side.states[n], foot = batch.landmark(0, 'footL'), head = batch.landmark(0, 'head', false), lastSpeed = side.lastSpeed[n] ?? 0;
        const changed = (lastSpeed < .06) !== (state.speed < .06) || (lastSpeed > 2) !== (state.speed > 2);
        if (side.lastNpcFoot[n] && state.speed > .2 && batch.supportPhase(state) < .45 && !changed && Math.abs(angleDelta(side.traces[n+1].at(-2)?.yaw ?? state.yaw, state.yaw)) < .001) side.npcFoot[n].push(foot.distanceTo(side.lastNpcFoot[n]) / dt);
        if (changed && side.lastNpcHead[n]) side.npcPops[n].push(head.distanceTo(side.lastNpcHead[n]));
        side.lastNpcFoot[n] = foot; side.lastNpcHead[n] = head; side.lastSpeed[n] = state.speed;
      }
      side.hero.updateMatrixWorld(true);
      const root = side.hero.children[0]; root.getObjectByName(s === 1 && mesh2motion ? 'foot_l' : 'footL')!.getWorldPosition(foot); root.getObjectByName('head')!.getWorldPosition(head);
      // Ankle landmark during steady straight support; exclude clip blends and turns.
      if (side.lastClip !== side.animator.clip) { side.transitionTick = tick; side.lastClip = side.animator.clip; }
      // Measurement probe only: r186's evaluated action phase, not total distance
      // divided by a single stride after transitions between walk and run.
      const actions = (side.animator.mixer as unknown as { _actions: AnimationAction[] })._actions;
      const action = actions.find(a => a.getClip().name === side.animator.clip);
      const phase = action ? action.time / action.getClip().duration : 0;
      if (side.lastFoot && h.speed > .2 && ['walk','run','Walk','Jog'].includes(side.animator.clip) && phase < .4 && tick - side.transitionTick > 15 && Math.abs(angleDelta(side.traces[0].at(-2)?.yaw ?? h.yaw, h.yaw)) < .001) side.footSlide.push(foot.distanceTo(side.lastFoot) / dt);
      if (side.lastHead && tick === side.transitionTick) side.pops.push(head.clone().sub(side.hero.position).distanceTo(side.lastHead));
      side.lastFoot = foot.clone(); side.lastHead = head.clone().sub(side.hero.position);
      side.updateMs.push(performance.now() - start);
    }
  }
  function render(): void {
    const width = innerWidth, height = innerHeight, selected = only === 'current' ? [0] : only === 'prototype' ? [1] : [0, 1];
    renderer.setSize(width, height); renderer.setScissorTest(true);
    for (const [slot, index] of selected.entries()) {
      const side = sides[index], w = width / selected.length, extent = close ? 9 : 20;
      camera.left = -extent * w / height; camera.right = extent * w / height; camera.top = extent; camera.bottom = -extent; camera.near = .1; camera.far = 150; camera.updateProjectionMatrix();
      const m = side.states[1], cx = close ? (side.heroMotion.x + side.states[0].x + m.x) / 3 : m.x, cz = close ? (side.heroMotion.z + side.states[0].z + m.z) / 3 : m.z + 13;
      camera.position.set(cx - 12, 22, cz + 24); camera.lookAt(cx, .7, cz);
      renderer.setViewport(slot * w, 0, w, height); renderer.setScissor(slot * w, 0, w, height); renderer.info.reset();
      const start = performance.now(); renderer.render(side.scene, camera); side.submitMs.push(performance.now() - start); side.drawCalls = renderer.info.render.drawCalls; side.triangles = renderer.info.render.triangles;
    }
    status.textContent = `Tick ${tick} · ${count} infected · ${renderer.selectedBackend} · same 60 Hz start/turn/stop input · production motion limits and rigid pose fades; optional skin studies deferred`;
  }
  function metrics() {
    return Object.fromEntries(sides.map((side, i) => [i ? 'prototype' : 'current', {
      roots: Object.fromEntries(side.traces.map((trace, n) => [['survivor', 'civilian', 'infected'][n], rootMetrics(trace)])),
      heroAnkleStanceDriftP95Mps: side.footSlide.length ? percentile(side.footSlide, .95) : null, heroAnkleSamples: side.footSlide.length,
      heroTransitionLandmarkPeakM: Math.max(0, ...side.pops),
      npcAnkleStanceDriftP95Mps: side.npcFoot.map(values => percentile(values, .95)), npcAnkleSamples: side.npcFoot.map(values => values.length),
      npcTransitionHeadPopPeakM: side.npcPops.map(values => Math.max(0, ...values)),
      updateMsP50: percentile(side.updateMs.slice(120), .5), updateMsP95: percentile(side.updateMs.slice(120), .95),
      renderSubmitMsP50: percentile(side.submitMs.slice(120), .5), renderSubmitMsP95: percentile(side.submitMs.slice(120), .95),
      frameMsP95: percentile(side.frameMs.slice(120), .95), gpuMsP95: side.gpuMs.length ? percentile(side.gpuMs, .95) : null,
      drawCalls: side.drawCalls, triangles: side.triangles, candidate: mesh2motion ? 'mesh2motion' : skins ? 'joint-weights' : 'stage1', animationTextureBytes: side.crowd.bytes, infectedDraws: 1, count, backend: renderer.selectedBackend,
    }]));
  }
  function boxes() {
    const width = innerWidth / 2, height = innerHeight;
    return sides.map((side, index) => {
      const m = side.states[1], cx = (side.heroMotion.x + side.states[0].x + m.x) / 3, cz = (side.heroMotion.z + side.states[0].z + m.z) / 3;
      camera.left = -6.5 * width / height; camera.right = 6.5 * width / height; camera.top = 6.5; camera.bottom = -6.5; camera.updateProjectionMatrix();
      camera.position.set(cx - 12, 22, cz + 24); camera.lookAt(cx, .7, cz); camera.updateMatrixWorld(true);
      const root = side.hero.children[0];
      const points = [
        (index === 1 && mesh2motion ? ['head','hand_l','hand_r','foot_l','foot_r','pelvis'] : ['head','handL','handR','footL','footR','hip']).map(name => root.getObjectByName(name)!.getWorldPosition(new Vector3())),
        ...[side.civilian, side.crowd].map(batch => ['head','handL','handR','footL','footR','hip'].map(name => batch.landmark(0, name))),
      ];
      return points.map(vertices => {
        const projected = vertices.flatMap(v => [-.3,.3].flatMap(dx => [-.3,.5].map(dy => v.clone().add(new Vector3(dx,dy,0)).project(camera))));
        const xs = projected.map(p => (p.x + 1) * width / 2 + index * width), ys = projected.map(p => (1 - p.y) * height / 2);
        return { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)), width: Math.ceil(Math.max(...xs)-Math.min(...xs)), height: Math.ceil(Math.max(...ys)-Math.min(...ys)) };
      });
    });
  }
  const api = {
    step(n: number) { paused = true; for (let i = 0; i < n; i++) update(); render(); return metrics(); },
    metrics, render, boxes, pause() { paused = true; }, resume() { paused = false; last = 0; },
    async gpu() { if (!(renderer.backend as unknown as { hasTimestamp: boolean }).hasTimestamp) return null; await renderer.resolveTimestampsAsync(); return renderer.info.render.timestamp; },
    get tick() { return tick; }, get ready() { return true; },
    dispose() { disposed = true; cancelAnimationFrame(raf); for (const side of sides) { side.physics.dispose(); side.civilian.dispose(); side.crowd.dispose(); side.animator.mixer.stopAllAction(); side.scene.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.dispose(); } if (node instanceof SkinnedMesh) node.skeleton.dispose(); }); side.scene.clear(); } renderer.dispose(); void registry.dispose(); ui.remove(); style.remove(); },
  };
  Object.assign(window, { __MOTIONLAB__: api }); document.querySelector('#lab-pause')!.addEventListener('click', () => { paused = !paused; });
  if (import.meta.hot) import.meta.hot.dispose(() => api.dispose());
  function loop(now: number) {
    if (disposed) return;
    if (!paused) { if (last) { const elapsed = now - last; sides.forEach(s => s.frameMs.push(elapsed)); accumulated += Math.min(.1, elapsed / 1000); } while (accumulated >= dt) { update(); accumulated -= dt; } render(); }
    last = now; raf = requestAnimationFrame(loop);
  }
  render(); raf = requestAnimationFrame(loop);
}
