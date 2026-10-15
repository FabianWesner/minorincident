/** Hand-authored "Made by" credits (PO 2026-10-15). Shown first in the menu credits and the L10 end-credits roll;
 * the generated licence list in ./credits.ts follows unchanged. */
export interface MadeByGroup { id: string; heading: string; names: readonly string[] }

export const madeBy = {
  headline: 'Made by Fabian Wesner, with a crew of AI agents',
  author: { name: 'Fabian Wesner', role: 'Idea, direction and product owner', url: 'https://www.linkedin.com/in/fabian-wesner/' },
  groups: [
    { id: 'models', heading: 'AI models', names: ['Anthropic Claude Opus 5.5', 'Anthropic Claude Sonnet 5.5', 'Anthropic Claude Haiku 5.5', 'Anthropic Claude Fable 5.1', 'OpenAI GPT-6.1 Sol', 'OpenAI GPT-6 Luna', 'OpenAI GPT-6 Astra'] },
    { id: 'harnesses', heading: 'Harnesses', names: ['Claude Code (Anthropic)', 'OpenAI Codex CLI', 'codex-scheduler (lane orchestration)'] },
    { id: 'tools', heading: 'Tools', names: ['Blender (headless asset builds)'] },
  ] as readonly MadeByGroup[],
  thanks: 'Thanks for riding along, courier.',
} as const;
