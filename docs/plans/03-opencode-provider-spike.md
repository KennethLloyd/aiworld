# Plan 03: OpenCode Go Provider Spike

Status: Complete

## Goal

Verify the external OpenCode Go contract before the simulation depends on it.
The result is a written provider contract and configuration decision, not a
premature vendor-specific implementation.

## Scope

Verify against the current account documentation and available service:

- Base URL and endpoint path
- Authentication mechanism and credential source
- Model names and model selection behavior
- Request and response wire format
- Timeout and rate/concurrency limits
- Token and latency metadata
- Structured-output or JSON response support
- Error and retry semantics

Document the result in a provider configuration contract without storing
credentials in source control.

## Decisions To Produce

- Required environment/configuration keys
- Provider capability flags
- Structured response path or safe text-to-JSON fallback
- Explicit behavior when structured output is unavailable
- Local Mock provider behavior and test fixtures

## Non-Goals

- No credentials committed or embedded in application code. Verified non-secret
  endpoint and model profiles may be documented in configuration examples, while
  runtime selection remains environment-driven.
- No provider SDK import in the simulation domain.
- No production action implementation in this spike.

## Tests and Verification

- Configuration parsing rejects missing required production values.
- A safe provider contract fixture can be parsed without network access.
- Error mapping covers authentication, timeout, rate limit, malformed response,
  and capability errors.
- The mock contract remains deterministic and network-free.

## Browser Verification

This is primarily an integration research task. Do not expose credentials in a
browser or screenshot. Verify the API remains healthy in the OpenAPI browser:

```bash
agent-browser --session aiworld-provider open http://localhost:3000/api/docs
agent-browser --session aiworld-provider wait --load networkidle
agent-browser --session aiworld-provider snapshot -i
agent-browser --session aiworld-provider get title
agent-browser --session aiworld-provider close
```

If a provider status endpoint is added later, add an assertion that it returns
configuration metadata without returning secrets.

## Senior-Level Implementation Standard

Treat the provider as an Adapter behind an internal port and keep capability
differences explicit. The core must not assume every vendor supports the same
structured schema API. Configuration belongs at the infrastructure boundary;
domain actions receive an abstract provider and typed results.

## Implementation Record

Status: Complete

### Senior-Level Summary

The provider spike verified that OpenCode Go exposes an OpenAI-compatible
`/chat/completions` endpoint at the configured base URL and accepts the
`deepseek-v4-flash` model with bearer authentication. A reusable contract parser
now validates requests and responses, preserves provider usage extensions, and
supports safe JSON-object/text-to-JSON parsing without coupling simulation code
to a vendor SDK. Runtime configuration selects the provider, endpoint, model,
credentials, limits, and capability declarations through server-side
environment variables, while the local default remains deterministic and
network-free.

### Files Changed

- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/scripts/provider-contract-smoke.ts`
- `apps/api/src/lib/llm/provider-config.ts`
- `apps/api/src/lib/llm/provider-config.spec.ts`
- `apps/api/src/lib/llm/provider-error.ts`
- `apps/api/src/lib/llm/provider-error.spec.ts`
- `apps/api/src/lib/llm/openai-compatible-contract.ts`
- `apps/api/src/lib/llm/openai-compatible-contract.spec.ts`
- `apps/api/src/lib/llm/fixtures/openai-compatible-fixtures.ts`
- `docs/providers/openai-compatible-contract.md`
- `docs/plans/README.md`
- `docs/plans/03-opencode-provider-spike.md`

### Architecture and SOLID Notes

Configuration and contract parsing live at the infrastructure boundary. The
simulation domain receives no OpenCode Go or OpenAI SDK dependency, and the
future Plan 8 adapter can target OpenCode Go or another OpenAI-compatible
provider through the same runtime-selected base URL/model configuration. Safe
configuration metadata reports only non-secret values and `hasApiKey`; raw keys
and provider response bodies are not placed in classified errors. Error mapping
keeps authentication, timeout, rate-limit, malformed-response, capability, and
network behavior explicit for the later retry/telemetry service.

### Tests Run

- Live OpenCode Go smoke request using the local CLI credential without printing
  or storing the key: `deepseek-v4-flash` returned `chat.completion`, valid
  `json_object` output, and token usage metadata.
- `pnpm --filter @aiworld/api provider:smoke`
- `pnpm --filter @aiworld/api exec jest --runInBand` — 70 tests passed
- `pnpm --filter @aiworld/api exec tsc --noEmit`
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`

### Browser Verification

- `http://localhost:3000/api/docs` loaded successfully in the named
  `aiworld-provider` session.
- Swagger UI title and the existing World operations were present in the
  accessibility snapshot.
- No provider credentials were entered into the browser or included in a
  screenshot.

### Known Risks and Follow-Up Work

- Rate-limit headers, retry-after behavior, and concurrency ceilings were not
  load-tested; Plan 8 must verify provider-specific backoff before production
  traffic.
- JSON-object output is verified, but JSON-schema output is not; Plan 8 must
  verify or explicitly disable that capability.
- The concrete OpenAI-compatible adapter, internal `LLMProvider` port, and
  deterministic simulation mock remain in Plans 8 and 6 respectively.
- Direct DeepSeek API configuration is structurally supported by the generic
  base URL/model settings but was not live-tested in this spike.
