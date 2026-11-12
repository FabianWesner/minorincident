import { footYaw, summarizeMotion, unplantedClips } from '../../src/debug/scenelab/motion';

export interface VehicleMotionFrame {
  frame: number; tick: number; clip: string; archetype: string; state: string; floor: number;
  feet: { heel: number[]; toe: number[] }[];
  reaction: { heavy: boolean; started: number; until: number } | null;
  special: string | null; rising: boolean;
  alphaType?: string; phase?: number; speed?: number;
  at?: number[];
}

/** Keep missing contacts distinct from zero slide, and verify every exclusion. */
export function vehicleTrackVerdict(key: string, frames: VehicleMotionFrame[]) {
  const motion = summarizeMotion(frames.map(f => ({ ...f,
    // Pounce/charge names alone cannot exempt planted feet from slide checks.
    clip: /^alpha-(pounce|charge)$/.test(f.clip) ? 'vehicle-special-motion' : f.clip,
    feet: f.feet.map(foot => ({ ...foot, yaw: footYaw(foot.heel, foot.toe) })),
  })));
  const feet = frames.length && /infected\.(dog|cat|lion|lioness|zebra|gorilla|elephant|monkey)$/.test(frames[0].archetype) ? 4 : 2;
  const complete = frames.length > 0 && frames.every(f => Number.isFinite(f.floor) && f.feet.length === feet
    && f.feet.every(foot => [foot.heel, foot.toe].every(point => point.length === 3 && point.every(Number.isFinite))));
  const airborne = (f: VehicleMotionFrame) => f.feet.every(foot => Math.min(foot.heel[1], foot.toe[1]) > f.floor + .012);
  const matchingAction = (f: VehicleMotionFrame) => /^(knockdown|flung|get-up)$/.test(f.clip) && f.reaction?.heavy
    && f.reaction.started <= f.tick && f.tick < f.reaction.until
    || f.clip === 'alpha-pounce' && f.special === 'alpha.pounce'
    || f.clip === 'alpha-pounce' && f.alphaType === 'leaper' && (f.speed ?? Infinity) <= .06 && Math.abs((f.phase ?? Infinity) - .22) <= 1e-6
    || f.clip === 'alpha-charge' && f.special === 'alpha.charge'
    || f.clip === 'infection-rise' && f.rising;
  const actionsMatched = frames.every(f => !unplantedClips.test(f.clip) || matchingAction(f));
  const airborneAttachment = complete && frames.every(f => f.state === 'attached' && airborne(f));
  const matchedReaction = complete && frames.every(f => matchingAction(f)
    && (!/^alpha-(pounce|charge)$/.test(f.clip) || airborne(f) && f.special === `alpha.${f.clip.slice(6)}`));
  const mixedUnplanted = complete && frames.every(f => f.state === 'attached' && airborne(f) || matchingAction(f)
    && (!/^alpha-(pounce|charge)$/.test(f.clip) || airborne(f) && f.special === `alpha.${f.clip.slice(6)}`));
  // A hull/visibility boundary can expose only the flight part of a running
  // step. Require a short, advancing, near-floor swing, never floating walking.
  let phaseTravel = 0, rootTravel = 0;
  for (let i = 1; i < frames.length; i++) {
    phaseTravel += ((frames[i].phase ?? NaN) - (frames[i - 1].phase ?? NaN) + 1) % 1;
    const a = frames[i].at, b = frames[i - 1].at;
    rootTravel += a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN;
  }
  const runningFlight = complete && frames.length >= 2 && frames.length <= 12 && phaseTravel > .02 && phaseTravel <= .5 && rootTravel > .03
    && frames.every((f, i) => (i === 0 || f.frame === frames[i - 1].frame + 1) && airborne(f)
      && (f.speed ?? 0) >= 2 && /^(run|infected-(run|sprint|lurch)|dog-gallop|zebra-stampede)$/.test(f.clip))
    && Math.min(...frames.flatMap(f => f.feet.map(foot => Math.min(foot.heel[1], foot.toe[1]) - f.floor))) <= .08
    && frames[0].feet.every((_, i) => {
      const heights = frames.map(f => Math.min(f.feet[i].heel[1], f.feet[i].toe[1]) - f.floor);
      return Math.max(...heights) - Math.min(...heights) >= .008;
    });
  const classification = motion.slideP95Cm !== null ? 'grounded' : airborneAttachment ? 'airborne-attachment' : matchedReaction ? 'matched-unplanted-action'
    : mixedUnplanted ? 'mixed-unplanted-actions' : runningFlight ? 'running-flight-window' : 'unproven';
  const pass = complete && actionsMatched && (classification === 'grounded' ? motion.slideMaxCm <= 15 && motion.slideP95Cm! <= 5 : classification !== 'unproven');
  return { key, classification, complete, actionsMatched, pass, motion };
}
