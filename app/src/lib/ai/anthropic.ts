import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  // Don't throw at import time — server-side modules might import this even
  // for dev pages that never call Claude. Throw on actual use instead.
  console.warn('[ai] ANTHROPIC_API_KEY missing — Claude calls will fail');
}

export const anthropic = new Anthropic({ apiKey });
export const CLAUDE_MODEL = 'claude-sonnet-4-6';
