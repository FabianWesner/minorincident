/** The existing fix51-road qualifier defines moving as >=0.5 m/s from actual
 * x/z changes. Occupying the driver's seat alone does not advance that clock.
 * Keep long/unobserved intervals and the maximum sample interval conservative. */
type Observation = {
  tick: number;
  player?: { x: number; z: number };
  driving?: { id: number } | null;
  enemies: { drawn: boolean; hp: number }[];
};

export function drivingPresence(log: string) {
  const observations = log.trim().split('\n').filter(Boolean).flatMap(line => {
    const entry = JSON.parse(line) as { observation?: Observation };
    return entry.observation ? [entry.observation] : [];
  });
  const driving = observations.filter(row => row.driving);
  const lastTick = driving.at(-1)?.tick ?? 0;
  const firstInactiveTick = observations.find(row => row.tick > lastTick && !row.driving)?.tick ?? null;
  const positiveTicks: number[] = [];
  let previous: Observation | undefined;
  let maximumSamplingSeconds = 0, occupiedGap = 0, movingGap = 0;
  let largestOccupiedGapSeconds = 0, largestMovingGapSeconds = 0, excludedSlowSeconds = 0;
  const excludedIntervals: { from: number; to: number; seconds: number; metres: number }[] = [];
  const add = (seconds: number, movingSeconds: number) => {
    occupiedGap += seconds; movingGap += movingSeconds;
    largestOccupiedGapSeconds = Math.max(largestOccupiedGapSeconds, occupiedGap);
    largestMovingGapSeconds = Math.max(largestMovingGapSeconds, movingGap);
  };
  for (const row of driving) {
    const seconds = (row.tick - (previous?.tick ?? 0)) / 60;
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Non-monotonic L9 route clock');
    maximumSamplingSeconds = Math.max(maximumSamplingSeconds, seconds);
    let movingSeconds = seconds;
    if (previous?.player && row.player && Number.isFinite(row.driving?.id) && previous.driving?.id === row.driving?.id && seconds > 0 && seconds <= 1.5) {
      const metres = Math.hypot(row.player.x - previous.player.x, row.player.z - previous.player.z);
      if (Number.isFinite(metres) && metres / seconds < .5) {
        movingSeconds = 0; excludedSlowSeconds += seconds;
        excludedIntervals.push({ from: previous.tick, to: row.tick, seconds, metres });
      }
    }
    add(seconds, movingSeconds);
    if (row.enemies.some(enemy => enemy.drawn && enemy.hp > 0)) {
      positiveTicks.push(row.tick); occupiedGap = movingGap = 0;
    }
    previous = row;
  }
  // Unknown time at the crash/exit boundary counts fully as driving.
  if (firstInactiveTick !== null) add((firstInactiveTick - lastTick) / 60, (firstInactiveTick - lastTick) / 60);
  const measured = driving.length > 1 && firstInactiveTick !== null && positiveTicks.length > 0;
  const conservativeGapSeconds = measured ? largestMovingGapSeconds + maximumSamplingSeconds : null;
  return { observations: driving.length, positiveTicks, firstInactiveTick, maximumSamplingSeconds,
    largestOccupiedGapSeconds, largestMovingGapSeconds, excludedSlowSeconds, excludedIntervals,
    conservativeGapSeconds, targetSeconds: 60,
    pass: conservativeGapSeconds !== null && conservativeGapSeconds <= 60,
    method: 'Actual occupied APC/courier x/z intervals; existing fix51-road >=0.5m/s moving threshold. Exclude slow intervals only when same vehicle and sampling<=1.5s; unknown/long intervals and exit boundary count fully. Add maximum sampling interval to the largest moving-clock gap. Raw occupancy gap is retained.' };
}
