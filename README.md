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

> **Sibling reference:** [`../cre-chatbot-langgraph`](../cre-chatbot-langgraph) implements the
> same chatbot as a **Python / LangGraph** deterministic state machine. The two toolkits speak
> the same HTTP chat contract and share the same IRR golden values
> ([`irr_reference_values.json`](irr_reference_values.json)), so this UI is **backend-agnostic** —
> set `NEXT_PUBLIC_CHAT_URL` to point it at either backend (default: the Amplify Lambda). One
> shows the *agentic tool-loop* approach, the other the *explicit-graph* approach.

<!-- TODO Phase 2: capture a chat GIF and reference it here -->
<!-- ![Chat demo](docs/demo.gif) -->

<!-- TODO Phase 2: replace with the deployed Amplify Hosting URL -->
**Live demo:** _coming soon_ &nbsp;·&nbsp; [Architecture](ARCHITECTURE.md) &nbsp;·&nbsp; [Backlog](BACKLOG.md)

---

## 🗒️ Personal notes (private — for future-me)

> Everything below this banner down to "What it does" is a private engineering notebook, not
> portfolio copy. The polished public-style sections start at [What it does](#what-it-does).

### If you're reading this cold

This is **one of two peer reference toolkits** for the same CRE chatbot. *This* repo
(`cre-chatbot-amplify`) is the **TypeScript / Strands / AWS Amplify** build — agentic tool-loop,
Bedrock Claude, deployed on Lambda, and it **owns the Next.js UI**. Its twin,
[`../cre-chatbot-langgraph`](../cre-chatbot-langgraph), is the **Python / LangGraph** build — a
deterministic, auditable state machine, headless, runs locally.

Neither is "the product." They exist to demonstrate two different ways to build the same thing.
**The fullest project history + decision log lives in the langgraph repo's README** (`§1` and
`§11` there) — I wrote the canonical saga there to avoid duplicating it. This section covers the
TS side and how the two relate.

### The two-toolkit map

| | This repo (`cre-chatbot-amplify`) | Sibling (`cre-chatbot-langgraph`) |
|---|---|---|
| Stack | Strands Agents **TS**, Amplify, Lambda | **LangGraph 1.x**, Python, FastAPI |
| Control flow | **Agentic** — the model orchestrates via the system prompt + 4 tools | **Explicit state machine** — code orchestrates |
| Model | Bedrock Claude Sonnet 4.6 | Configurable (Bedrock / OpenAI / Anthropic) |
| Persistence | In-memory `Map` per warm Lambda | SQLite checkpointer (audit trail) |
| Hosts the UI | ✅ (Next.js, here) | ❌ (headless) |
| Best for | open-ended / branchy assistants | regulated / deterministic / auditable workflows |

They share exactly two things: **the HTTP chat contract** and **`irr_reference_values.json`** (the
IRR golden fixture). Same numbers, same wire shape, independent code. That's the whole coupling —
deliberately minimal, so they cross-validate without a shared library spanning a Py↔TS boundary.

### The saga, short version (TS side)

A 2025 Flask/Python/**LangGraph.js** attempt (920 lines, 6 files) was the starting point. When the
**Strands Agents TS SDK** dropped (preview, Dec 3 2025), I pivoted hard: the agentic "model is the
orchestrator" approach collapsed that 920 lines into ~220 lines of typed tools and a system prompt.
That pivot is recorded in [`docs/archive/handoff-2026-05-10.md`](docs/archive/handoff-2026-05-10.md).
The Python original then sat dead in `graveyard/` until **2026-06-21**, when I rebuilt it clean on
**LangGraph 1.x** as the sibling reference and deleted the graveyard. So the LangGraph version you
see now is *newer* than this one's pivot, even though it's the "older" lineage — it's a fresh 2026
rebuild, not the 2025 code.

### What changed in THIS repo on 2026-06-21

Only one thing: **the UI was made backend-agnostic.** In `hooks/useChatbot.ts`, `CHAT_URL` now is:

```ts
const CHAT_URL =
  process.env.NEXT_PUBLIC_CHAT_URL ??
  (amplifyOutputs as { custom?: { chatHandlerUrl?: string } }).custom?.chatHandlerUrl;
```

Default behavior is unchanged (falls back to the Amplify Lambda). But now I can point the UI at the
LangGraph backend with one env var — **zero other code changes**, because the LangGraph service
speaks this exact contract:

```
POST /chat  {message, sessionId} → {response, sessionId, propertyType, collectedFields, irrResult}
```

Drive the UI with the Python backend:
```sh
# terminal 1: the LangGraph backend (Bedrock, no API key needed)
cd ../cre-chatbot-langgraph
AWS_REGION=us-west-2 LLM_PROVIDER=bedrock LLM_MODEL=global.anthropic.claude-sonnet-4-6 \
  uv run uvicorn cre_chatbot.api.server:app --port 8000
# terminal 2: this UI, pointed at it
NEXT_PUBLIC_CHAT_URL=http://localhost:8000/chat npm run dev
```
The LangGraph service runs `AUTH_MODE=bypass` in dev, so the Cognito `Authorization: Bearer` header
this UI sends is accepted (ignored). For auth fidelity it can validate the Cognito JWT instead.

### TS-side decision log / gotchas (future-me FAQ)

- **Why agentic here but a state machine next door?** This repo is the "let the model orchestrate"
  reference; the LangGraph one is the "explicit, auditable flow" reference. Having both is the point.
- **The frontend → backend seam is NOT Amplify-coupled.** It's a plain `fetch()` to a URL from
  `amplify_outputs.json` (`custom.chatHandlerUrl`). No GraphQL/Amplify Data client. That's *why* the
  one-line `NEXT_PUBLIC_CHAT_URL` swap works — the UI doesn't care what's behind the URL.
- **The contract is the integration boundary.** If I add a field to `irrResult` or `collectedFields`
  here, the LangGraph `api/contract.py` mapper has to match (and vice-versa). Keep them in lockstep.
- **Auth is the only real friction for swapping backends.** This UI sends a Cognito `idToken`; the
  Lambda validates it via JWKS. Any alternate backend must validate it too, or run in a dev bypass.
- **In-memory session `Map`** dies on Lambda cold start — known demo tradeoff (see Security + Backlog).
  The LangGraph sibling does NOT have this problem (SQLite checkpointer); good contrast to point at.
- **IRR parity is guaranteed by the fixture.** Both repos test against `irr_reference_values.json`;
  the `standard` case is `12.544692996050152`. I verified the LangGraph backend returns that exact
  value through the live HTTP service during its build.

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
| Auth         | Amplify Gen2 `defineAuth` (Cognito User Pool)     | Email/password sign-up; frontend forwards the User Pool `idToken` as `Authorization: Bearer …`; Lambda validates it against the User Pool's JWKS |
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
- Multi-deal comparison (persist completed deals; cross-deal questions)


## Security

This is a demo / portfolio project. The Lambda Function URL is
intentionally `authType: NONE`, CORS is `*`, and sessions live in
process memory. See [SECURITY.md](SECURITY.md) for the full list of
"known demo-mode tradeoffs" and what production shape would look like.

## License

[MIT](LICENSE).
