# Notes: AgentCore harness + the future `cre-chatbot-agentcore` sibling

> Captured 2026-06-21 from a planning session. **Build is deferred — this is a reference dump for
> future-me.** Lives in `cre-chatbot-amplify` because this repo's Strands agent is what the AgentCore
> harness work would lift from.

## Context

The CRE-chatbot project is becoming a set of **peer reference toolkits**, one per agent stack:

- `cre-chatbot-amplify` — TS / Strands / hand-rolled AWS (Lambda + Amplify + Cognito + ADOT). *Built.*
- `cre-chatbot-langgraph` — Python / LangGraph deterministic state machine. *Built 2026-06-21.*
- `cre-chatbot-agentcore` — **(future, NOT today)** the Strands agent lifted onto the **Amazon Bedrock
  AgentCore managed harness**. A *third* peer; `cre-chatbot-amplify` stays intact.

Two threads from the session:
1. Install the AgentCore documentation MCP server (globally) so the docs are on tap when the third
   sibling gets built. **Not done yet** — to be run by me from this project (where my existing AgentCore
   chat session lives).
2. Capture the design/intent of the third sibling while fresh. Key insight — once you adopt the
   AgentCore **managed harness**, "not much survives but the calculator."

## Part 1 — The AgentCore MCP server

- Server: **`awslabs.amazon-bedrock-agentcore-mcp-server`** (AWS Labs). Runs via `uvx`.
- It is **docs + operational**: 2 doc tools (`search_agentcore_docs`, `fetch_agentcore_doc`) over the
  AgentCore developer guide, **plus 122 operational tools** across the 7 primitives (Runtime, Memory,
  Identity, Gateway, Policy, Browser, Code Interpreter) to transform/deploy/test agents.
- Prereqs satisfied on this machine: `uv` 0.11.3, Python 3.13, AWS creds.
- Install command (user scope, available everywhere):
  ```sh
  claude mcp add agentcore-docs --scope user -- uvx awslabs.amazon-bedrock-agentcore-mcp-server@latest
  ```

### The "managed harness" — corrected definition, and does the MCP cover it? YES.

(I first mis-defined this as the Runtime service contract — wrong. Per `harness.html`:)

