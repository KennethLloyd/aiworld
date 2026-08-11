import { z } from 'zod';

import { SimulationActionContext } from '@/simulation/actions/action-context';
import { toActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import {
  SimulationActionResult,
  SimulationDecision,
} from '@/simulation/actions/simulation-decision';
import {
  LlmProvider,
  LlmProviderPrompt,
} from '@/simulation/providers/llm-provider.port';

/**
 * Template Method for the shared action lifecycle:
 * fetch context -> build prompt -> call provider -> parse result -> decide.
 * Actions own their action-specific work; the provider and context ports are
 * injected. Failures (inactive actors, missing targets, provider errors)
 * become a failed result instead of throwing.
 */
export abstract class SimulationAction<
  TCommand extends SimulationCommand,
  TContext extends SimulationActionContext,
  TOutput,
  TDecision extends SimulationDecision,
> {
  protected constructor(
    protected readonly contextProvider: SimulationContextProvider,
    protected readonly provider: LlmProvider,
  ) {}

  protected abstract readonly outputSchema: z.ZodType<TOutput>;

  protected abstract fetchContext(command: TCommand): Promise<TContext>;

  protected abstract buildPrompt(
    context: TContext,
    command: TCommand,
  ): LlmProviderPrompt;

  protected abstract toDecision(
    context: TContext,
    output: TOutput,
    command: TCommand,
  ): TDecision;

  async execute(command: TCommand): Promise<SimulationActionResult<TDecision>> {
    try {
      const context = await this.fetchContext(command);
      const prompt = this.buildPrompt(context, command);
      const { output, telemetry } = await this.provider.generateStructured({
        prompt,
        schema: this.outputSchema,
      });
      return {
        status: 'success',
        decision: this.toDecision(context, output, command),
        telemetry,
      };
    } catch (error) {
      return { status: 'failed', failure: toActionFailure(error) };
    }
  }
}
