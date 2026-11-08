import type { InputFrame } from '../../../src/input/InputFrame';
import { Walker } from '../../../src/debug/bot/Walker';
import { phases } from './phases';
import type { RunnerLevel } from '../../sim-runner/levels';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { observeAttackStarts } from './attackStarts';
import { SimPhase } from '../../../src/core/EventBus';
import { Status } from '../../../src/sim/combat/Status';

export interface KitingReceipt {
  kitingSeconds: number;
  attacks: number;
  attacksPerMinute: number;
  samples: number;
  /** Positive-damage strikes against a physically moving courier, separate from attack starts. */
  hits?: number;
  hitsPerMinute?: number;
  style?: KitingStyle;
  diagnostics?: { startTick: number | null; endTick: number | null; firingFrames: number; playerAttackStarts: number; framesWithoutThreats: number; movingSeconds: number; immobilizedSeconds: number; distanceMeters: number; circleRadius?: number };
}
export type KitingStyle = 'retreat' | 'circles';

/** Apply player-like backpedal fire only while a dense, nearby horde is pressing. */
export function installKitingPolicy(world: SimWorld, receipt: KitingReceipt, level: RunnerLevel, style: KitingStyle = 'retreat'): () => boolean {
  const applyInput = world.applyInput.bind(world);
  receipt.style = style;
  const diagnostics = receipt.diagnostics = { startTick: null as number | null, endTick: null as number | null, firingFrames: 0, playerAttackStarts: 0, framesWithoutThreats: 0, movingSeconds: 0, immobilizedSeconds: 0, distanceMeters: 0, circleRadius: undefined as number | undefined };
  let selectedButtonHeld = false;
  let sampleUntil: number | null = null;
  let sampleOrigin: { x: number; z: number } | null = null;
  let sampleDirection: { x: number; z: number } | null = null;
  let circle: { x: number; z: number; radius: number } | null = null;
  let lastSampleTick = -1;
  let nextRocketFireTick = -1;
  const rejoin = new Walker();
  let kitingNow = false;
  observeAttackStarts(world, (_sourceId, targetId) => {
    if (kitingNow && targetId === 1) receipt.attacks++;
  });
  world.events.on('infected.attack', event => {
    const step = world.player?.locomotion.displacement;
    const velocity = world.entities.get(1)?.survivor?.velocity;
    const speed = step ? Math.hypot(step.x, step.z) * 60 : Math.hypot(velocity?.x ?? 0, velocity?.z ?? 0);
    if (event.type === 'infected.attack' && kitingNow && event.targetId === 1 && event.amount > 0 && speed > .2) receipt.hits = (receipt.hits ?? 0) + 1;
  });
  world.events.on('sim.tick', () => {
    const player = world.entities.get(1), p = player?.transform, previous = world.previousPlayer;
    if (!kitingNow || !p || !previous || !player) return;
    const distance = Math.hypot(p.x - previous.x, p.z - previous.z);
    if (distance > .2 / 60) diagnostics.movingSeconds += 1 / 60;
    else if (Status.stunned(player, world.tick) || world.infected?.playerPinned()) diagnostics.immobilizedSeconds += 1 / 60;
    diagnostics.distanceMeters += distance;
  }, SimPhase.cleanup + 1);
  world.events.on('combat.attack', event => {
    if (event.type === 'combat.attack' && kitingNow && event.sourceId === 1) diagnostics.playerAttackStarts++;
  });
  const kite = (frame: InputFrame): InputFrame => {
    const player = world.entities.get(1), position = player?.transform;
    if (!player || !position || player.health.current <= 0) { kitingNow = false; selectedButtonHeld = false; return frame; }
    if (sampleUntil !== null && world.tick >= sampleUntil) {
      kitingNow = false;
      const dx = (sampleOrigin?.x ?? position.x) - position.x, dz = (sampleOrigin?.z ?? position.z) - position.z;
      const distance = Math.hypot(dx, dz);
      // A retreat can cross the nav-grid edge (L7's truck apron). Walk back to
      // the sampled route point before yielding to a bot whose A* cannot start
      // outside that grid. The physics still owns collisions; never teleport.
      if (sampleOrigin && distance > 1 && world.tick < sampleUntil + 1800) {
        const move = rejoin.step(world, sampleOrigin, 1, 'kiting-rejoin') ?? { x: dx / distance, z: dz / distance };
        return { ...frame, move };
      }
      sampleOrigin = null;
      sampleDirection = null;
      return frame;
    }
    // L5's opening street encounter precedes activation of the look objective.
    const l5Encounter = level === 'L5' && ['emerged', 'search'].includes(world.missions?.state.l5?.phase ?? '');
    if (sampleUntil === null && world.missions && !l5Encounter && !phases(world, level).some(phase => phase.threat)) return frame;
    if (world.storyLock) { kitingNow = false; return frame; }
    const threats = world.infected?.active.filter(entity => {
      if (entity.health.current <= 0 || !entity.infected || entity.hidden || !position || Math.hypot(entity.transform.x - position.x, entity.transform.z - position.z) > 30) return false;
      if (level === 'L8') return true;
      const brain = entity.infected.l1;
      const pressing = entity.infected.state === 'chase' || entity.infected.state === 'attack' || !!entity.infected.specialAttack || brain?.mode === 'chase' || brain?.mode === 'bite';
      return pressing && !!world.combat?.query.visible(entity.transform, position);
    }) ?? [];
    const buckets = new Map<string, { x: number; z: number; count: number }>(), cell = 7;
    for (const threat of threats) {
      const x = Math.floor(threat.transform.x / cell), z = Math.floor(threat.transform.z / cell), key = `${x},${z}`;
      const bucket = buckets.get(key) ?? { x: 0, z: 0, count: 0 };
      bucket.x += threat.transform.x; bucket.z += threat.transform.z; bucket.count++;
      buckets.set(key, bucket);
    }
    let centre: { x: number; z: number } | null = null, density = 0;
    // Compare adjacent occupied cells rather than every infected against every
    // other infected; L4/L5 crowds can contain hundreds of living actors.
    for (const key of buckets.keys()) {
      const [x, z] = key.split(',').map(Number);
      let count = 0, sumX = 0, sumZ = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = buckets.get(`${x + dx},${z + dz}`);
        if (bucket) { count += bucket.count; sumX += bucket.x; sumZ += bucket.z; }
      }
      if (count > density) { density = count; centre = { x: sumX / count, z: sumZ / count }; }
    }
    const awayX = centre && position ? position.x - centre.x : 0, awayZ = centre && position ? position.z - centre.z : 0;
    const separation = Math.hypot(awayX, awayZ);
    const denseHorde = !frame.drive && player?.passengerOf === undefined && !!position && !!centre && density >= (level === 'L8' ? 3 : 1) && separation > 0.01 && separation <= 30;
    // L2/L5's first distant chaser is an approach, not yet a close encounter.
    const pursuitRange = level === 'L2' || level === 'L5' ? 6 : 12;
    const closePursuer = level === 'L8' ? denseHorde : level === 'L1' ? threats.length > 0
      : threats.some(entity => Math.hypot(entity.transform.x - position!.x, entity.transform.z - position!.z) <= pursuitRange);
    if (sampleUntil === null && !closePursuer) { selectedButtonHeld = false; return frame; }
    let retreat: { x: number; z: number } | null = null;
    if (denseHorde && position) {
      const nav = world.infected?.nav;
      // Keep the retreat on walkable ground; a tangent is useful when the
      // direct bearing meets a wall. Raw vectors can leave L7's apron grid.
      for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
        const x = (awayX * Math.cos(angle) - awayZ * Math.sin(angle)) / separation;
        const z = (awayX * Math.sin(angle) + awayZ * Math.cos(angle)) / separation;
        if (!nav || nav.visible(position, { x: position.x + x * 1.2, z: position.z + z * 1.2 }, .45)) { retreat = { x, z }; break; }
      }
    }
    if (style === 'circles') {
      // Pick a complete walkable circle through the encounter point, then keep
      // its centre fixed. Following a moving horde centroid is not a circle.
      if (!circle && centre && separation > .01) {
        const nav = world.infected?.nav;
        search: for (const radius of [4, 3, 2]) for (const offset of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
          const angle = Math.atan2(-awayZ, -awayX) + offset;
          const candidate = { x: position.x + Math.cos(angle) * radius, z: position.z + Math.sin(angle) * radius, radius };
          const start = angle + Math.PI;
          let previous = { x: position.x, z: position.z }, clear = true;
          for (let i = 1; i <= 32; i++) {
            const a = start + i * Math.PI / 16, next = { x: candidate.x + Math.cos(a) * radius, z: candidate.z + Math.sin(a) * radius };
            if (nav && !nav.visible(previous, next, .45)) { clear = false; break; }
            previous = next;
          }
          if (clear) { circle = candidate; diagnostics.circleRadius = radius; break search; }
        }
      }
      retreat = null;
      if (circle) {
        const rx = position.x - circle.x, rz = position.z - circle.z, radius = Math.hypot(rx, rz);
        // A small radial correction cancels integration drift without stopping
        // or reversing the constant clockwise movement.
        const correction = (circle.radius - radius) * 2, length = Math.max(.001, radius);
        const x = -rz / length + rx / length * correction, z = rx / length + rz / length * correction, speed = Math.hypot(x, z);
        retreat = { x: x / speed, z: z / speed };
      }
    }
    // Once a real pursuer has been selected, keep the 20-second sample going
    // even if it briefly drops out of the crowd query. Otherwise fast retreat
    // turns a nominal 20-second encounter into a sub-second measurement.
    if (style === 'retreat' && !retreat && sampleUntil !== null && sampleDirection && position) {
      const nav = world.infected?.nav;
      for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
        const x = sampleDirection.x * Math.cos(angle) - sampleDirection.z * Math.sin(angle);
        const z = sampleDirection.x * Math.sin(angle) + sampleDirection.z * Math.cos(angle);
        if (!nav || nav.visible(position, { x: position.x + x * 1.2, z: position.z + z * 1.2 }, .45)) { retreat = { x, z }; break; }
      }
    }
    // One sustained encounter sample in a marked combat phase per route, followed
    // by a physical return to the route so escort waits remain recoverable.
    if (retreat && sampleUntil === null) {
      sampleUntil = world.tick + 1200; sampleOrigin = { x: position!.x, z: position!.z }; sampleDirection = retreat;
    }
    kitingNow = !!retreat && sampleUntil !== null && world.tick < sampleUntil;
    if (kitingNow) sampleDirection = retreat;
    if (!kitingNow || !player?.weapons) {
      selectedButtonHeld = false;
      return frame;
    }
    const target = threats.reduce((nearest, entity) => !nearest ||
      Math.hypot(entity.transform.x - position!.x, entity.transform.z - position!.z) < Math.hypot(nearest.transform.x - position!.x, nearest.transform.z - position!.z) ? entity : nearest, undefined as typeof threats[number] | undefined);
    if (lastSampleTick !== world.tick) { receipt.kitingSeconds += 1 / 60; receipt.samples++; lastSampleTick = world.tick; }
    diagnostics.startTick ??= world.tick; diagnostics.endTick = world.tick;
    if (!threats.length) diagnostics.framesWithoutThreats++;
    const selectedSide = player.weapons.selectedSide;
    const rocket = world.combat?.runner.loadout.current(selectedSide).id === 'weapon.rocket-launcher';
    if (rocket && nextRocketFireTick < 0) nextRocketFireTick = world.tick + (level === 'L8' ? 600 : 300);
    const fire = rocket ? { down: world.tick >= nextRocketFireTick, held: false, up: false } : { down: !selectedButtonHeld, held: true, up: false };
    if (fire.down || fire.held) diagnostics.firingFrames++;
    if (rocket && fire.down) nextRocketFireTick = Number.POSITIVE_INFINITY;
    selectedButtonHeld = !rocket;
    // The sampled pursuer can leave the live visibility/range query while the
    // 20-second window continues. Keep aiming opposite the chosen retreat
    // direction instead of dividing the now-empty horde vector by zero.
    const aim = separation > .01 ? { x: -awayX / separation, z: -awayZ / separation } : { x: -retreat!.x, z: -retreat!.z };
    return { ...frame, walk: style === 'retreat',
      move: retreat!,
      aim, aimPoint: target ? { x: target.transform.x, z: target.transform.z } : centre ?? { x: position.x + aim.x * 10, z: position.z + aim.z * 10 }, aimSource: 'pointer',
      // Physical mouse fire is LEFT; ControlIntent maps it to selectedSide.
      left: fire, right: { down: false, held: false, up: false },
      mouseAttack: rocket ? fire.down : true,
    };
  };
  world.applyInput = (frame, scheme) => applyInput(kite(frame), scheme);
  // L1's shared generator uses partial setInput patches rather than applyInput.
  // Keep its native patch state separate so injected aim/fire never leaks into
  // the next patch after the encounter (or across a checkpoint clearInput).
  if (level === 'L1') {
    const setInput = world.setInput.bind(world), clearInput = world.clearInput.bind(world);
    let nativeFrame = structuredClone(world.deviceInput);
    world.setInput = patch => {
      nativeFrame = { ...nativeFrame, ...structuredClone(patch) };
      setInput(kite(nativeFrame));
    };
    world.clearInput = () => { clearInput(); nativeFrame = structuredClone(world.deviceInput); kitingNow = false; };
  }
  // Cinematic/death locks can leave fewer than 1,200 active frames in the
  // fixed window. Its elapsed clock, rather than sample count, ends the probe.
  return () => sampleUntil !== null && world.tick >= sampleUntil;
}

export function finishKitingReceipt(receipt: KitingReceipt): KitingReceipt {
  return { ...receipt, hits: receipt.hits ?? 0, hitsPerMinute: receipt.kitingSeconds > 0 ? (receipt.hits ?? 0) * 60 / receipt.kitingSeconds : 0,
    attacksPerMinute: receipt.kitingSeconds > 0 ? receipt.attacks * 60 / receipt.kitingSeconds : 0 };
}
