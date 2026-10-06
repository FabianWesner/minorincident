/** Stable line IDs used by mission scripts; subtitles do not require voice assets. */
export const dialogue: Record<string, string> = {
  'L1.briefing': 'Reports of an incident at Joe’s Diner. Check it out.',
  'L1.twist': 'Mission successful. Outbreak not contained.',
  'L2.briefing': 'Get the neighbors to the evacuation buses.',
  'L2.twist': 'They got out. You didn’t.',
  'L3.briefing': 'Civic Center gates close at 16:00. You have twelve minutes.',
  'L3.twist': 'The safe zone has fallen.',
  'L4.briefing': 'Restore the substation, rail crossing and bridge. Any order.',
  'L4.twist': 'The road is open. So is the way in.',
  'L5.briefing': 'Keep the route open until the convoy gets through.',
  'L5.fallback': 'Fall back!',
  'L5.twist': 'Convoy clear. Bridge down. You’re on your own.',
  'L6.briefing': 'Extraction chopper at the substation helipad at dawn.',
  'L6.twist': 'You survived the first day.',
};
