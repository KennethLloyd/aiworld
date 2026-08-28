import { Injectable } from '@nestjs/common';

import {
  providerIds,
  type ProviderConfig,
  type ProviderId,
} from '@/lib/llm/provider-config';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationConfigMalformedError } from '@/simulation/lifecycle/simulation-lifecycle.error';

import { LlmProvider } from './llm-provider.port';
import { createLlmProvider } from './llm-provider.registry';

type WorldProviderConfig = Pick<
  WorldSimulationConfigRecord,
  'worldId' | 'providerId' | 'model'
>;

/** Resolves the server-side provider adapter for a World's persisted selection.
 * Credentials and transport policy come only from the process configuration;
 * World config supplies identity and model, never secrets. */
export abstract class SimulationLlmProviderResolver {
  abstract resolve(config: WorldProviderConfig): LlmProvider;
}

@Injectable()
export class ConfiguredSimulationLlmProviderResolver extends SimulationLlmProviderResolver {
  constructor(private readonly processConfig: ProviderConfig) {
    super();
  }

  resolve(config: WorldProviderConfig): LlmProvider {
    const providerId = this.resolveProviderId(config);
    if (config.model.trim() === '') {
      throw new SimulationConfigMalformedError(
        config.worldId,
        'model must be a non-empty string',
      );
    }

    if (
      providerId === 'openai-compatible' &&
      (this.processConfig.baseUrl === undefined ||
        this.processConfig.apiKey === undefined)
    ) {
      throw new SimulationConfigMalformedError(
        config.worldId,
        'openai-compatible provider credentials are not configured on the server',
      );
    }

    return createLlmProvider({
      ...this.processConfig,
      providerId,
      model: config.model,
    });
  }

  private resolveProviderId(config: WorldProviderConfig): ProviderId {
    const providerId = providerIds.find(
      (candidate) => candidate === config.providerId,
    );
    if (providerId === undefined) {
      throw new SimulationConfigMalformedError(
        config.worldId,
        `providerId "${config.providerId}" is not supported`,
      );
    }
    return providerId;
  }
}
