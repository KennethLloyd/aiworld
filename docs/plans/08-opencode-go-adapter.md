# Plan 08: OpenCode Go Adapter

Status: Planned

## Goal

Connect the already-tested simulation port to OpenCode Go without changing
simulation actions, prompts, repositories, or controllers.

## Scope

- Provider configuration loader
- OpenCode Go Adapter implementing `LLMProvider`
- Provider registry selection by configured provider ID
- Timeout and retry decorator/service
- Response normalization
- Structured-output capability handling
- Token, latency, and configurable cost telemetry
- Safe error mapping into SimulationLog
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
  stable domain errors.
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

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
