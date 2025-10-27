import { createOpenAI } from '@ai-sdk/openai';

// Configure OpenAI client with API key from environment variables
// This ensures the API key is properly set for browser usage
const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const openaiClient = openai(import.meta.env.VITE_AI_MODEL || 'gpt-4o-2024-11-20');

export default openaiClient;