# OpenAI-Compatible Provider Contract

Status: Verified against OpenCode Go on 2026-08-06

## Verified Profile

The OpenCode Go endpoint accepts the OpenAI chat-completions wire format:

```text
Base URL: https://opencode.ai/zen/go/v1
Request: POST /chat/completions
Authentication: Authorization: Bearer <server-side key>
Model: deepseek-v4-flash
```

The model is selected at runtime through `LLM_MODEL`; it is not required by the
application code. `deepseek-v4-flash` is the verified low-cost profile for the
current OpenCode Go subscription.

## Request Contract

The verified request uses:

- `model`
- `messages` with OpenAI `system`, `user`, and `assistant` roles
- `temperature`
- `response_format: { "type": "json_object" }`

The live request returned HTTP 200 from:

```text
https://opencode.ai/zen/go/v1/chat/completions
```

## Response Contract

The response matched the standard shape:

- `id`
- `object: "chat.completion"`
- `model`
- `choices[0].index`
- `choices[0].message.role: "assistant"`
- `choices[0].message.content`
- `choices[0].finish_reason`
- `usage.prompt_tokens`, `completion_tokens`, and `total_tokens`

The verified response also included provider-specific usage extensions:

- `prompt_cache_hit_tokens`
- `prompt_cache_miss_tokens`
- `prompt_tokens_details.cached_tokens`
- `completion_tokens_details.reasoning_tokens`

Unknown usage extensions are preserved by the contract parser but are not
required for provider compatibility.

## Structured Output Decision

OpenCode Go accepted `response_format.type = "json_object"` and returned JSON
text in the assistant message. The provider capability is therefore recorded as
`json-object`, not `json-schema`.

`ProviderCapabilityError` is raised when a caller requires native JSON Schema
output from a provider configured only for JSON object output. For example, a
future action that needs a vendor-native schema request must fail explicitly
against the verified OpenCode Go profile rather than silently sending an
unsupported request. Callers that accept text-to-JSON fallback use the safe
fallback parser instead.

The internal boundary must:

1. Prefer native `json_object` output when configured and supported.
2. Parse the assistant content as JSON.
3. Validate the decoded value against the action schema.
4. Map invalid JSON or schema mismatches to `MALFORMED_RESPONSE` without
   retaining raw provider content in the error.
5. Use the same text-to-JSON parser when a future compatible provider lacks a
   native JSON-object mode.

JSON-schema support was not assumed or enabled by this spike. Plan 8 must verify
it separately before advertising `json-schema` capability.

## Runtime Configuration

The API uses these server-side environment variables:

| Variable | Required for non-mock providers | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | Yes | `mock` or `openai-compatible` |
| `LLM_BASE_URL` | Yes | Provider base URL without `/chat/completions` |
| `LLM_API_KEY` | Yes | Server-side bearer credential |
| `LLM_MODEL` | Yes | Runtime model selection |
| `LLM_TIMEOUT_MS` | No | Request timeout, default `30000` |
| `LLM_MAX_RETRIES` | No | Retry budget, default `2` |
| `LLM_MAX_CONCURRENCY` | No | Provider concurrency limit, default `1` |
| `LLM_STRUCTURED_OUTPUT` | No | Capability declaration, default `text-json-fallback` |
| `LLM_USAGE_METADATA` | No | `required`, `optional`, or `unavailable` |

The local default is `mock`, which requires no network or credentials. The same
OpenAI-compatible adapter can later target another compatible provider by
changing `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. Direct DeepSeek API
configuration is reserved for the adapter implementation in Plan 8 and remains
unverified by this spike.

Safe configuration metadata exposes provider, base URL, model, limits, and
capabilities plus a boolean `hasApiKey`; it never exposes the key itself.

## Error and Retry Contract

The generic mapping used by the contract tests is:

| Condition | Code | Retryable |
| --- | --- | --- |
| HTTP 401 or 403 | `AUTHENTICATION` | No |
| HTTP 408, abort, or timeout | `TIMEOUT` | Yes |
| HTTP 429 | `RATE_LIMIT` | Yes |
| HTTP 5xx | `NETWORK` | Yes |
| Connection reset/refused/not found | `NETWORK` | Yes |
| Invalid response or invalid structured content | `MALFORMED_RESPONSE` | No |
| Unsupported configured capability | `CAPABILITY` | No |
| Other errors | `UNKNOWN` | No |

The live smoke request verified successful authentication, model selection,
request mapping, JSON-object output, response parsing, and usage metadata. It did
not intentionally exercise rate limits or failure responses. Plan 8 should verify
provider-specific retry headers and backoff behavior before production traffic.
The planned retry policy is bounded exponential backoff with jitter, honoring a
provider `Retry-After` value when present. Retries are limited by
`LLM_MAX_RETRIES` and the request timeout, and apply only to timeout, network,
408, 429, and 5xx failures. Authentication, malformed-response, capability, and
other client errors fail immediately.

## Local Verification

Use environment variables only; never place a key in source control:

```bash
LLM_PROVIDER="openai-compatible" \
LLM_BASE_URL="https://opencode.ai/zen/go/v1" \
LLM_MODEL="deepseek-v4-flash" \
LLM_API_KEY="$OPENCODE_GO_API_KEY" \
pnpm --filter @aiworld/api provider:smoke
```

The smoke command prints only parsed completion metadata and the minimal
structured result. Offline Jest fixtures cover the same request and response
contract without network access.
