import { postReplay } from '../_lib/telemetry';
import type { Env } from '../_lib/types';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }): Promise<Response> => postReplay(request, env);
