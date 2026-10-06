// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Inputs.js, commit 41046b5.
import type { EntitySnapshot } from '../sim/world/types';
import { Vector3, type Camera } from 'three';
import type { Lifecycle } from '../core/Lifecycle';
import { defaultBindings, type Action } from '../data/bindings';
import { Bindings } from './Bindings';
import { Buttons } from './Buttons';
import { emptyInput, type InputFrame, type Scheme, type Vec2 } from './InputFrame';
import { Recorder } from './Recorder';
import { Keyboard } from './devices/Keyboard';
import { Pointer } from './devices/Pointer';
import { RayCursor } from './devices/RayCursor';
import { Touch } from './devices/Touch';
import { Wheel } from './devices/Wheel';

/** Device ownership ends here. sample() runs immediately before every fixed sim tick. */
export class InputSystem implements Lifecycle {
  readonly bindings: Bindings;
  readonly recorder = new Recorder();
  readonly keyboard: Keyboard;
  readonly pointer: Pointer;
  readonly wheel: Wheel;
  readonly cursor: RayCursor;
  readonly touch: Touch;
  private touchFire: 'touch' | 'assist' | null = null;
  readonly frame = emptyInput();
  scheme: Scheme = 'mouse-only';
  private drivingContext = false;
  setDriving(on: boolean): void { if (on !== this.drivingContext) { this.drivingContext = on; this.touch.setDriving(on); } }
  private readonly left = new Buttons();
  private readonly right = new Buttons();
  private readonly active = new Set<Action>();
  private readonly heldTokens = new Map<string, Action>();
  private readonly selectors: { direction: -1 | 1; side?: 'LEFT' | 'RIGHT'; active?: boolean }[] = [];
  private interact = false;
  private cancelMove = false;
  private pointerTarget = false;
  private pointerGround: false | 'move' = false;
  private readonly clicks: { x: number; y: number; shift: boolean }[] = [];
  private selectedSlot: { side: 'LEFT' | 'RIGHT'; index: number } | undefined;
  cycle(side: 'LEFT' | 'RIGHT'): void { this.selectors.push({ direction: 1, side }); }
  private readonly projected = new Vector3();
  private pause = false;
  private injected: InputFrame | null = null;
  private readonly direction = new Vector3();
  private readonly screen: Vec2 = { x: 0, z: 0 };
  private readonly aim: Vec2 = { x: 1, z: 0 };
  private aimAngle = 0;
  private manualAim = false;
  private arrowStart = 0;
  private arrowTarget = 0;
  private releasing = false;
  private readonly hint = document.createElement('output');
  private readonly controls = document.createElement('details');
  private readonly message = document.createElement('output');
  constructor(private readonly canvas: HTMLElement, private readonly camera: Camera, private readonly zoom: (delta: number) => void = () => {}) {
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* Defaults work with storage disabled. */ }
    this.bindings = new Bindings(storage);
    this.cursor = new RayCursor(camera, canvas);
    this.keyboard = new Keyboard(window, this.key);
    this.pointer = new Pointer(canvas, window, this.mouseActivity, this.token);
    this.wheel = new Wheel(canvas, (direction) => { this.mouseActivity(); this.zoom(direction * .075); });
    this.touch = new Touch(canvas, () => { this.pointer.valid = false; this.cancelMove = true; this.pointerGround = false; this.setScheme('touch'); }, (action, direction, side) => {
      if (action === 'selector') { this.selectors.push({ direction: 1, side }); }
      else if (action === 'interact') this.interact = true;
      else if (action === 'pause') this.pause = true;
      else {
        if (direction) { this.aimAngle = this.screenAngle(direction.x, direction.z); }
        this.touchFire = direction ? 'touch' : 'assist';
        (action === 'left' ? this.left : this.right).pulse();
      }
    }, this.zoom);
  }
  init(): void {
    this.keyboard.init(); this.pointer.init(); this.wheel.init(); this.touch.init();
    window.addEventListener('blur', this.release); window.addEventListener('pagehide', this.release);
    document.addEventListener('visibilitychange', this.visibility);
    this.hint.dataset.inputHint = ''; this.hint.setAttribute('role', 'note'); this.hint.style.cssText = 'position:fixed;top:12px;left:12px;color:white;background:#182333;padding:8px;font:14px sans-serif;pointer-events:none';
    this.controls.style.cssText = 'position:fixed;top:54px;left:12px;background:#182333;color:white;padding:8px;font:14px sans-serif;max-width:260px';
    this.controls.hidden = !new URLSearchParams(location.search).has('debug');
    this.controls.innerHTML = '<summary>Controls</summary><form><label>Action <select name="action"></select></label><label>Key code <input name="code" placeholder="KeyZ" required></label><button>Bind</button></form>';
    const select = this.controls.querySelector('select')!;
    for (const action of Object.keys(defaultBindings)) { const option = document.createElement('option'); option.value = action; option.textContent = action; select.append(option); }
    this.message.setAttribute('role', 'status'); this.controls.append(this.message);
    this.controls.querySelector('form')!.addEventListener('submit', this.submit);
    document.body.append(this.hint, this.controls); this.setScheme(this.scheme);
  }
  private readonly submit = (event: Event): void => {
    event.preventDefault(); const form = this.controls.querySelector('form')!;
    const data = new FormData(form); this.rebind(data.get('action') as Action, String(data.get('code')));
  };
  rebind(action: Action, code: string): { ok: boolean; message: string } {
    const result = this.bindings.rebind(action, code);
    if (result.ok) this.release(); this.message.textContent = result.message; return result;
  }
  private setScheme(scheme: Scheme): void {
    if (scheme === this.scheme && this.hint.textContent) return;
    this.touch.pauseElement.hidden = scheme !== 'touch';
    this.touch.element.hidden = scheme !== 'touch'; this.touch.element.style.display = scheme === 'touch' ? 'grid' : 'none';
    this.scheme = scheme; this.hint.dataset.scheme = scheme;
    this.hint.textContent = {
      'mouse-only': 'Click to move · LMB attack · hold LMB to walk · Shift+LMB attack in place · RMB / Q cycle · 1/2/3 · wheel zoom · middle-click ACTION',
      'mouse-keyboard': 'WASD + cursor · LMB attack · Shift+LMB attack in place · RMB / Q cycle · 1/2/3 · wheel zoom · F / E',
      keyboard: 'WASD · J / K aim assist · 1/2/3 · Shift+1/2/3 · Q · F / E',
      touch: 'Stick to move · LEFT / RIGHT · swipe up to switch · pinch zoom · ACTION',
    }[scheme];
  }
  private readonly mouseActivity = (): void => {
    this.setScheme(this.moving() ? 'mouse-keyboard' : 'mouse-only');
  };
  private moving(): boolean { return this.active.has('moveUp') || this.active.has('moveDown') || this.active.has('moveLeft') || this.active.has('moveRight'); }
  private readonly key = (code: string, held: boolean): void => {
    if (code === 'ShiftLeft' || code === 'ShiftRight') return;
    if (held && /^Digit[123]$/.test(code)) {
      this.selectedSlot = { side: this.keyboard.pressed.has('ShiftLeft') || this.keyboard.pressed.has('ShiftRight') ? 'RIGHT' : 'LEFT', index: Number(code.slice(-1)) - 1 };
      this.setScheme(this.pointer.valid ? 'mouse-keyboard' : 'keyboard'); return;
    }
    const action = held ? this.bindings.action(code) : this.heldTokens.get(code);
    if (held && action) {
      if (action.startsWith('aim')) { this.pointer.valid = false; this.manualAim = true; }
      if (action.startsWith('move')) this.manualAim = false;
      this.setScheme(action.startsWith('aim') || this.scheme === 'touch' ? 'keyboard' : this.pointer.valid ? 'mouse-keyboard' : 'keyboard');
      if (action.startsWith('aim') && !this.aiming()) this.arrowStart = performance.now();
    }
    // Short arrow taps snap before releasing the key, preserving combined diagonals.
    if (!held && action?.startsWith('aim') && !this.releasing && performance.now() - this.arrowStart < 150) this.aimAngle = this.arrowTarget;
    this.token(code, held);
    if (held && this.aiming()) this.arrowTarget = this.screenAngle(this.axis('aimRight', 'aimLeft'), this.axis('aimDown', 'aimUp'));
  };
  private readonly token = (code: string, held: boolean): void => {
    const action = held ? this.bindings.action(code) : this.heldTokens.get(code);
    if (!action) return;
    if (held && code === 'Mouse0') this.clicks.push({ x: this.pointer.x, y: this.pointer.y, shift: this.shift() });
    else if (held && code === 'Mouse2') { this.selectors.push({ direction: 1, active: true }); this.heldTokens.set(code, action); return; }
    else if (held && (action.startsWith('move') || action === 'left' || action === 'right' || action === 'interact')) { this.cancelMove = true; if (!action.startsWith('move')) this.pointerGround = false; }
    if (held) this.heldTokens.set(code, action); else this.heldTokens.delete(code);
    if (action === 'left') this.left.set(code, held);
    else if (action === 'right') this.right.set(code, held);
    else if (held && action === 'selector') { this.selectors.push({ direction: 1, active: this.scheme.startsWith('mouse') }); }
    else if (held && action === 'interact') this.interact = true;
    else if (held && action === 'pause') this.pause = true;
    if (held) this.active.add(action);
    else if (![...this.heldTokens.values()].includes(action)) this.active.delete(action);
  };
  private shift(): boolean { return this.keyboard.pressed.has('ShiftLeft') || this.keyboard.pressed.has('ShiftRight'); }
  private axis(positive: Action, negative: Action): number { return Number(this.active.has(positive)) - Number(this.active.has(negative)); }
  private aiming(): boolean { return this.active.has('aimUp') || this.active.has('aimDown') || this.active.has('aimLeft') || this.active.has('aimRight'); }
  /** Camera azimuth projected onto ground; pitch does not distort movement. */
  private screenVector(x: number, y: number, out: Vec2): void {
    this.camera.getWorldDirection(this.direction); const length = Math.hypot(this.direction.x, this.direction.z) || 1;
    const forwardX = this.direction.x / length, forwardZ = this.direction.z / length;
    out.x = -forwardZ * x - forwardX * y; out.z = forwardX * x - forwardZ * y;
  }
  private screenAngle(x: number, y: number): number { this.screenVector(x, y, this.screen); return Math.atan2(this.screen.z, this.screen.x); }
  /** Frame and math scratch objects are reused; no device polling or scene-mesh raycasts. */
  private readonly cursorPoint = { x: 0, z: 0 };
  private readonly driving = { throttle: 0, steer: 0 };
  sample(player: Vec2, dt = 1 / 60, targets: Iterable<EntitySnapshot> = []): InputFrame {
    if (this.recorder.playing) return this.recorder.next() ?? this.frameNeutral();
    if (this.injected) { this.recorder.capture(this.injected); return this.injected; }
    const frame = this.frame;
    frame.move.x = 0; frame.move.z = 0; frame.aim = null; frame.aimSource = null; delete frame.aimPoint; delete frame.moveTarget; delete frame.attackTarget; delete frame.pointerGround; delete frame.selectorSide; delete frame.selectedSlot; delete frame.pointerTarget; delete frame.mouseAttack; delete frame.attackInPlace; delete frame.selectorActive;
    frame.cancelMove = this.cancelMove; this.cancelMove = false;
    const x = this.axis('moveRight', 'moveLeft'), y = this.axis('moveDown', 'moveUp');
    this.driving.throttle = y ? -y : 0; this.driving.steer = x; frame.drive = this.driving; frame.brake = false;
    if (this.scheme === 'keyboard' || this.scheme === 'mouse-keyboard') {
      this.screenVector(x, y, frame.move); const length = Math.hypot(frame.move.x, frame.move.z);
      if (length > 1) { frame.move.x /= length; frame.move.z /= length; }
    }
    if ((this.scheme === 'mouse-only' || this.scheme === 'mouse-keyboard') && this.pointer.valid) {
      const point = this.cursor.project(this.pointer.x, this.pointer.y);
      if (point) {
        frame.aimPoint = this.cursorPoint; this.cursorPoint.x = point.x; this.cursorPoint.z = point.z;
        const dx = point.x - player.x, dz = point.z - player.z, distance = Math.hypot(dx, dz);
        if (distance > 1e-6) {
          this.aim.x = dx / distance; this.aim.z = dz / distance;
          this.aimAngle = Math.atan2(dz, dx); frame.aim = this.aim; frame.aimSource = 'pointer';
        }
      }
    } else if (this.scheme === 'keyboard') {
      if (this.aiming()) {
        const ax = this.axis('aimRight', 'aimLeft'), ay = this.axis('aimDown', 'aimUp');
        if (ax || ay) this.arrowTarget = this.screenAngle(ax, ay);
        const delta = Math.atan2(Math.sin(this.arrowTarget - this.aimAngle), Math.cos(this.arrowTarget - this.aimAngle));
        this.aimAngle += Math.sign(delta) * Math.min(Math.abs(delta), Math.PI * 2 * dt);
      }
      if (this.manualAim) { this.aim.x = Math.cos(this.aimAngle); this.aim.z = Math.sin(this.aimAngle); frame.aim = this.aim; frame.aimSource = 'keyboard'; }
      else frame.aimSource = 'assist';
    }
    if (this.scheme === 'touch') {
      this.screenVector(this.touch.stick.move.x, this.touch.stick.move.z, frame.move);
      if (this.touch.aiming) this.aimAngle = this.screenAngle(this.touch.aim.x, this.touch.aim.z);
      this.aim.x = Math.cos(this.aimAngle); this.aim.z = Math.sin(this.aimAngle);
      frame.aim = this.aim; frame.aimSource = this.touchFire ?? 'touch'; this.touchFire = null;
    }
    frame.left = this.left.sample(); frame.right = this.right.sample();
    const candidates = this.clicks.length ? Array.from(targets) : null;
    for (const click of this.clicks) {
      const point = this.cursor.project(click.x, click.y);
      if (!point) continue;
      frame.cancelMove = true;
      frame.mouseAttack = true;
      if (click.shift) { frame.attackInPlace = true; this.pointerGround = false; this.pointerTarget = false; continue; }
      if (this.drivingContext) continue;
      let picked: EntitySnapshot | null = null, best = Infinity;
      for (const target of candidates!) {
        if ((target.faction !== 'infected' && !(target.faction === 'environment' && target.combat)) || target.health.current <= 0 || target.hidden || target.infected?.hidden) continue;
        const p = target.transform, rect = this.canvas.getBoundingClientRect();
        this.projected.set(p.x, p.y, p.z).project(this.camera);
        const sx = rect.left + (this.projected.x + 1) * rect.width / 2, sy = rect.top + (1 - this.projected.y) * rect.height / 2;
        const screenDistance = Math.hypot(click.x - sx, click.y - sy);
        const groundDistance = Math.hypot(point.x - p.x, point.z - p.z);
        const score = Math.min(screenDistance / 18, groundDistance / (target.combat?.radius ?? .4) / 1.5);
        if (score <= 1 && score < best) { picked = target; best = score; }
      }
      if (picked) { frame.attackTarget = { id: picked.id, side: 'LEFT' }; this.pointerGround = false; this.pointerTarget = true; frame.pointerTarget = true; }
      else { frame.moveTarget = { x: point.x, z: point.z }; this.pointerGround = 'move'; this.pointerTarget = false; }
    }
    this.clicks.length = 0;
    if (this.pointer.isHeld(0)) {
      frame.mouseAttack = true;
      if (this.pointerTarget) frame.pointerTarget = true;
      if (this.shift() && !this.drivingContext) {
        frame.attackInPlace = true; frame.cancelMove = true;
        delete frame.moveTarget; delete frame.attackTarget; delete frame.pointerTarget; this.pointerGround = false; this.pointerTarget = false;
      }
    }
    if (this.pointerGround && !this.drivingContext) {
      frame.pointerGround = true;
      if (this.pointerGround === 'move' && frame.left.held && frame.aimPoint && !this.moving()) frame.moveTarget = { ...frame.aimPoint };
    }
    if (this.drivingContext && this.scheme === 'touch' && this.touch.holdingLeft) frame.left.held = true;
    if (this.selectedSlot) { frame.selectedSlot = this.selectedSlot; this.selectedSlot = undefined; }
    const selection = this.selectors.shift();
    frame.selector = selection?.direction ?? 0;
    if (selection?.side) frame.selectorSide = selection.side;
    if (selection?.active) frame.selectorActive = true; frame.interact = this.interact; frame.pause = this.pause;
    this.interact = false; this.pause = false; this.recorder.capture(frame); return frame;
  }
  private frameNeutral(): InputFrame {
    const frame = this.frame; frame.move.x = 0; frame.move.z = 0; frame.aim = null; frame.aimSource = null; delete frame.aimPoint; delete frame.drive; delete frame.brake; delete frame.moveTarget; delete frame.attackTarget; delete frame.cancelMove; delete frame.pointerGround; delete frame.selectorSide; delete frame.selectedSlot; delete frame.pointerTarget; delete frame.mouseAttack; delete frame.attackInPlace; delete frame.selectorActive;
    frame.left.down = frame.left.held = frame.left.up = false; frame.right.down = frame.right.held = frame.right.up = false;
    frame.selector = 0; frame.interact = false; frame.pause = false; return frame;
  }
  /** Logical injection persists until clear(), preserving the E01 harness contract. */
  inject(patch: Partial<InputFrame>): void { this.injected = { ...(this.injected ?? emptyInput()), ...structuredClone(patch) }; }
  clear(): void { this.injected = null; this.reset(true); }
  private readonly visibility = (): void => { if (document.hidden) this.release(); };
  readonly release = (): void => {
    this.releasing = true; this.keyboard.release(); this.pointer.release(); this.releasing = false;
    this.touch.release(); this.wheel.reset(); this.touchFire = null; this.left.release(); this.right.release(); this.active.clear(); this.heldTokens.clear();
    this.clicks.length = 0; this.cancelMove = true; this.pointerGround = false; this.selectedSlot = undefined;
    this.pointerTarget = false; this.selectors.length = 0; this.interact = false; this.pause = false;
  };
  update(): void { /* Input is sampled in the fixed input phase, not the render update. */ }
  reset(preserveRelease = false): void { this.setDriving(false); this.release(); this.left.reset(preserveRelease); this.right.reset(preserveRelease); this.injected = null; this.recorder.reset(); this.aimAngle = 0; this.manualAim = false; this.setScheme(navigator.maxTouchPoints > 0 ? 'touch' : 'mouse-only'); this.frameNeutral(); }
  dispose(): void {
    this.reset(); this.keyboard.dispose(); this.pointer.dispose(); this.wheel.dispose(); this.touch.dispose();
    window.removeEventListener('blur', this.release); window.removeEventListener('pagehide', this.release); document.removeEventListener('visibilitychange', this.visibility);
    this.controls.querySelector('form')?.removeEventListener('submit', this.submit); this.controls.remove(); this.hint.remove();
  }
}
