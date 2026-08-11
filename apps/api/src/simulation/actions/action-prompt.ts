import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { LlmProviderPrompt } from '@/simulation/providers/llm-provider.port';

export type PromptSection = {
  heading: string;
  body: string;
};

export type ActionPromptInput = {
  action: SimulationActionType;
  instructions: string;
  outputFormat: string;
  contextSections: PromptSection[];
};

/** Splits a composed prompt into standing instructions (system) and the
 * per-World/per-character context (user). The action keyword appears in the
 * system prompt, which is what lets the mock provider select its fixture. */
export function composeActionPrompt(
  input: ActionPromptInput,
): LlmProviderPrompt {
  const system = [
    `You are an AI resident performing a ${input.action} action in a shared World.`,
    input.instructions,
    `Respond with valid JSON matching exactly this format:`,
    input.outputFormat,
  ].join('\n\n');

  const user = input.contextSections
    .map((section) => `## ${section.heading}\n${section.body}`)
    .join('\n\n');

  return { system, user };
}
