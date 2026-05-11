# CRE Chatbot — Strands Agents (TypeScript) on AWS Bedrock

> A Commercial Real Estate investment-analysis agent. The user walks
> through a deal in plain English; the agent collects six required
> inputs with typed tools, runs a Newton-Raphson IRR calculation, and
> offers tornado-style sensitivity analysis.

Built on the [**Strands Agents TypeScript SDK**](https://github.com/strands-agents/sdk-typescript) —
AWS [announced TypeScript support](https://aws.amazon.com/about-aws/whats-new/2025/12/typescript-strands-agents-preview/)
as a public preview on December 3, 2025. The Python SDK had been
production since May 2025; the TypeScript port is genuinely new
(`@strands-agents/sdk@1.0.0-rc.x` at time of writing). This repo is
one early end-to-end example of using it on AWS Lambda.

<!-- TODO Phase 2: capture a chat GIF and reference it here -->
<!-- ![Chat demo](docs/demo.gif) -->

<!-- TODO Phase 2: replace with the deployed Amplify Hosting URL -->
**Live demo:** _coming soon_ &nbsp;·&nbsp; [Architecture](ARCHITECTURE.md) &nbsp;·&nbsp; [Backlog](BACKLOG.md)

---

## What it does

A user types something like _"I want to analyze an office building"_
and the agent:

1. Records the property type (`set_property_type` tool).
2. Collects deal name, purchase price, NOI, NOI growth rate, hold
   period, and exit cap rate — one at a time, parsing the user's
   natural-language values into typed numbers (`record_field` tool).
3. Computes IRR + supporting metrics via Newton-Raphson (with bisection
   fallback) once all six inputs are recorded (`calculate_irr` tool).
4. On request, runs a tornado-style sensitivity analysis sweeping each
   of the five numeric inputs by ±20% and ranking by IRR spread
   (`run_sensitivity` tool).

All four tools are typed with [Zod](https://zod.dev) schemas and live
in a single 220-line file. There is no graph, no state machine, no
node orchestration — the system prompt teaches the workflow and the
model orchestrates. For comparison, the earlier LangGraph.js attempt
was 920 lines across six files (the pivot is recorded in
[`docs/archive/handoff-2026-05-10.md`](docs/archive/handoff-2026-05-10.md)
and the git history).

## Why this stack

| Layer        | Choice                                            | Why                                                                                                       |
|--------------|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Agent SDK    | **Strands Agents — TypeScript** (`1.0.0-rc.x`)    | New (preview Dec 2025); model-driven loop with typed tools; clean fit for "model is the orchestrator"     |
| Model        | AWS Bedrock — Claude Sonnet 4.6 (`global.anthropic.claude-sonnet-4-6`) | Strong tool-use behavior, 1M context. Pinned via global cross-region inference profile — no silent drift on SDK upgrades |
| Backend      | AWS Lambda + Function URL                         | Cheap, simple, scales to zero. Agent loop runs entirely inside one Lambda invocation per chat turn        |
| IaC          | AWS Amplify Gen2                                  | TypeScript-native infra (`backend.ts`); sandbox watcher redeploys on save                                 |
| Frontend     | Next.js 16 (app router) + Tailwind v4 + React 19  | Streaming-friendly, modern app router, tight feedback loop                                                |
| Tests        | Vitest                                            | Fast unit tests on the tool callbacks (no LLM); opt-in live smoke tests against the deployed Lambda       |
| Validation   | Zod                                               | Tool input schemas double as runtime validation and TS types                                              |

The deployment target is intentionally minimal: a Lambda Function URL,
not API Gateway. The frontend will deploy to Amplify Hosting. Bedrock
AgentCore was evaluated and ruled out for this workload (per-session
microVM isolation is over-spec'd for a ~7-turn chatbot — see
[`BACKLOG.md`](BACKLOG.md) for the rationale).

## How it works

One chat turn:

```
Browser ──HTTP──▶  Next.js  ──HTTP──▶  Function URL
                                          │
                                          ▼
                                       Lambda  (handler.ts)
                                          │
                                          ▼
                                    Strands Agent
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                      Bedrock         tool calls      session state
                  (Claude Sonnet 4)   (set_property_  (in-memory Map
                                       type, record_   per Lambda
                                       field, ...)     container)
```

The agent loop is entirely inside the Lambda — multiple Bedrock calls
and tool invocations all happen within one `agent.invoke()` call,
returned to the browser as one HTTP response. Full diagrams and a
layer-by-layer mental model are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Run it locally

```sh
# 1. Install
npm install

# 2. Bring up the backend sandbox (creates a CloudFormation stack in AWS, ~1 min)
npx ampx sandbox

# 3. In another terminal, start the Next.js dev server
npm run dev
# → http://localhost:3000

# 4. (Optional) verify the Lambda directly
URL=$(jq -r .custom.chatHandlerUrl amplify_outputs.json)
curl -sS -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"message":"analyze an office building"}' | jq -r .response
```

`amplify_outputs.json` is regenerated by the sandbox after each deploy
and read by both `curl` examples and the frontend.

### Prerequisites

- Node 20+
- AWS credentials (`aws configure`) with permissions to deploy Amplify
  Gen2 stacks
- **Bedrock model access** enabled for Claude Sonnet 4.6 (cross-region
  inference) — one-time opt-in in the AWS Bedrock Console under
  "Model access" → "Cross-region inference" → Claude Sonnet 4.6

## Tests

```sh
npm test           # unit tests on tool callbacks (fast, no LLM)
npm run test:live  # opt-in E2E smoke tests against the deployed Lambda
                   #   (~40s, ~$0.01 of Bedrock per run)
npm run typecheck
npm run build
```

## Observability

Every tool the agent invokes is structured-logged so a non-deterministic
LLM doesn't mean a non-inspectable system. The Lambda subscribes to
Strands' `BeforeToolCallEvent` + `AfterToolCallEvent` hooks (see
[`amplify/functions/chat-handler/hooks/audit-log.ts`](amplify/functions/chat-handler/hooks/audit-log.ts))
and emits one JSON line per completed tool call to stdout, which Lambda
ships to CloudWatch Logs as a single structured record:

```json
{
  "event": "tool_call",
  "ts": "2026-05-11T17:42:08.123Z",
  "sessionId": "f3a1-…",
  "toolName": "calculate_irr",
  "toolUseId": "tooluse_abc…",
  "status": "success",
  "durationMs": 4,
  "input": {},
  "output": "{\"irrPercentage\":12.34,…}"
}
```

CloudWatch Logs Insights query:

```
fields @timestamp, sessionId, toolName, durationMs, status
| filter event = "tool_call"
| sort @timestamp desc
| limit 50
```

A replay verifier at [`scripts/replay-tool-calls.ts`](scripts/replay-tool-calls.ts)
pulls a session's `calculate_irr` records out of CloudWatch and
sanity-checks them; the full reconstruction-and-rerun pattern (combine
upstream `record_field` records into a deal, re-run `calculateIrr`
locally, assert outputs match) is the next iteration.

### Distributed traces (X-Ray)

Strands ships an OpenTelemetry tracer that emits spans for `agent.invoke`,
each model call, and each tool call. The Lambda runs with the **AWS Distro
for OpenTelemetry (ADOT) Lambda Layer** attached
([`amplify/backend.ts`](amplify/backend.ts)), which runs an in-process
OTLP collector that translates spans to **AWS X-Ray** segments. The
result is a real waterfall in the X-Ray service map: one root
`cre.chat.turn` span (tagged with `cre.session_id`) and child spans for
every Bedrock invocation + every tool call in that turn.

```
cre.chat.turn (sessionId=f3a1-…)
├── agent.invoke
│   ├── model.call (Bedrock — Claude Sonnet 4.6)
│   ├── tool.call (record_field)
│   ├── tool.call (record_field)
│   ├── model.call
│   ├── tool.call (calculate_irr)
│   └── model.call
```

Setup:
- ADOT layer ARN + `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler` env var
  attached to the Lambda
- Active X-Ray tracing on the Lambda (`tracingConfig.mode = Active`)
- `xray:PutTraceSegments` + `xray:PutTelemetryRecords` IAM permissions
  on the Lambda role
- `setupTracer({ exporters: { otlp: true } })` called once at module
  init in
  [`amplify/functions/chat-handler/telemetry.ts`](amplify/functions/chat-handler/telemetry.ts)
- Each chat turn is wrapped in a `cre.chat.turn` span via `withSessionSpan`

### Evals — agent behavior, not just code

Unit tests cover the tool callbacks and IRR math. Those won't catch a
prompt change that makes the agent stop calling `calculate_irr`, or a
model bump that breaks tool-use behavior. An eval harness in
[`tests/evals/`](tests/evals/) runs canned scenarios against the real
Strands → Bedrock loop and asserts the agent invoked the right tools
and emitted the expected substrings in its final response:

```sh
npm run test:evals
```

Each scenario in `tests/evals/scenarios.ts` declares its user turns and
the tool/response assertions; the runner ([`run-evals.ts`](tests/evals/run-evals.ts))
captures every tool call via the same `BeforeToolCallEvent` hook the
audit log uses. Costs a few cents per run; CI workflow at
`.github/workflows/evals.yml` is gated on a `RUN_EVALS` GitHub variable
and an OIDC role so it doesn't fire on every PR.

## Status

Working end-to-end. The IRR math is verified against a golden values
file (`irr_reference_values.json`); the sensitivity tool sweeps all
five numeric inputs at once and reports a tornado-ranked spread.

Active follow-ups (see [`BACKLOG.md`](BACKLOG.md) for the full list):

- DynamoDB-backed session persistence (currently in-Lambda `Map`)
- Auth on the Function URL (today `authType: NONE` for the demo)
- Multi-deal comparison (persist completed deals; cross-deal questions)


## License

[MIT](LICENSE).
