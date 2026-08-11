import { z } from 'zod';

import { ProviderConfig } from '@/lib/llm/provider-config';

export type LlmProviderPrompt = {
  system: string;
  user: string;
};

export type LlmProviderTokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

export type LlmProviderTelemetry = {
  source: string;
  model: string;
  latencyMs: number;
  tokens?: LlmProviderTokenUsage;
  costEstimateUsd?: number;
};

export type LlmProviderRequest<T> = {
  prompt: LlmProviderPrompt;
  schema: z.ZodType<T>;
  temperature?: number;
};

export type LlmProviderResult<T> = {
  output: T;
  telemetry: LlmProviderTelemetry;
};

export abstract class LlmProvider {
  abstract readonly config: ProviderConfig;

  abstract generateStructured<T>(
    request: LlmProviderRequest<T>,
  ): Promise<LlmProviderResult<T>>;
}
