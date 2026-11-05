/** The public debug query accepts the values used by the PO and the earlier builds. */
export function debugFlagEnabled(params: URLSearchParams): boolean {
  return ['1', 'true'].includes(params.get('debug') ?? '');
}
