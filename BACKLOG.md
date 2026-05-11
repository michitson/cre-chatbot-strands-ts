# Backlog

Parking lot for ideas we've discussed but haven't built. Roughly ordered by
"would I miss it if it shipped without this" — not strict priority.

## Productionization

- **DynamoDB session persistence.** Currently `Map<sessionId, SessionState>` in
  Lambda memory; cold starts and container churn drop conversations. Two
  options: build it ourselves on `amplify/data/resource.ts`, or use Strands's
  built-in `SessionManager` (`session/s3-storage.ts` ships out of the box and
  works via the `sessionManager` option on `new Agent({...})`).
- ~~**Pin a specific Bedrock model ID.**~~ ✅ Shipped 2026-05-11 — pinned to
  `global.anthropic.claude-sonnet-4-6` (the global cross-region inference
  profile, works from us-west-2) in
  `amplify/functions/chat-handler/config.ts`. Surfaced via
  `amplify_outputs.json.custom.bedrockModelId`.
- ~~**Auth on the Function URL.**~~ ✅ Shipped 2026-05-11 — Amplify
  Gen2 `defineAuth` (Cognito User Pool, email login + self-service
  sign-up). Frontend wraps the app in `<Authenticator>` and forwards
  the User Pool `idToken` as `Authorization: Bearer …`; the Lambda
  validates the JWT against the Pool's JWKS via `aws-jwt-verify`
  before any agent work. Function URL itself stays `authType: NONE`
  so the handler can serve CORS preflights and craft proper 401/403
  bodies.
- **Production frontend deploy.** `next build` works; need to wire Amplify
  Hosting (or Vercel) so the Next.js app is reachable from somewhere other than
  `localhost:3000`. Will also need `NEXT_PUBLIC_CHAT_URL` injection at build
  time per environment.

## Observability / audit (the post-hoc verification thread)

Strands exposes a hook system (`BeforeInvocationEvent`, `MessageAddedEvent`,
`BeforeToolCallEvent`, `AfterToolCallEvent`, `BeforeModelCallEvent`,
`AfterModelCallEvent`, `AgentResultEvent`, …) and OpenTelemetry tracer/meter.
Things to build on top:

- ~~**Tool-call audit log.**~~ ✅ Shipped 2026-05-11 — hooks into
  `BeforeToolCallEvent` + `AfterToolCallEvent` emit a structured JSON
  line per call to stdout (Lambda → CloudWatch Logs). Schema +
  query example in README "Observability". Implementation:
  `amplify/functions/chat-handler/hooks/audit-log.ts`. A replay
  verifier sketch lives at `scripts/replay-tool-calls.ts`.
- **Policy gate on tool calls.** Subscribe to `BeforeToolCallEvent` (it's
  `Interruptible`), check inputs against a rules engine, and `preventDefault`
  if the call violates policy. Pattern: model proposes, rules engine disposes.
- **Replay verifier.** Standalone script: load a session's audit log, re-run
  `calculateIrr` on the captured inputs, assert outputs match what the agent
  reported. Catches arithmetic drift or tool-injection issues.
- ~~**OpenTelemetry export.**~~ ✅ Shipped 2026-05-11 — `setupTracer` in
  `amplify/functions/chat-handler/telemetry.ts` wires Strands' built-in
  OTLP exporter to the AWS Distro for OpenTelemetry (ADOT) Lambda Layer.
  Layer + `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler` + active tracing +
  X-Ray IAM perms are all in `amplify/backend.ts`. Spans land in AWS
  X-Ray with `cre.session_id` as the trace attribute on a `cre.chat.turn`
  root span, with child spans for `agent.invoke`, each `model.call`, and
  each `tool.call`. See README "Distributed traces (X-Ray)" for the
  shape.
- **Token / cost metrics.** Capture `usage` from `AfterModelCallEvent`, surface
  per-session token counts (input/output/cache) and dollar cost. Useful for
  both observability and a future "cost cap" feature.

