const sensitiveValuePattern =
  /((?:authorization|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*)(?!(?:Bearer)\b)([^\s,;]+)/giu;
const bearerTokenPattern = /\bBearer\s+[^\s,;]+/giu;

/** Keeps infrastructure diagnostics useful without retaining credentials or URLs. */
export function redactDiagnostics(value: string): string {
  return value
    .replace(sensitiveValuePattern, '$1[REDACTED]')
    .replace(bearerTokenPattern, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s"'<>]+/giu, '[URL_REDACTED]')
    .slice(0, 4_000);
}
