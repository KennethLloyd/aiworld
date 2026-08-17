# Plan 08: OpenCode Go Adapter

Status: In Progress
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`.

## Goal

Connect the already-tested simulation port to OpenCode Go without changing
simulation actions, prompts, repositories, or controllers.

## Existing Foundation

Plan 03 already shipped the provider seam this plan builds on — do not re-derive
it: the configuration loader and provider ID selection
(`apps/api/src/lib/llm/provider-config.ts`), capability modes including
`text-json-fallback` and the capability assert helper, safe provider config
reporting that strips secrets (`toSafeProviderConfig`), and provider error
mapping (`provider-error.ts`). This plan writes only the delta below and
references those files as foundations.

## Scope

- OpenCode Go Adapter implementing `LLMProvider`
- Provider registry/factory selecting Mock or OpenCode Go by the configured
  provider ID
- Timeout and retry decorator/service (including the retry/backoff policy
  flagged as open in Plan 03)
- Response normalization
- Structured-output capability handling and the pending json-schema-capability
  verification flagged in Plan 03
- Token, latency, and configurable cost telemetry
- Safe error mapping into SimulationLog, extending the existing mapping
- Mock provider retained for tests and local offline development

## Configuration Rules

- Credentials are server-side only.
- Base URL, model, timeout, limits, and provider ID are configuration values.
- No endpoint, model, secret, or pricing assumption is hardcoded.
- The subscription model is not represented as a hardcoded per-token billing
  model; cost estimates remain configurable.

## Tests

- Adapter request mapping uses sanitized fixtures.
- Credentials never appear in logs or response contracts.
- Timeout, retry, rate-limit, malformed-response, and capability errors map to
  stable domain errors, reusing the Plan 03 helpers rather than duplicating them.
- Provider registry selects Mock or OpenCode Go from configuration.
- Mock and real adapters satisfy the same port contract.
- Simulation actions remain unchanged when the provider changes.

## Browser Verification

Do not expose provider credentials in browser automation. Verify the admin
telemetry/log surface eventually reports provider ID, model, latency, and
status without secrets:

```bash
agent-browser --session aiworld-provider-admin open http://localhost:3000/api/docs
agent-browser --session aiworld-provider-admin wait --load networkidle
agent-browser --session aiworld-provider-admin snapshot -i
agent-browser --session aiworld-provider-admin get title
agent-browser --session aiworld-provider-admin close
```

After Plan 10, add an authenticated browser assertion that the log detail shows
provider and model metadata while omitting API keys and authorization headers.

## Senior-Level Implementation Standard

Keep vendor code in one adapter. Use a registry/factory for provider selection
and a decorator or dedicated context service for retries, timeouts, telemetry,
and error mapping. Capability differences must be explicit rather than hidden
behind unsafe assumptions or broad casts.

## Implementation Record

Status: In Progress (08-1 OpenCode Go adapter and provider registry implemented —
PR #115 merged; 08-2 retry/timeout/telemetry and SimulationLog error mapping
implemented — PR open pending review, tracked as #46)

### 08-2 Retry, Timeout, Telemetry, and Error Mapping (2026-08-17)

#### Senior-Level Summary

Provider calls are now wrapped in a `RetryingLlmProvider` decorator that applies
bounded exponential backoff with jitter, honoring a server `Retry-After` value
when present, and retries only transient failures (timeout, network, 408, 429,
5xx) up to the configured `LLM_MAX_RETRIES` budget. Permanent failures
(authentication, malformed response, capability, unknown) fail immediately. The
retry policy (base delay, ceiling, jitter ratio) is configuration-driven
(`LLM_RETRY_BASE_DELAY_MS`, `LLM_RETRY_MAX_DELAY_MS`, `LLM_RETRY_JITTER_RATIO`)
and reported through `toSafeProviderConfig` without secrets. The adapter now
captures the `Retry-After` header and carries it on the mapped `ProviderError`
(`retryAfterMs`), so the decorator can honor the provider's instruction. All
error mapping reuses the Plan 03 `mapProviderError` helper — nothing is
duplicated.

The remaining acceptance criteria were already satisfied by earlier plans and
are covered by existing focused tests, not re-implemented here: token, latency,
and configurable cost telemetry flows into `SimulationLog` via
`SimulationLogService` and the configurable `SimulationCostEstimator`
(`simulation-log.service.spec.ts`), and the admin log detail reports
provider/model/latency/tokens/cost while omitting keys, auth headers, and raw
prompts/responses (`simulation-admin-response.mapper.spec.ts`). This ticket adds
the retry layer, `Retry-After` handling, and the retry policy configuration, and
proves the stable error mapping and secret-free log surface with focused tests.
The scheduler e2e cadence assertion is also isolated to post-`testStart` logs,
requires successful scheduled POSTs, and uses deterministic POST weights so
historical rows and random action selection cannot mask a failed tick.

#### Files Changed

- `apps/api/src/simulation/providers/retry/retrying-llm.provider.ts` (+spec) — retry/backoff decorator
- `apps/api/src/simulation/providers/llm-provider.registry.ts` (+spec) — `createBaseLlmProvider` + retry-wrapped `createLlmProvider`
- `apps/api/src/lib/llm/provider-error.ts` (+spec) — `retryAfterMs` on `ProviderError` and `mapProviderError`
- `apps/api/src/lib/llm/provider-config.ts` (+spec) — retry policy config + validation
- `apps/api/src/simulation/providers/openai-compatible/openai-compatible-llm.provider.ts` (+spec) — `Retry-After` header capture
- `apps/api/src/app.module.spec.ts` — registry resolves retry-wrapped mock
- `apps/api/.env.example` — retry policy keys
- `docs/providers/openai-compatible-contract.md` — retry policy documented
- `apps/api/test/simulation-scheduler.e2e-spec.ts` — deterministic, time-windowed scheduler polling and timeout diagnostics

#### Architecture and SOLID Notes

- Retry is a decorator over the `LlmProvider` port, provider-agnostic and
  applied uniformly by the registry; the module wiring is unchanged.
- The retry policy lives in `ProviderConfig` alongside the other limits, so
  safe config reporting covers it and no pricing/endpoint assumption is
  hardcoded.
- `Retry-After` travels as metadata on the mapped `ProviderError`; the adapter
  never leaks the response body, and the decorator only reads the delay.
- Error mapping stays in the Plan 03 helper; the decorator and adapter reuse it
  rather than re-deriving codes.

#### Tests Run

- `SCHEDULER_ADAPTER=in-process pnpm --filter @aiworld/api exec jest --runInBand`
  — 67 suites, 501 tests passed (retry budget, backoff/jitter bounds,
  Retry-After honoring, permanent-failure no-retry, config validation,
  adapter header capture, registry wrapping, module wiring)
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`
- `pnpm --filter @aiworld/api build`
- `pnpm --filter @aiworld/api exec tsc --noEmit` — no new errors (6 pre-existing
  type errors in search/e2e specs exist on `main` independently of this change)
