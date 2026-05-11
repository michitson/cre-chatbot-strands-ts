# Backlog

Parking lot for ideas we've discussed but haven't built. Roughly ordered by
"would I miss it if it shipped without this" — not strict priority.

## Productionization

- **DynamoDB session persistence.** Currently `Map<sessionId, SessionState>` in
  Lambda memory; cold starts and container churn drop conversations. Two
  options: build it ourselves on `amplify/data/resource.ts`, or use Strands's
  built-in `SessionManager` (`session/s3-storage.ts` ships out of the box and
  works via the `sessionManager` option on `new Agent({...})`).
- **Pin a specific Bedrock model ID.** Defaults shift over time and cost/quality
  vary. Lock to a known good model in `new Agent({ model: '...' })` and surface
  it in `amplify_outputs.json` so the frontend can show "powered by X."
- **Auth on the Function URL.** Today it's `authType: NONE` and the URL is
  shareable. Options: API key, Cognito JWT, or IAM-signed (requires a tiny
  signing layer in the frontend). For a side project that's fine; for any
  public deploy, not.
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
- **OpenTelemetry export.** `telemetry/tracer.ts` and `telemetry/meter.ts` are
  OTel-compatible. Plug into CloudWatch / Honeycomb / Datadog for spans per
  invoke + per tool call + per model call, with sessionId as trace attribute.
- **Token / cost metrics.** Capture `usage` from `AfterModelCallEvent`, surface
  per-session token counts (input/output/cache) and dollar cost. Useful for
  both observability and a future "cost cap" feature.

## Agent capability

- ~~**Sensitivity analysis tool.**~~ ✅ Shipped — `run_sensitivity` tool with
  tornado-style output (sweeps all 5 numeric inputs ±20%, ranks by IRR spread).
  Improves on the Python reference by doing all variables at once.
  Follow-up: replace ±20% multiplicative sweep with bp-move sweeps for the
  rate variables (`noiGrowthRate`, `exitCapRate`) — practitioners think in
  bp, not in percentages of percentages. Mixed-mode sweep would be more
  honest for cap rate compression analyses.
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
- **Push to public GitHub.** The repo lives locally only today. Target:
  `github.com/michitson/cre-chatbot-strands-ts` (or similar), with topics,
  description, and the social preview image set. Part of the
  portfolio-pivot Phase 2 work.
