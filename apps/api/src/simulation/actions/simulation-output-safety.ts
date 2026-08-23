import { SimulationOutputSafetyError } from './simulation-action.error';
export const simulationOutputLimits = {
  title: 160,
  content: 4_000,
  reasoning: 2_000,
} as const;

// Generated content is rendered as plain text. Reject every tag-like token,
// including links/images and event-handler attributes, so a future renderer
// cannot accidentally turn provider output into markup.
const markupPattern = /<[^>]*>/u;
const secretPattern =
  /(?:-----BEGIN [^-]+ PRIVATE KEY-----|\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|authorization|bearer|client[_ -]?secret|password)\s*[:=])/iu;

function assertSafeText(value: string, field: string, maximum: number): void {
  if (value.length > maximum) {
    throw new SimulationOutputSafetyError(
      `${field} exceeds the ${maximum}-character safety limit`,
    );
  }
  if (containsUnsupportedControlCharacter(value)) {
    throw new SimulationOutputSafetyError(
      `${field} contains unsupported control characters`,
    );
  }
  if (markupPattern.test(value)) {
    throw new SimulationOutputSafetyError(
      `${field} contains unsupported executable markup`,
    );
  }
  if (secretPattern.test(value)) {
    throw new SimulationOutputSafetyError(
      `${field} appears to contain credentials or private configuration`,
    );
  }
}

function containsUnsupportedControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      (codePoint >= 0 && codePoint <= 0x08) ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f) ||
      codePoint === 0x7f
    );
  });
}

function assertReasoning(reasoning: string): void {
  assertSafeText(reasoning, 'reasoning', simulationOutputLimits.reasoning);
}

export function assertSafeSimulationOutput(
  action: 'POST' | 'VOTE' | 'COMMENT',
  output: unknown,
): void {
  if (typeof output !== 'object' || output === null) {
    throw new SimulationOutputSafetyError(
      `${action} output must be a structured object`,
    );
  }

  const record = output as Record<string, unknown>;
  const readText = (field: string): string => {
    const value = record[field];
    if (typeof value !== 'string') {
      throw new SimulationOutputSafetyError(
        `${action} output field "${field}" must be text`,
      );
    }
    return value;
  };

  switch (action) {
    case 'POST':
      assertSafeText(readText('title'), 'title', simulationOutputLimits.title);
      assertSafeText(
        readText('content'),
        'content',
        simulationOutputLimits.content,
      );
      assertReasoning(readText('reasoning'));
      return;
    case 'COMMENT':
      assertSafeText(
        readText('content'),
        'content',
        simulationOutputLimits.content,
      );
      assertReasoning(readText('reasoning'));
      return;
    case 'VOTE':
      assertReasoning(readText('reasoning'));
      return;
  }
}
