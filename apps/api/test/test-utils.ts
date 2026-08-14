/** Sets environment variables for the duration of a single Jest hook and
 * restores the previous environment afterwards. Suites that select an adapter
 * or provider via `process.env` must set it before the Nest module compiles,
 * so the whole compile-and-init sequence runs inside the wrapped function. */
export function withEnv(
  env: Record<string, string>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const previous = { ...process.env };
    Object.assign(process.env, env);
    try {
      await fn();
    } finally {
      process.env = previous;
    }
  };
}