- `DATABASE_URL=... REDIS_URL=... SCHEDULER_ADAPTER=bullmq node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand`
  — 12 suites, 123 tests passed against OrbStack PostgreSQL and Redis
- Explicit-env API unit suite — 67 suites, 502 tests passed
- Web format, lint, build, and tests — all passed

#### Browser Verification

Not applicable to 08-2 (server-side retry/telemetry only; no UI surface). The
admin log surface already reports provider/model/latency/tokens/cost without
secrets (covered by the admin response mapper spec).

#### Known Risks and Follow-Up Work

- Live OpenCode Go `Retry-After`/backoff behavior still needs credentials and
  is tracked as a manual `provider:smoke`-style step.
- `json-schema` structured output remains explicitly unsupported until native
  schema output is verified against a live provider.

### 08-1 OpenCode Go Adapter and Provider Registry (2026-08-16)

#### Senior-Level Summary

The engine can now select OpenCode Go as its provider from configuration. The
`OpenAiCompatibleLlmProvider` adapter keeps all vendor code in one file behind
the existing `LlmProvider` port: it maps a request to the OpenAI-compatible
`/chat/completions` wire contract, applies the configured structured-output
mode explicitly (native `json_object` request format vs. the shared text-to-JSON
fallback parser), surfaces a single-attempt timeout via `AbortController`, maps
failures through the existing Plan 03 `mapProviderError` helper (credentials
never enter telemetry, results, request bodies, or mapped errors), and reports
token/latency telemetry. A `createLlmProvider` registry selects Mock or the
OpenCode Go adapter from `LLM_PROVIDER`, and `simulation.module.ts` now wires
the provider through it — actions, prompts, repositories, and controllers are
untouched. The mock and the real adapter share the same capability gate and
response normalizer, so "Mock and real adapters satisfy the same port contract"
holds; a `VoteAction` spec proves the same decision is produced when the
provider switches.

