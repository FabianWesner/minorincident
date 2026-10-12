import { getStats } from '../_lib/telemetry';
import type { Env } from '../_lib/types';

export const onRequestGet = ({ request, env }: { request: Request; env: Env }): Promise<Response> => getStats(request, env);
