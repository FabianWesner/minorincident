import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Game } from '../Game';
import type { CameraPose } from '../render/View';
import { LevelOneBot } from './bot/LevelOneBot';
import { LevelTwoBot } from './bot/LevelTwoBot';
import { LevelThreeBot } from './bot/LevelThreeBot';

export type CourierMode = 'ghost' | 'bot' | 'unchanged';
export interface InspectionAnchor { id: string; kind: string; position: [number, number, number] }
/** Render-only camera override. Courier mode is explicit so bot comparisons can preserve all sim inputs. */
export class Inspection {
  enabled = false;
  private mode: CourierMode = 'unchanged';
  private readonly target = new Vector3();
  private radius = 19;
  private yaw = Math.PI / 4;
  private pitch = Math.PI * .3;
  private following: number | null = null;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private cursor = { x: 0, y: 0 };
  private dragged = false;
  private readonly panel = document.createElement('aside');
  private readonly info = document.createElement('pre');
  private readonly jumps = document.createElement('select');
  private readonly courier = document.createElement('select');
  private readonly abort = new AbortController();
  private shown = true;
  private elapsed = 0;
  private level = '';
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ray = new Raycaster();
  constructor(private readonly game: Game) {
    const signal = this.abort.signal, canvas = game.view.renderer.domElement;
    window.addEventListener('keydown', this.key, { capture: true, signal });
    window.addEventListener('keyup', this.key, { capture: true, signal });
    window.addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); }, { signal });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) canvas.addEventListener(type, this.pointer, { capture: true, signal });
    for (const type of ['mousedown', 'mouseup', 'click', 'contextmenu'] as const) canvas.addEventListener(type, event => { if (this.enabled) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true, signal });
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) canvas.addEventListener(type, event => { if (this.enabled) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true, passive: false, signal });
    canvas.addEventListener('wheel', event => { if (!this.enabled) return; event.preventDefault(); event.stopImmediatePropagation(); this.following = null; this.radius = Math.max(1.5, Math.min(250, this.radius * Math.exp(event.deltaY * .001))); this.pose(); }, { capture: true, passive: false, signal });
    canvas.addEventListener('dblclick', event => { if (!this.enabled) return; event.preventDefault(); event.stopImmediatePropagation(); const point = this.point(event.clientX, event.clientY); if (point) { this.following = null; this.target.copy(point); this.pose(); } }, { capture: true, signal });
    this.panel.dataset.testid = 'inspection';
    this.panel.style.cssText = 'position:fixed;top:8px;left:8px;z-index:10000;background:#101820e8;color:white;padding:12px;max-width:360px;max-height:85vh;overflow:auto;font:12px monospace;pointer-events:auto';
    this.panel.hidden = true;
    const title = document.createElement('strong'); title.textContent = 'Level inspection · F / ` exit · H overlay'; this.panel.append(title, this.info);
    for (const scale of [0, .25, 1, 4]) this.button(`${scale === 0 ? 'Pause' : scale + '×'}`, () => this.timeScale(scale));
    const courier = this.courier;
    for (const value of ['ghost', 'bot', 'unchanged'] as const) { const option = document.createElement('option'); option.value = value; option.textContent = 'Courier: ' + value; courier.append(option); }
    courier.onchange = () => this.enable(true, { courier: courier.value as CourierMode }); this.panel.append(courier);
    const lod = document.createElement('select'); for (const value of ['real', 'game'] as const) { const option = document.createElement('option'); option.value = value; option.textContent = 'LOD distance: ' + value; lod.append(option); }
    lod.onchange = () => this.lod(lod.value as 'real' | 'game'); this.panel.append(lod, document.createElement('br'), this.jumps);
    this.jumps.onchange = () => this.jump(this.jumps.value);
    this.button('Follow under cursor', () => { const entity = this.entityAtCursor(); if (entity) this.follow(entity.id); });
    this.button('Stop following', () => { this.following = null; });
    this.button('Screenshot', () => { void this.screenshot(); });
    document.body.append(this.panel);
  }
  private button(label: string, action: () => void): void { const button = document.createElement('button'); button.textContent = label; button.onclick = action; this.panel.append(button); }
  enable(on = true, options?: { courier?: CourierMode }): void {
    if (on && !(import.meta.env.DEV || this.game.params.get('debug') === 'true')) throw new Error('Inspection requires debug=true in production');
    if (on && !this.enabled) { this.target.copy(this.game.view.view.cameraTarget); this.radius = this.game.view.camera.position.distanceTo(this.target); }
    this.enabled = on; this.keys.clear(); this.game.input.release(); this.game.world.clearInput();
    if (on && options?.courier) this.mode = options.courier;
    this.courier.value = this.mode;
    this.game.world.inspectionGhost = on && this.mode === 'ghost';
    if (on && this.mode === 'ghost') { if (this.game.driver instanceof LevelOneBot) this.game.driver.dispose(); this.game.driver = null; }
    if (on && this.mode === 'bot' && !this.game.driver) this.startBot();
    this.panel.hidden = !on || !this.shown;
    if (on) { this.level = this.game.world.scenario ?? ''; this.refreshAnchors(); this.pose(); this.game.view.update(1); }
    else { this.following = null; this.game.view.view.inspectionPose = null; this.game.view.view.inspectionGameLod = false; this.game.view.update(1); }
  }
  private startBot(): void {
    const world = this.game.world;
    if (world.scenario === 'L1') this.game.driver = new LevelOneBot(world);
    else if (world.scenario === 'L2') this.game.driver = new LevelTwoBot(world);
    else if (world.scenario === 'L3') this.game.driver = new LevelThreeBot(world, 'complete');
    else throw new Error(`No complete bot registered for ${world.scenario}`);
  }
  setCamera(pose: CameraPose): void {
    if (![...pose.position, ...pose.target].every(Number.isFinite) || pose.position[1] < 1.5) throw new RangeError('Camera coordinates must be finite, with height >= 1.5 m');
    if (!this.enabled) this.enable(true);
    this.following = null; this.target.fromArray(pose.target);
    const offset = new Vector3().fromArray(pose.position).sub(this.target);
    this.radius = Math.max(1.5, Math.min(250, offset.length())); this.yaw = Math.atan2(offset.x, offset.z); this.pitch = Math.acos(Math.max(-1, Math.min(1, offset.y / this.radius)));
    this.game.view.view.inspectionPose = structuredClone(pose); this.game.view.update(1);
  }
  follow(id: number | null): void { if (id !== null && !this.game.world.entities.get(id)) throw new Error(`Unknown entity ${id}`); if (!this.enabled) this.enable(true); this.following = id; this.update(0); this.game.view.update(1); }
  timeScale(scale: number): void { this.game.clock.setTimeScale(scale); if (scale > 0) this.game.clock.resume(); }
  lod(mode: 'real' | 'game'): void { this.game.view.view.inspectionGameLod = mode === 'game'; this.game.view.update(1); }
  anchors(): InspectionAnchor[] {
    const anchors: InspectionAnchor[] = [];
    for (const district of this.game.world.districts?.districts ?? []) {
      for (const [id, anchor] of Object.entries(district.layout.anchors)) anchors.push({ id: `${district.id}/${id}`, kind: 'anchor', position: [anchor.position[0] + district.origin[0], anchor.position[1], anchor.position[2] + district.origin[1]] });
    }
    const mission = this.game.world.missions;
    if (mission) {
      for (const [id, at] of Object.entries(mission.def.anchors)) anchors.push({ id: `mission/${id}`, kind: 'objective', position: [at.x, 0, at.z] });
      for (const checkpoint of mission.def.checkpoints ?? []) { const step = mission.def.steps.find(step => step.onComplete?.some(action => action.kind === 'checkpoint' && action.id === checkpoint)); const at = step && 'anchor' in step ? mission.def.anchors[step.anchor] : undefined; if (at) anchors.push({ id: `checkpoint/${checkpoint}`, kind: 'checkpoint', position: [at.x, 0, at.z] }); }
    }
    return anchors;
  }
  jump(id: string): void { const anchor = this.anchors().find(anchor => anchor.id === id); if (!anchor) throw new Error(`Unknown anchor ${id}`); this.following = null; this.target.fromArray(anchor.position); this.pose(); this.game.view.update(1); }
  state() { return { enabled: this.enabled, courier: this.mode, following: this.following, camera: this.game.view.view.inspectionPose, lod: this.game.view.view.inspectionGameLod ? 'game' : 'real', timeScale: this.game.clock.paused ? 0 : this.game.clock.timeScale, entity: this.entityAtCursor(), nearest: this.nearest(), perf: this.game.perf() }; }
  update(seconds: number): void {
    if (!this.enabled) return;
    if (this.level !== this.game.world.scenario) { this.level = this.game.world.scenario ?? ''; this.following = null; this.target.copy(this.game.view.view.cameraTarget); this.refreshAnchors(); this.game.world.inspectionGhost = this.mode === 'ghost'; }
    const speed = Math.min(seconds, .1) * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 40 : 10);
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
    if (x || z) { this.following = null; this.pan(x * speed, z * speed); }
    this.target.y = Math.max(0, this.target.y + (Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ'))) * speed);
    const entity = this.following === null ? undefined : this.game.world.entities.get(this.following);
    if (entity && entity.health.current > 0) this.target.set(entity.transform.x, .7, entity.transform.z); else if (this.following !== null) this.following = null;
    this.pose();
    this.elapsed += seconds;
    if (this.elapsed > .2 || seconds === 0) { this.elapsed = 0; const state = this.state(); this.info.textContent = `Camera ${state.camera?.position.map(n => n.toFixed(1)).join(', ')}\nNear ${state.nearest?.id ?? '—'}\n${state.perf.fps.toFixed(0)} fps · ${state.perf.drawCalls} draws\nFollowing ${state.following ?? '—'}\nCursor ${JSON.stringify(state.entity, null, 1)}\nWASD / arrows pan · drag rotate\nWheel zoom · Q/E height · Shift fast\nDouble click focus · click person follow`; }
  }
  private refreshAnchors(): void { this.jumps.replaceChildren(); const placeholder = document.createElement('option'); placeholder.textContent = 'Jump to anchor / objective / checkpoint'; placeholder.value = ''; this.jumps.append(placeholder); for (const anchor of this.anchors()) { const option = document.createElement('option'); option.value = anchor.id; option.textContent = anchor.id; this.jumps.append(option); } }
  private pose(): void {
    const position = new Vector3().setFromSphericalCoords(this.radius, this.pitch, this.yaw).add(this.target); position.y = Math.max(1.5, position.y);
    this.game.view.view.inspectionPose = { position: position.toArray(), target: this.target.toArray() };
  }
  private pan(x: number, z: number): void { this.target.x += Math.cos(this.yaw) * x + Math.sin(this.yaw) * z; this.target.z += -Math.sin(this.yaw) * x + Math.cos(this.yaw) * z; }
  private readonly key = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement)?.closest('input,select,textarea,button,[contenteditable]')) return;
    if (event.type === 'keydown' && !event.repeat && ['KeyF', 'Backquote'].includes(event.code) && this.game.params.get('debug') === 'true') { event.preventDefault(); event.stopImmediatePropagation(); this.enable(!this.enabled, { courier: this.game.params.get('bot') === 'complete' ? 'bot' : 'ghost' }); return; }
    if (!this.enabled) return;
    if (event.type === 'keydown' && event.code === 'KeyH' && !event.repeat) { this.shown = !this.shown; this.panel.hidden = !this.shown; }
    if (/^(Key[WASDQEH]|Arrow|Shift)/.test(event.code)) { event.preventDefault(); event.stopImmediatePropagation(); if (event.type === 'keydown') this.keys.add(event.code); else this.keys.delete(event.code); }
  };
  private readonly pointer = (event: PointerEvent): void => {
    this.cursor = { x: event.clientX, y: event.clientY };
    if (!this.enabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const canvas = this.game.view.renderer.domElement;
    if (event.type === 'pointerdown') { canvas.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, this.cursor); this.dragged = false; return; }
    if (event.type === 'pointerup' || event.type === 'pointercancel') { this.pointers.delete(event.pointerId); if (event.type === 'pointerup' && !this.dragged && event.pointerType === 'mouse') { const entity = this.entityAtCursor(); if (entity?.kind === 'infected' || entity?.kind === 'civilian') this.follow(entity.id); } return; }
    const old = this.pointers.get(event.pointerId); if (!old) return;
    const dx = event.clientX - old.x, dy = event.clientY - old.y; if (Math.hypot(dx, dy) > 2) this.dragged = true;
    const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0) this.radius = Math.max(1.5, Math.min(250, this.radius * before / after));
      const delta = Math.atan2(event.clientY - other.y, event.clientX - other.x) - Math.atan2(old.y - other.y, old.x - other.x);
      this.yaw += Math.atan2(Math.sin(delta), Math.cos(delta));
    } else if (event.pointerType === 'touch') { this.following = null; this.pan(-dx * this.radius / 600, -dy * this.radius / 600); }
    else { this.yaw -= dx * .006; this.pitch = Math.max(.08, Math.min(Math.PI * .49, this.pitch + dy * .006)); }
    this.pointers.set(event.pointerId, this.cursor); this.pose();
  };
  private point(x: number, y: number): Vector3 | null { const rect = this.game.view.renderer.domElement.getBoundingClientRect(); this.ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), this.game.view.camera); return this.ray.ray.intersectPlane(this.ground, new Vector3()); }
  private entityAtCursor() {
    const rect = this.game.view.renderer.domElement.getBoundingClientRect(); let best: ReturnType<Game['world']['getEntity']> = null, distance = 28;
    for (const entity of this.game.world.entities.iterate()) {
      if (entity.hidden || entity.health.current <= 0 || entity.infected?.hidden) continue;
      const p = new Vector3(entity.transform.x, entity.transform.y, entity.transform.z).project(this.game.view.camera); if (p.z < -1 || p.z > 1) continue;
      const d = Math.hypot(rect.left + (p.x + 1) * rect.width / 2 - this.cursor.x, rect.top + (1 - p.y) * rect.height / 2 - this.cursor.y);
      if (d < distance) { best = entity; distance = d; }
    }
    if (!best) return null;
    const figure = this.game.view.crowdFigures().find(figure => figure.id === best!.id);
    return { id: best.id, kind: best.kind, look: best.civilian?.model ?? best.archetype, state: best.infected?.state ?? best.civilian?.state ?? best.survivor?.animation, lod: figure?.lod ?? 'not drawn' };
  }
  private nearest(): InspectionAnchor | null {
    const entries = this.anchors();
    for (const district of this.game.world.districts?.districts ?? []) for (const p of district.decay.placements) entries.push({ id: `${district.id}/${p.id}`, kind: p.assetId, position: [p.position[0] + district.origin[0], p.position[1], p.position[2] + district.origin[1]] });
    let best: InspectionAnchor | null = null, distance = Infinity; for (const entry of entries) { const d = Math.hypot(entry.position[0] - this.target.x, entry.position[2] - this.target.z); if (d < distance) { best = entry; distance = d; } } return best;
  }
  private async screenshot(): Promise<void> {
    const hidden = this.panel.hidden; this.panel.hidden = true;
    try { await this.game.screenshotReady(); const canvas = this.game.view.renderer.domElement; const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height; copy.getContext('2d')!.drawImage(canvas, 0, 0); const link = document.createElement('a'); link.download = `inspect-${this.game.world.scenario}-${this.game.world.tick}.png`; link.href = copy.toDataURL('image/png'); link.click(); } finally { this.panel.hidden = hidden; }
  }
  dispose(): void { this.abort.abort(); this.panel.remove(); this.game.view.view.inspectionPose = null; this.game.world.inspectionGhost = false; }
}
