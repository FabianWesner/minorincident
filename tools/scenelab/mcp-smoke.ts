import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Scripted MCP client: exercises the Scene Lab server end to end (npx tsx tools/scenelab/mcp-smoke.ts). */
const client = new Client({ name: 'scene-lab-smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'tools/scenelab/mcp.ts'], stderr: 'inherit' }));
const call = async (name: string, args: Record<string, unknown> = {}) => {
  // The first call may wait for the shared e2e browser lock: allow minutes, not the 60 s default.
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 }) as { content: { type: string; text?: string; data?: string }[]; isError?: boolean };
  if (result.isError) throw new Error(`${name}: ${result.content[0]?.text}`);
  const textPart = result.content.find(c => c.type === 'text')?.text ?? '';
  const image = result.content.find(c => c.type === 'image');
  console.log(`# ${name}${image ? ` (+ inline PNG ${Math.round(image.data!.length * 3 / 4 / 1024)} KB)` : ''}\n${textPart.slice(0, 600)}${textPart.length > 600 ? ' ...' : ''}`);
  return textPart;
};
try {
  const tools = await client.listTools();
  console.log(`tools: ${tools.tools.map(t => t.name).join(', ')}`);
  await call('load_scene', { spec: { name: 'mcp-smoke', ground: 'grass', size: 24, props: [{ id: 'bench', asset: 'prop.bench', at: [0, 0], yaw: 90 }], camera: { mode: 'close', target: [0, 0.6, 0], radius: 6, azimuth: 150 } } });
  await call('spawn_actor', { kind: 'pedestrian', id: 'walker', at: [3, -3], look: { model: 'npc.civilian-woman-a', tint: '#3d7fbf' }, state: { walk: [[-3, -3], [3, -3]], loop: true } });
  await call('spawn_actor', { kind: 'courier', id: 'courier', at: [-3, 2] });
  await call('command', { actor: 'courier', action: { run: [[3, 2], [-3, 2]] } });
  await call('step', { frames: 90 });
  await call('set_time', { preset: 'golden' });
  await call('screenshot', { name: 'mcp-smoke' });
  const metrics = JSON.parse(await call('metrics'));
  await call('clipping');
  if (!metrics.actors.walker || metrics.frame !== 90) throw new Error('unexpected metrics');
  console.log('MCP smoke OK');
} finally { await call('close').catch(() => {}); await client.close(); }
