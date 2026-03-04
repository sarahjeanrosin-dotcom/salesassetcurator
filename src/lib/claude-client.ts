import Anthropic from '@anthropic-ai/sdk';

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use haiku for classification (speed/cost), sonnet for insights (quality)
export const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
export const INSIGHTS_MODEL = 'claude-sonnet-4-6';