The **AgentCore harness** is a *managed, declarative* agent layer: you declare model + tools + skills +
instructions (**config, not code**) and AWS runs the whole orchestration loop + compute (isolated
microVM per session) + memory + identity + networking + observability + evals + versioned endpoints.
**It is powered by Strands underneath — you do NOT choose a framework** (today; "Claude Agent SDK
coming soon"). Export-to-Strands-code is the escape hatch.

Distinct from **AgentCore Runtime** = the lower, *framework-agnostic* "bring your own agent code"
hosting (the service contract: HTTP `:8080`, `/invocations`+`/ping`, `BedrockAgentCoreApp`). Read
**`harness-vs-runtime`** for the boundary.

Docs the MCP surfaces: `harness.html` (+ harness-get-started / models / tools / skills / memory /
operations / versioning / export / security / harness-vs-runtime) and the Runtime contract pages.

## Part 2 — Future design: `cre-chatbot-agentcore` (deferred build)

A separate, third peer toolkit that **embraces the AgentCore managed harness** (the declarative
"declare, don't code" path — NOT the Runtime "bring your Strands code" path). The agent becomes
**configuration**: model + tools + skills + instructions. AgentCore provides the orchestration loop,
microVM-per-session compute, filesystem/shell, short+long-term memory, identity, networking,
observability, evals/optimization, and versioned endpoints. The harness is powered by Strands under
the hood; an **export-to-Strands-code** escape hatch exists for when config isn't enough.

KEY DECISION DOC to read first (via the MCP): **"AgentCore harness vs. Runtime"** (`harness-vs-runtime`).
Direction is **harness**; fall back to Runtime + exported Strands code only if config can't express it.

**Why the Strands sibling is the harness candidate (not the LangGraph one):** the harness is Strands
underneath — no framework choice. So `cre-chatbot-amplify`'s *already-Strands* agent is the natural
input: its tools + prompt become harness config (or stay as Strands code via export). The LangGraph
sibling would instead map to **Runtime** (framework-agnostic), never the harness. Clean per-sibling
cloud mapping: **Strands → harness, LangGraph → Runtime.**

### What survives vs what the harness absorbs (the "not much but the calculator" reality)

| Concern | Survives | Absorbed into the managed harness |
|---|---|---|
| IRR / sensitivity math | ✅ **the one piece of real custom code** — `irr.ts` + `sensitivity.ts`, exposed as a **declared tool** (Gateway target / MCP server) | — |
| Correctness | ✅ `irr_reference_values.json` golden fixture | — |
| Wire contract | ✅ `{message,sessionId} → {...,irrResult}` (via an adapter to the harness invoke API) | — |
| System prompt | ➡️ becomes **instructions config** (not authored code) | declared |
| The 4 tools | ➡️ become **declared tool connections** (set_property_type, record_field, calculate_irr, run_sensitivity) | declared |
| Agent / orchestration loop | ❌ no authored Strands code | harness provides it (Strands under the hood) |
| Compute / deploy | ❌ Lambda Function URL + `backend.ts` CDK | managed runtime / microVM per session |
| Session state | ❌ in-memory `Map` | harness **Memory** (short + long-term, persists across microVM replacement) |
| Auth | ❌ Cognito-in-Lambda JWT + JWKS | harness **Identity** / **Gateway** |
| Observability | ❌ ADOT + X-Ray + audit-log hooks + replay scripts | automatic tracing + **Observability** |
| Evals / versioning | ❌ bespoke eval harness in `tests/evals/` | built-in evals/optimization + immutable versions & named endpoints |

Net: with the harness, even the *agent code* dissolves into config. The **IRR calculator (as a tool)**
is essentially the only custom code that persists.

**Determinism caveat (the regulated angle):** keep IRR as a *real declared tool*, NOT math the LLM
re-derives in the built-in code-interpreter — otherwise the number isn't exact/auditable. The tool +
golden fixture is what guarantees parity with the other two siblings.

### Coupling (same as the other two siblings)

- Speaks the **same HTTP chat contract**; reuses the **same golden fixture**.
- The UI is already backend-agnostic (`NEXT_PUBLIC_CHAT_URL` in `hooks/useChatbot.ts`), so it becomes a
  **3-way switch** — point it at the Lambda, the LangGraph service, or the AgentCore endpoint.

### Open questions to resolve via the AgentCore MCP at build time

1. **harness vs Runtime (read `harness-vs-runtime` first).** Confirm the harness can express this app
   as config; keep export-to-Strands→Runtime as the fallback.
2. **Determinism is NOT this sibling's job** (resolved). The AgentCore sibling is the *managed-Strands
   convenience* path; the guaranteed-sequence / auditability story stays with the LangGraph sibling.
   Open only as nice-to-have: how well instructions + tool-gating hold the guided flow in practice.
3. **Expose IRR as a declared tool.** Gateway target vs a standalone MCP server wrapping
   `irr.ts`/`sensitivity.ts`. Must be a real tool (deterministic), not code-interpreter math.
4. **Invoke adapter + session mapping.** Harness invoke API ↔ the shared `{message,sessionId}→{...}`
   contract; harness Memory session id ↔ our `sessionId`.
5. **Auth.** Harness Identity/Gateway vs keeping Cognito as the IdP the shared UI already uses.
6. **Memory scope.** Short-term per session (parity with today) vs enabling long-term for cross-deal
   recall (ties to this repo's BACKLOG multi-deal item).

### When built, it gets the same treatment as its siblings

- Cross-linked, fat private README (saga + decision log + what-survived table + gotchas), matching the
  notebooks in the other two repos.
- Passes the shared golden-fixture parity (`12.544692996050152` for the `standard` case).

## Sources
- awslabs MCP server: https://awslabs.github.io/mcp/servers/amazon-bedrock-agentcore-mcp-server
- Install guide: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/mcp-install-server.html
- AgentCore overview: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html
- AgentCore harness: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html

---

## Strategic musings (same session, 2026-06-21) — opinion, not fact

Captured because the thinking is worth keeping. This is roadmap tea-leaf reading, not insider info.

### Verdict on the harness

The valuable part isn't "agent as config" — it's that AWS **productized the operational layer**
everyone rebuilds badly: microVM-per-session isolation, memory that survives microVM recycling,
auto-tracing, evals/optimization, immutable versions + instant rollback. The tell: it eats *exactly*
the layer hand-built in `cre-chatbot-amplify` (Lambda wiring, in-memory session Map, ADOT/X-Ray, the
bespoke eval harness). When a cloud vendor ships a managed product shaped like your custom infra, the
custom version was a phase.

Cautions: (1) "config not code" has a ceiling — the **export-to-Strands-code** hatch is the admission
it can't hold real control flow; (2) soft lock-in (Strands-only harness, AWS-only substrate);
(3) consumption pricing across many primitives is easy to under-forecast; (4) it's new — real verdict
needs hands-on (config ceiling, microVM latency, actual cost).

Right tool for: internal/enterprise agents where *operations* (audit, memory, identity, rollback) beat
bespoke control, and prototypes that must graduate to prod without a rewrite. Wrong tool for:
hard-determinism workflows and anyone wanting framework/cloud portability.

### "The return of graph?" — does Strands grow LangGraph-like control flow?

Graph never left; it's becoming an **opt-in layer, not a paradigm**. Strands already has *multi-agent*
graph/swarm/workflow primitives; what it lacks is LangGraph's sweet spot — deterministic *single-agent*
control flow ("do these steps in this order, gate here"). Short hop, not a rebuild.

Both sides are converging on a **hybrid**: LangGraph added agent ergonomics (prebuilt ReAct); Strands
will harden toward structure. Endpoint = *agent by default, graph where it matters*. Not "graph vs
agent" — a dial. Likely Strands adds *lightweight* structure (deterministic tool sequencing,
required-step guardrails), not a full graph DSL, to avoid simply becoming LangGraph and losing its
"model is the orchestrator" identity.

### The sharper thesis (this is the one to remember): AWS is infra-first, framework-neutral

AWS cares more about **infra adoption than Strands adoption** — same way it visibly doesn't care about
Nova adoption (shipped its own models, still serves OpenAI/Anthropic/Gemini; the harness swaps
providers mid-session). **Strands : frameworks :: Nova : models** — house-brand defaults, strategically
de-emphasized in favor of being the neutral substrate everyone runs on. AWS would rather you run
Claude + LangGraph on its microVMs than win you to Nova + Strands. Lost the model war on purpose, won
the infra one.

So the likely future isn't "Strands grows graph" — it's **AWS lets graph frameworks ride the same
rails**:
- LangGraph is *already* invited — to the **Runtime** room (framework-agnostic, bring-your-code +
  managed ops), just not the **harness** room.
- The declarative harness ("declare model+tools+instructions as config") is philosophically at odds
  with LangGraph's "the graph *is* authored code" — you can't flatten a state machine into config
  without becoming a graph DSL (which AWS won't do). So: harness = config-fit frameworks (Strands, the
  teased **"Claude Agent SDK coming soon"**, maybe OpenAI Agents SDK); Runtime = bring-your-graph.

### What this means for the lab (revised "killer artifact")

The most instructive future build is **NOT `cre-chatbot-agentcore` (Strands-on-harness)** — it's
**deploying `cre-chatbot-langgraph` onto AgentCore Runtime**. That proves the real thesis: a *graph*
framework getting AWS's managed ops, no Strands involved — keep deterministic/auditable control flow
*and* shed the hand-rolled infra, without marrying the house-brand framework.

Builds ranked by how much they'd teach:
1. **langgraph-on-Runtime** — proves framework-neutral infra is the actual product.
2. **strands-on-harness** — proves the fully-managed convenience path.
   The contrast between *those two* is sharper than amplify-vs-anything.

**Signal to watch:** the day Strands ships an in-agent "deterministic workflow / required-step"
primitive, the convergence question is answered — and the harness instantly gets more credible for
regulated work.
