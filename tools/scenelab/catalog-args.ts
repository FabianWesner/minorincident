/** Trailing npm-script options override defaults such as the matrix backend/filter. */
export function catalogFlag(args: string[], name: string): string | undefined {
  const index = args.lastIndexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}
