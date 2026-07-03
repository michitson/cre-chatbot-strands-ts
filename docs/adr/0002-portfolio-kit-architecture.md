# ADR 0002 — AgentCore purity: harness + two Gateway-fronted Lambdas

**Status:** Accepted · **Date:** 2026-06-21 · **Decider:** Andrew

> **History:** Rewritten in place on 2026-06-21. The prior version (2026-06-14)
> proposed a reusable TypeScript monorepo "kit" of hand-authored packages,
> deployed **Runtime-only** with the platform's higher services held at arm's
> length, plus three sibling stacks. The **AgentCore harness** went GA mid-June
> 2026 and inverted that design. The old version is preserved in git history;
> the filename is kept for stable cross-references.

## Context

This project is a portfolio piece whose real deliverable is **demonstrated
competence on Amazon Bedrock AgentCore** — AWS's managed platform for running AI
agents. The CRE (commercial real estate) IRR chatbot is a *disposable vehicle*;
the purpose statement is in [ADR 0003](./0003-frontend-agent-invocation-boundary.md)
("career bridge; the seam, not the example, is the asset").

The prior direction — a hand-authored "kit" (your own agent loop, your own MCP
tool servers, your own session/auth/observability wiring), kept deliberately off
the platform's higher services — was overtaken by the **AgentCore harness** (GA
mid-June 2026): a *managed* agent-orchestration layer where you **declare** the
agent (model, instructions, tools) as configuration and AWS runs the loop. Once
the harness exists, hand-building the loop and its surrounding infrastructure
stops demonstrating platform competence and starts *rebuilding what the platform
now provides*. In AgentCore terms, **standalone hand-built artifacts are museum
pieces** — kept only as before/after exhibits, not as live architecture, and we
are choosing not to keep any.

## Decision — AgentCore purity

Author the minimum; hand everything else to the managed platform. Three layers,
only the bottom is code:

1. **Agent reasoning loop** → the **AgentCore harness** (configuration: model +
   instructions + tool declarations). *No agent code.*
2. **Plumbing** — compute, session state, short/long-term memory, inbound auth,
   tracing/observability → **managed by AgentCore**. *Not built.*
3. **Domain logic the platform can't supply** → the only authored code, exposed
   to the agent via **AgentCore Gateway** (the feature that turns a Lambda — a
   small on-demand function — into a callable tool, *generating* the tool
   interface so there is no hand-written tool server).

**The only two pieces of authored code — each a Lambda behind Gateway:**

| Tool | What its Lambda does |
|---|---|
| **Calculator** | IRR (internal rate of return) + sensitivity math |
| **Data** | cap-rate (capitalization-rate) + sales lookups via **Athena** (AWS serverless SQL) over the data lake |

(One Gateway with two targets, or two Gateways — an implementation detail, not a
design decision. Either way: two Lambdas of your code.)

Everything else — model choice, the guided conversation flow, session memory,
auth, observability, versioned endpoints — is harness/Gateway **configuration**.

## What this drops (vs the 2026-06-14 version)

- **The monorepo "kit"** and its hand-authored packages (`agent-kit`,
  `mcp-kit`) — there is no authored agent loop or MCP scaffold left to package.
- **The Runtime-only guardrail** — superseded. The harness *runs on* Runtime,
  and the managed services it uses are now the point, not a risk to hold off.
- **The "no Gateway" guardrail** — reversed. Gateway is the chosen tool seam; it
  is precisely what removes the need to hand-write MCP servers.
- **Hand-authored MCP servers** (`mcp-calc`, `mcp-data`) — replaced by
  Gateway-fronted Lambdas. Pure compute never earned a server, and even the data
  tool needs no authored server when Gateway exposes its Athena Lambda directly.
- **Three sibling stacks** (hand-rolled / Python-LangGraph / AgentCore as
  parallel exhibits) — dropped. One stack.
- **Lambda-as-portability-adapter** — dropped. Purity is a commitment, not a hedge.

## Retained from prior ADRs

- **Invocation boundary** — [ADR 0003](./0003-frontend-agent-invocation-boundary.md)
  stands: the browser reaches the agent through a thin streaming proxy that holds
  the AWS credential and calls `InvokeAgentRuntime`, verifying the Cognito
  (AWS user-login service) JWT in code. The harness is invoked the same way a
  Runtime agent is.
- **Synthetic-data labelling** — cap-rate/sales figures are illustrative and must
  be labelled synthetic at the dataset, the tool response, and the agent-framing
  levels, so nothing fabricated is ever presented as authoritative market data.
- **Consume-only lakehouse** — the data lake is owned by a separate learning
  project; this project only *reads* it via Athena and ships no data deliverables.
- **Cost posture** — no idle baseline; a full conversation is single-digit cents
  (Bedrock-token-dominated); the real risk is endpoint abuse driving Bedrock
  spend, mitigated by inbound auth + a low (~$20) AWS Budgets alarm.

## Open questions

- **Frontend hosting** — the chat web UI still needs a home (the harness hosts
  the *agent*, not the UI). AWS for now (Amplify Hosting or S3 + CloudFront);
  Vercel deferred.
- **Long-term memory** — enable the harness's cross-conversation memory, or keep
  it short-term only for v1?
- **Repo** — strip this repository down to the pure shape, or start fresh.
- **Config ceiling** — confirm the harness can express the guided IRR-gathering
  flow as instructions + tool-gating. If configuration can't hold it, the
  sanctioned fallback is **export-to-Strands-code on Runtime** — the one step
  back toward authored code.

## References

- [ADR 0001](./0001-deployment-platform.md) — superseded frontend-platform
  comparison.
- [ADR 0003](./0003-frontend-agent-invocation-boundary.md) — browser↔agent
  invocation boundary (the thin-proxy "Shape A"), still in force.
- `21-june-2026-notes-about-agentcore-harness.md` — harness definition and the
  "what survives but the calculator" table.
- AgentCore *harness* and *harness vs. Runtime* docs — for the harness, Gateway
  ✅ and remote-MCP ✅ are no-code; framework / graph / hooks ❌.