## Agent capability

- ~~**Sensitivity analysis tool.**~~ ✅ Shipped — `run_sensitivity` tool with
  tornado-style output, ranking variables by IRR spread.
  ~~Follow-up: bp-move sweeps for rate variables.~~ ✅ Shipped
  2026-05-11 — mixed-mode sweep: dollar/period variables move ±20%
  multiplicatively; rate variables (`noiGrowthRate`, `exitCapRate`) move
  ±100bp additively, the way CRE practitioners actually think. Each
  point now carries a `moveLabel` ("-100bp" / "+20%") and a `mode` flag.
  System prompt + tool description updated to match.
- **Multi-deal comparison.** Persist completed deals (the lost
  `CompletedDealDB` from the 2025 prototype) and let the agent answer "how
  does this compare to the deals I've analyzed before?"
- **Adjust assumptions loop.** Today after IRR is calculated, "adjust a
  parameter" prompt is text. Could be a real loop: agent calls
  `record_field` with the new value, then `calculate_irr` again, lets the user
  iterate. Probably already works — try it and see.

## Deployment target

- ~~**AgentCore evaluation.**~~ ❌ Ruled out 2026-05-11. Side research +
  cost-modeling concluded AgentCore is not a fit for a humble side-project
  chatbot: per-session microVM pricing favors high-isolation workloads,
  the managed Memory/Observability/Identity stack is over-spec'd for this
  use case, and the existing Lambda + Function URL is cheap and sufficient.
  Do not propose AgentCore for this project again without a fresh signal
  from the user. Deployment story stays: Lambda + Function URL on
  Amplify Gen2 sandbox today; Amplify Hosting / Vercel for the production
  frontend later.

## UX polish (your "tweaks" list, when ready)

- Field-name display in the side panel uses verbose labels. Could be tighter.
- No keyboard shortcut for reset (the refresh icon only).
- IRR result panel could include a small horizontal bar showing the verdict
  band (red/orange/yellow/green) rather than just the IRR number.
- Mobile layout: split panel is desktop-only; small screens need a tab toggle.

## Hygiene

- ~~Initial git commit hasn't happened since the Strands pivot.~~ ✅ Shipped —
  post-pivot commits exist on `main`.
- ~~README mentions Phase 4 IRR is now done; minor wording update.~~ ✅ Shipped
  2026-05-11 — README rewritten for the portfolio pivot.
- ~~`reference-frontend/` could be deleted now that we've folded it in.~~ ✅ Shipped
  2026-05-11 — both `reference-frontend/` and `reference-python/` removed
  from the repo (a copy of `reference-python/` lives at
  `/Users/andrew/code-post-aws/reference-archive/` for local context; git
  history preserves the originals).
- ~~`HANDOFF.md` is the pre-pivot LangGraph plan and is now misleading.~~ ✅
  Shipped 2026-05-11 — moved to `docs/archive/handoff-2026-05-10.md` with
  a "historical" preamble.
- ~~**Push to public GitHub.**~~ ✅ Shipped 2026-05-11 —
  [github.com/michitson/cre-chatbot-strands-ts](https://github.com/michitson/cre-chatbot-strands-ts),
  public, with description and topics. CI green on `main` via
  `.github/workflows/ci.yml` (typecheck + tests + Next.js build).

## Evals (post-Phase-5)

- ~~**Eval scenarios harness.**~~ ✅ Shipped 2026-05-11 —
  `tests/evals/{scenarios.ts,run-evals.ts}` plus `npm run test:evals`.
  CI workflow at `.github/workflows/evals.yml` gated on a `RUN_EVALS`
  repo variable + an OIDC role (so PRs from forks can't spend
  Bedrock).
- **Grow the scenario set.** Two scenarios today (happy path, sensitivity).
  Add: edge cases (negative IRR, missing field, large numbers), the
  adjust-assumptions loop, the "new deal" branch from the system prompt.
