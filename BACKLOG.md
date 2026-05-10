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

- **Tool-call audit log.** Subscribe to `AfterToolCallEvent` and write
  `{sessionId, timestamp, toolName, input, output}` to DynamoDB or S3. Becomes
  the replayable trail for compliance/debug.
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

- **AgentCore evaluation.** AWS Bedrock AgentCore (announced 2025) is the
  destination you mentioned. Worth a spike: same Strands agent, deployed to
  AgentCore instead of Lambda. AgentCore likely treats Strands as first-class
  (AWS-on-AWS) and gives you managed memory + observability without rolling
  our own.

## UX polish (your "tweaks" list, when ready)

- Field-name display in the side panel uses verbose labels. Could be tighter.
- No keyboard shortcut for reset (the refresh icon only).
- IRR result panel could include a small horizontal bar showing the verdict
  band (red/orange/yellow/green) rather than just the IRR number.
- Mobile layout: split panel is desktop-only; small screens need a tab toggle.

## Hygiene

- Initial git commit hasn't happened since the Strands pivot. Should commit
  the post-pivot state cleanly (single coherent commit, not 1 per file).
- README mentions Phase 4 IRR is now done; minor wording update.
- `reference-frontend/` could be deleted now that we've folded it in — git
  history preserves it. (Or keep as a "before" snapshot.)
