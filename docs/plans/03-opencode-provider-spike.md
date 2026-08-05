# Plan 03: OpenCode Go Provider Spike

Status: Planned

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

- No hardcoded credentials, endpoints, or model names.
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

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
