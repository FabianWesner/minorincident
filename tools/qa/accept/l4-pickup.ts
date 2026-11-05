/** Read-only ordinary-input evidence. A missing producer/voice/admission cannot
 * qualify the same-tick alarm criterion. No game timings are inferred from photos. */
export function l4PickupVerdict(events: {
  type: string; tick: number; actionId?: string; ids?: (number | { id: number; hp: number; hidden: boolean; pendingAdmission: boolean })[];
  observedWorldTick?: number; handled?: boolean; active?: boolean;
  voices?: { cue: string; gain: number; loop: boolean }[];
  scheduled?: { cue: string; time: number }[];
}[]): { status: 'PASS' | 'FAIL' | 'NOT CHECKED'; value: unknown } {
  const pickups = events.filter(e => e.type === 'pickup.collected' && e.actionId === 'weapon.army-mg');
  const guns = events.filter(e => e.type === 'l4.gun'), turns = events.filter(e => e.type === 'l4.firstTurn');
  const alarms = events.filter(e => e.type === 'actual-klaxon-start');
  const admission = events.find(e => e.type === 'actual-l4-admissions');
  const value = { pickupTicks: pickups.map(e => e.tick), gunTicks: guns.map(e => e.tick), turnTicks: turns.map(e => e.tick), alarms, firstAdmission: admission ?? null };
  if (pickups.length !== 1 || guns.length !== 1 || turns.length !== 1 || alarms.length !== 1 || !admission) return { status: 'NOT CHECKED', value };
  const tick = pickups[0].tick, alarm = alarms[0], turn = turns[0];
  const admitted = (admission.ids ?? []).filter((id): id is { id: number; hp: number; hidden: boolean; pendingAdmission: boolean } => typeof id !== 'number' && id.hp > 0 && !id.hidden && !id.pendingAdmission);
  const sameTick = [guns[0].tick, turn.tick, alarm.tick, alarm.observedWorldTick, admission.tick].every(t => t === tick);
  const actualVoices = alarm.handled && alarm.active && (alarm.voices?.length ?? 0) > 0 &&
    alarm.voices!.every(voice => voice.cue === 'l4.klaxon' && voice.gain > 0 && voice.loop) &&
    (alarm.scheduled?.length ?? 0) > 0 && alarm.scheduled!.every(voice => voice.cue === 'l4.klaxon' && Number.isFinite(voice.time));
  const firstWavePresent = (turn.ids?.length ?? 0) > 0 && turn.ids!.every(id => typeof id === 'number' && admitted.some(actor => actor.id === id));
  return { status: sameTick && actualVoices && firstWavePresent ? 'PASS' : 'FAIL', value };
}
