import { AnimationMixer, LoopOnce, Quaternion, Vector3, type AnimationAction, type Object3D } from 'three';
import { retargetClip, strides, strideScale } from './clips';

/** E19 §5.8 corgi warning, sim-owned by the companion (lane F: `companion.warn`), plus
 * the threat's position for the head look (the caller resolves `warn.threat`). */
export interface CorgiWarning { stage: 'none' | 'stiffen' | 'growl' | 'bark' | 'nervous'; toward?: { x: number; z: number } | null }
const warningClips = { stiffen: 'corgi-stiffen', growl: 'corgi-growl', bark: 'corgi-bark', nervous: 'corgi-nervous' } as const;
const up = new Vector3(0, 1, 0);

/** Authored four-beat walk, diagonal-pair trot and rotary gallop (beside the bicycle),
 * calm idle/sit, and the warning set with a head look toward the threat. */
export class QuadrupedAnimator {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private action: AnimationAction | undefined;
  private time = 0;
  private stoppedAt = 0;
  private look = 0;
  private readonly head: Object3D | undefined;
  private readonly world = new Vector3();
  private readonly turn = new Quaternion();
  private readonly rootTurn = new Quaternion();
  clip = 'corgi-idle';
  constructor(private readonly root: Object3D) {
    this.mixer = new AnimationMixer(root);
    for (const name of ['corgi-idle','corgi-walk','corgi-trot','corgi-gallop','corgi-sit', ...Object.values(warningClips)]) this.actions.set(name, this.mixer.clipAction(retargetClip(root, name)));
    this.head = root.getObjectByName('head');
  }
  update(time: number, speed: number, distance: number, warning?: CorgiWarning | null): void {
    const dt = Math.max(0, time - this.time); this.time = time;
    if (speed > .08) this.stoppedAt = time;
    const gait = speed > (this.clip === 'corgi-gallop' ? 3.6 : 4.2) ? 'corgi-gallop' : speed > (this.clip === 'corgi-trot' ? 1.2 : 1.6) ? 'corgi-trot' : speed > (this.clip === 'corgi-walk' ? .04 : .12) ? 'corgi-walk' : time - this.stoppedAt > 4 ? 'corgi-sit' : 'corgi-idle';
    // Warnings play when the dog has stopped (it stops to stiffen, §5.8); while
    // moving the gait continues and only the head looks.
    const name = warning && warning.stage !== 'none' && !strides[gait] ? warningClips[warning.stage] : gait;
    if (!this.action || name !== this.clip) {
      const previous = this.action; this.action = this.actions.get(name)!.reset().setEffectiveWeight(1).play();
      if (name === 'corgi-sit' || name === 'corgi-stiffen' || name === 'corgi-bark') { this.action.setLoop(LoopOnce, 1); this.action.clampWhenFinished = true; }
      previous?.crossFadeTo(this.action, name === 'corgi-bark' || name === 'corgi-stiffen' ? .08 : .16, false); this.clip = name;
    }
    if (strides[name]) { this.action.time = distance / (strides[name] * strideScale(this.root)) % 1 * this.action.getClip().duration; this.action.setEffectiveTimeScale(0); }
    else this.action.setEffectiveTimeScale(1);
    this.mixer.update(dt);
    // Head look: yaw toward the threat, capped at ±50°, eased over ~200 ms.
    let target = 0;
    if (warning?.toward && warning.stage !== 'nervous' && warning.stage !== 'none') {
      this.root.getWorldPosition(this.world); this.root.getWorldQuaternion(this.rootTurn);
      const forward = new Vector3(1, 0, 0).applyQuaternion(this.rootTurn);
      const dx = warning.toward.x - this.world.x, dz = warning.toward.z - this.world.z;
      target = Math.max(-.87, Math.min(.87, Math.atan2(-(forward.x * dz - forward.z * dx), forward.x * dx + forward.z * dz)));
    }
    this.look += (target - this.look) * (1 - Math.exp(-12 * dt));
    if (this.head && Math.abs(this.look) > 1e-3) this.head.quaternion.premultiply(this.turn.setFromAxisAngle(up, this.look));
  }
}