The Plan 03 json-schema hand-off is resolved as an explicit Plan 08 decision:
`json-schema` mode is **not supported** (the verified OpenCode Go profile only
returns JSON objects, and native schema output was not live-verified), so both
providers reject it with a clear `ProviderCapabilityError` instead of silently
sending an unverified request. The `json-schema` config vocabulary remains so a
provider that is later verified to support it can enable it then.

#### Files Changed

- `apps/api/src/simulation/providers/openai-compatible/openai-compatible-llm.provider.ts` (+spec) — OpenCode Go/OpenAI-compatible adapter
- `apps/api/src/simulation/providers/llm-provider.registry.ts` (+spec) — provider registry/factory
- `apps/api/src/simulation/providers/llm-provider.output.ts` — shared structured-output response normalizer
- `apps/api/src/lib/llm/provider-config.ts` (+spec) — `assertStructuredOutputEnabled` capability gate
- `apps/api/src/simulation/providers/mock/mock-llm.provider.ts` (+spec) — shared gate + consistent json-schema rejection
- `apps/api/src/simulation/simulation.module.ts` — provider resolved via registry
- `apps/api/src/simulation/actions/vote.action.spec.ts` — provider-switch proof
- `apps/api/src/app.module.spec.ts` — registry resolves mock by default

#### Architecture and SOLID Notes

- Vendor code is confined to the single adapter; the simulation domain depends
  only on the abstract `LlmProvider` port, so simulation actions are unchanged
  when the provider switches.
- Registry/factory selects the concrete provider from runtime configuration;
  the module binds it with `useFactory` and never constructs a provider inside
  domain services.
- Capability differences are explicit: `assertStructuredOutputEnabled` gates
  generation (rejecting `unsupported` and the unverified `json-schema` mode),
  `responseFormat` maps the mode to an explicit wire request, and the shared
  `parseStructuredOutputByMode` normalizes responses. No broad casts or silent
  degradation.
- Credentials are server-side only; `toSafeProviderConfig` and the adapter's
  telemetry/errors never include the key, and error payloads deliberately
  ignore the response body.

#### Tests Run

- `SCHEDULER_ADAPTER=in-process pnpm --filter @aiworld/api exec jest --runInBand`
  — 66 suites, 484 tests passed (adapter request mapping, response
  normalization from sanitized fixtures, error mapping, timeout, capability
  errors, credential hygiene, registry selection, module wiring, provider-switch
  action proof)
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`
- `pnpm --filter @aiworld/api build`
- `pnpm --filter @aiworld/api exec tsc --noEmit` — no new errors (6 pre-existing
  type errors in search/e2e specs exist on `main` independently of this change)

#### Browser Verification

Not applicable to 08-1 (server-side adapter only; no UI surface). Live provider
verification is a credential-dependent follow-up, not an automated check.

#### Known Risks and Follow-Up Work

- `json-schema` structured output remains explicitly unsupported until native
  schema output is verified against a live provider; enabling it later is a
  one-file change in the capability gate.
- Live OpenCode Go request verification (including `Retry-After`/backoff
  behavior) still needs credentials and is tracked as a manual
  `provider:smoke`-style step.
- Retry/backoff decorator, timeout service, token/latency/cost telemetry into
  `SimulationLog`, and safe error mapping into log entries are the scope of
  ticket #46 (08-2), which is blocked by this ticket.

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
