/** Interaction instructions use the same ACTION label as the touch controls. */
export function devicePrompt(value: string, touch: boolean): string {
  if (!touch) return value;
  return value.replace(/\b[Pp]ress ([EF])(?: \/ middle-click| \/ MMB)?\b/g, match => match.startsWith('P') ? 'Tap ACTION' : 'tap ACTION')
    .replace(/\b[EF](?: \/ middle-click| \/ MMB)?\b/g, 'ACTION');
}
