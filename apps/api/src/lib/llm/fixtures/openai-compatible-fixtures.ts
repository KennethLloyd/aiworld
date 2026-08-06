export const openAiCompatibleRequestFixture = {
  model: 'deepseek-v4-flash',
  messages: [
    {
      role: 'system' as const,
      content: 'Return only valid JSON with the exact shape {"ok":true}.',
    },
    {
      role: 'user' as const,
      content: 'Respond with the requested health-check object.',
    },
  ],
  temperature: 0,
  response_format: { type: 'json_object' as const },
};

export const openAiCompatibleCompletionFixture = {
  id: 'fixture-completion-id',
  object: 'chat.completion' as const,
  model: 'deepseek-v4-flash',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant' as const,
        content: '{"ok":true}',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 124,
    completion_tokens: 51,
    total_tokens: 175,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 124,
    prompt_tokens_details: { cached_tokens: 0 },
    completion_tokens_details: { reasoning_tokens: 45 },
  },
};
