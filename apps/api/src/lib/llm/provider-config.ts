import { z } from 'zod';

import {
  ProviderCapabilityError,
  ProviderConfigurationError,
} from './provider-error.js';

export const providerIds = ['mock', 'openai-compatible'] as const;
export const structuredOutputModes = [
  'json-schema',
  'json-object',
  'text-json-fallback',
  'unsupported',
] as const;
export const usageMetadataModes = [
  'required',
  'optional',
  'unavailable',
] as const;

export type ProviderId = (typeof providerIds)[number];
export type StructuredOutputMode = (typeof structuredOutputModes)[number];
export type UsageMetadataMode = (typeof usageMetadataModes)[number];

/** Bounded exponential backoff policy for transient provider failures. */
export type RetryPolicy = {
  /** Initial backoff delay in milliseconds. */
  baseDelayMs: number;
  /** Backoff ceiling in milliseconds. */
  maxDelayMs: number;
  /** Fraction of the delay applied as jitter (0..1). */
  jitterRatio: number;
};

export type ProviderConfig = {
  providerId: ProviderId;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxConcurrency: number;
  retry: RetryPolicy;
  capabilities: {
    structuredOutput: StructuredOutputMode;
    usageMetadata: UsageMetadataMode;
  };
};

const providerConfigInputSchema = z
  .object({
    providerId: z.enum(providerIds).default('mock'),
    baseUrl: z.url().optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    timeoutMs: z.coerce.number().int().positive().max(120_000).default(30_000),
    maxRetries: z.coerce.number().int().nonnegative().max(10).default(2),
    maxConcurrency: z.coerce.number().int().positive().max(100).default(1),
    retryBaseDelayMs: z.coerce
      .number()
      .int()
      .positive()
      .max(60_000)
      .default(250),
    retryMaxDelayMs: z.coerce
      .number()
      .int()
      .positive()
      .max(300_000)
      .default(8_000),
    retryJitterRatio: z.coerce.number().min(0).max(1).default(0.25),
    structuredOutput: z
      .enum(structuredOutputModes)
      .default('text-json-fallback'),
    usageMetadata: z.enum(usageMetadataModes).default('optional'),
  })
  .superRefine((data, ctx) => {
    if (data.retryMaxDelayMs < data.retryBaseDelayMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['retryMaxDelayMs'],
        message:
          'retryMaxDelayMs must be greater than or equal to retryBaseDelayMs',
      });
    }
  });

type ProviderEnvironment = Record<string, string | undefined>;

/** Empty environment strings are treated as absent, so a `.env` that sets
 * `LLM_MODEL=` (for example) still falls back to defaults instead of failing
 * validation. */
function envValue(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() === '' ? undefined : value;
}

function getMissingProductionValues(
  providerId: ProviderId,
  config: z.infer<typeof providerConfigInputSchema>,
): string[] {
  if (providerId === 'mock') {
    return [];
  }

  const required: Array<[string, string | undefined]> = [
    ['LLM_BASE_URL', config.baseUrl],
    ['LLM_API_KEY', config.apiKey],
    ['LLM_MODEL', config.model],
  ];

  return required.flatMap(([key, value]) => (value === undefined ? [key] : []));
}

export function loadProviderConfig(
  env: ProviderEnvironment = process.env,
): ProviderConfig {
  const parsed = providerConfigInputSchema.safeParse({
    providerId: envValue(env.LLM_PROVIDER),
    baseUrl: envValue(env.LLM_BASE_URL),
    apiKey: envValue(env.LLM_API_KEY),
    model: envValue(env.LLM_MODEL),
    timeoutMs: envValue(env.LLM_TIMEOUT_MS),
    maxRetries: envValue(env.LLM_MAX_RETRIES),
    maxConcurrency: envValue(env.LLM_MAX_CONCURRENCY),
    retryBaseDelayMs: envValue(env.LLM_RETRY_BASE_DELAY_MS),
    retryMaxDelayMs: envValue(env.LLM_RETRY_MAX_DELAY_MS),
    retryJitterRatio: envValue(env.LLM_RETRY_JITTER_RATIO),
    structuredOutput: envValue(env.LLM_STRUCTURED_OUTPUT),
    usageMetadata: envValue(env.LLM_USAGE_METADATA),
  });

  if (!parsed.success) {
    throw new ProviderConfigurationError('Invalid LLM provider configuration');
  }

  const missing = getMissingProductionValues(
    parsed.data.providerId,
    parsed.data,
  );
  if (missing.length > 0) {
    throw new ProviderConfigurationError(
      `Missing required LLM provider configuration: ${missing.join(', ')}`,
    );
  }

  return {
    providerId: parsed.data.providerId,
    baseUrl: parsed.data.baseUrl?.replace(/\/+$/, ''),
    apiKey: parsed.data.apiKey,
    model: parsed.data.model ?? 'mock',
    timeoutMs: parsed.data.timeoutMs,
    maxRetries: parsed.data.maxRetries,
    maxConcurrency: parsed.data.maxConcurrency,
    retry: {
      baseDelayMs: parsed.data.retryBaseDelayMs,
      maxDelayMs: parsed.data.retryMaxDelayMs,
      jitterRatio: parsed.data.retryJitterRatio,
    },
    capabilities: {
      structuredOutput: parsed.data.structuredOutput,
      usageMetadata: parsed.data.usageMetadata,
    },
  };
}

export function toSafeProviderConfig(config: ProviderConfig) {
  return {
    providerId: config.providerId,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    maxConcurrency: config.maxConcurrency,
    retry: config.retry,
    capabilities: config.capabilities,
    hasApiKey: config.apiKey !== undefined,
  };
}

/** Asserts the configured capability declares support for a requested native
 * mode (json-object or json-schema). */
export function assertStructuredOutputCapability(
  config: Pick<ProviderConfig, 'capabilities'>,
  requested: 'json-object' | 'json-schema',
): void {
  const configured = config.capabilities.structuredOutput;
  const supportsRequest =
    requested === 'json-schema'
      ? configured === 'json-schema'
      : configured === 'json-schema' || configured === 'json-object';

  if (!supportsRequest) {
    throw new ProviderCapabilityError(
      `Provider does not support native ${requested} structured output`,
    );
  }
}

/** Gates generation; rejects unsupported and the unverified json-schema
 * mode. Shared by both provider implementations. */
export function assertStructuredOutputEnabled(
  config: Pick<ProviderConfig, 'capabilities'>,
): void {
  if (config.capabilities.structuredOutput === 'unsupported') {
    throw new ProviderCapabilityError(
      'Provider does not support structured output',
    );
  }
  if (config.capabilities.structuredOutput === 'json-schema') {
    throw new ProviderCapabilityError(
      'json-schema structured output is not supported by this provider',
    );
  }
}
