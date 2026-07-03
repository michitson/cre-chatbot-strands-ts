# ADR 0003 — Frontend ↔ agent invocation boundary on AgentCore Runtime

**Status:** Accepted
**Date:** 2026-06-20
**Decider:** Andrew

## Context

### What this project is actually for (sharpens [ADR 0002](./0002-portfolio-kit-architecture.md))

ADR 0002 framed the program as "a reusable TS-native kit / portfolio piece."
That is the *artifact*. The *purpose* is sharper and worth stating, because it
decides trade-offs here: this project is a **career bridge** — moving the owner
from a TypeScript web-developer identity into **"big agentic" engineering on
Amazon Bedrock AgentCore**. The CRE calculator chatbot is a **deliberately
disposable vehicle** for that move. **Demonstrated competence in AgentCore
Runtime (and the agentic patterns around it) is the deliverable; hosting calc
chatbots is not.**

Two consequences for the boundary decided below:

1. It must be **faithful** — invoke the agent the way real agentic systems on
   AgentCore are invoked, not via a shortcut that hides the mechanics being
   learned.
2. It must be **cheap to throw away / re-home** — the CRE domain, and even the
   hosting platform, are expected to change. The seam, not the example, is the
   asset.

### The boundary itself

ADR 0002 put the agent on **AgentCore Runtime**. Both prior ADRs left *how the
browser reaches it* as a one-liner ("`InvokeAgentRuntime` or a Lambda
thin-proxy"). This ADR resolves it.

The contract genuinely changes versus today. Today the browser does a vanilla
`fetch()` to a **Lambda Function URL** — a plain public HTTPS POST, CORS open,
Cognito Bearer token verified inside the handler. **AgentCore Runtime has no
public-URL equivalent.** It is reached only through the AWS API operation
`InvokeAgentRuntime`.

**Verified facts (AWS docs, 2026-06-20):**

- `InvokeAgentRuntime` is ARN-addressed, returns a streaming `text/event-stream`
  response, carries session continuity via `runtimeSessionId`, accepts payloads
  up to 100 MB, and requires the `bedrock-agentcore:InvokeAgentRuntime` IAM
  permission.
- **Inbound auth has two modes:** IAM **SigV4** (default — caller must hold AWS
  credentials and sign) or a **JWT bearer** inbound authorizer (any OIDC IdP via
  a discovery URL + allowed audiences/scopes — Amazon Cognito qualifies). With
  the JWT path you **cannot use the AWS SDK**; you make a direct HTTPS request
  with `Authorization: Bearer <jwt>`.
- The **TypeScript + CodeZip** deploy path is real and no-Docker: the
  `@aws/agentcore` CLI scaffolds/deploys a TS Strands agent in ~20 min.

> **Update (2026-06-21):** Under [ADR 0002](./0002-portfolio-kit-architecture.md)'s
> *AgentCore purity* decision, the agent is the **AgentCore harness** — there is
> *no authored server at all* (the loop is configuration; tools are
> Gateway-fronted Lambdas). That retires the "you write a small web server, like
> Flask" framing this ADR originally leaned on (kept below, struck through, for
> the record). It does **not** change the boundary decided here: the harness is
> still reached only through `InvokeAgentRuntime`, so **Shape A stands unchanged**.

A useful framing learned in this round (~~now superseded — see the update
above~~): ~~AgentCore Runtime's contract is "give me a small web server with
`/ping` and `/invocations`" (Express in TS, Starlette in Python). That makes it
closer to a classic Flask app than to Lambda — you write a server again, and
in-process session state becomes legitimate (sticky ≤8 hr microVM), unlike the
Lambda cold-start hack. The single thing AgentCore removes versus Flask is the
public URL you own — hence this ADR.~~

## Options — the invocation shapes

### Shape A — thin backend proxy (BFF)

```
Browser ──fetch + Cognito JWT──▶  Route Handler (BFF)  ──InvokeAgentRuntime (SigV4)──▶  AgentCore Runtime
   ◀──────────── SSE stream ───────────  (verifies JWT in-code, pipes the stream through)
```

- Browser↔backend contract is **unchanged from today**: same `fetch` to *your*
  origin, same Cognito Bearer token, same in-code JWT verification (the
  "portable default" named in ADR 0002 — it moves verbatim into the proxy).
- The proxy holds the IAM permission and makes the signed AWS call; the browser
  never touches AWS credentials or the AgentCore endpoint.
- CORS is controlled on your own origin, as today.
- **Portable adapter seam:** the proxy looks identical whether the agent is on
  Lambda, AgentCore, or elsewhere — it *is* the runtime-adapter boundary the
  prior ADRs gesture at.

### Shape B — browser-direct with a JWT inbound authorizer

The runtime is configured with a Cognito JWT authorizer; the browser already
holds a User Pool JWT (Amplify `<Authenticator>`) and `fetch`es the
`InvokeAgentRuntime` HTTPS endpoint directly with `Authorization: Bearer`.

- **Upside:** no proxy, and AgentCore rejects unauthenticated calls **at the
  boundary before a microVM boots** — a real cost win against the
  endpoint-abuse risk ADR 0002 flags as the true money leak.
- **Blockers/risks:** (1) **CORS** — the AWS data-plane endpoint is not
  documented to return browser CORS headers, and AWS service endpoints generally
  do not; a cross-origin browser `fetch` will likely fail preflight. *This is
  the load-bearing unknown and must be verified before B is viable.* (2) Exposes
  the runtime endpoint/ARN publicly, leaning entirely on the authorizer.
  (3) Removes the natural server-side place for per-user rate limiting, input
  validation, and the audit-log hook.

### The Next.js API route, disambiguated

A Next.js API route can play **two opposite roles**, and conflating them caused
confusion:

- **Hosting the agent** (Strands loop + calc + Bedrock calls inside the route) —
  a *competitor* to AgentCore; a complete alternative home. Clean if you are
  Next-native, but it **teaches zero AgentCore** and re-raises Bedrock IAM auth
  in the web tier. Out of scope while AgentCore is the goal.
- **Proxying to the agent** — Shape A. This is the role assigned here.

## Decision

1. **Adopt Shape A.** Implement the proxy as a **streaming Next.js Route
   Handler** in `apps/web`. In-code Cognito JWT verification stays in the proxy.
2. **Keep the seam runtime-agnostic** so the Lambda adapter and the AgentCore
   adapter both sit behind one proxy contract — preserving the reversibility
   ADR 0002 requires.
3. **JWT inbound authorizer = optional defense-in-depth**, added later for
   pre-microVM rejection. Not required for v1. (Exactly the framing in ADR 0002
   §Resolved-follow-ups.)
4. **Shape B is documented, not chosen** — revisit only if the CORS question
   resolves favourably.

## Vercel permutations (recorded because it keeps coming up)

Core issue: **Vercel has no native AWS IAM identity.** Reaching any AWS API from
Vercel needs **OIDC federation** (Vercel issues an OIDC token → an AWS IAM role
trusts Vercel's OIDC provider → `AssumeRoleWithWebIdentity` → short-lived creds,
cached to the TTL). *Where* that bites depends on the variant:

- **3a — Vercel frontend + agent stays on AgentCore.** Only the Shape A proxy
  (now a Vercel Function) federates, for the `InvokeAgentRuntime` call. One
  cross-cloud seam. The agent still calls Bedrock with its native role.
  This is **ADR 0001's Option B hybrid, updated for AgentCore** — and it is the
  AgentCore-goal-compatible move.
- **3b — agent also on Vercel** (Next route hosts the agent). The Vercel
  function calls **Bedrock** directly → federation on the hot path; **AgentCore
  disappears** (goal abandoned); observability re-wires off X-Ray. Most
  Vercel-native, but a different project than the one being learned from.

Auth shape couples to hosting:

| | Agent on AgentCore | Agent on Vercel |
|---|---|---|
| **Shape A** (proxy) | Vercel proxy federates for `InvokeAgentRuntime` (3a) | Vercel federates for Bedrock (3b) |
| **Shape B** (browser-direct JWT) | **No AWS creds on Vercel at all** (gated on CORS) | n/a |

**Conclusion:** a Vercel move is low-risk **iff the agent stays on AgentCore
(3a)** — only the proxy gains an OIDC step; the agent contract is untouched. The
move that would make it *trivial* (Shape B → zero AWS creds on Vercel) is gated
on the same CORS unknown.

## Consequences

- **New work:** a streaming Route Handler proxy; an execution role carrying
  `bedrock-agentcore:InvokeAgentRuntime`; SSE pass-through shaped for the
  `@michitson/react-chat` adapter (the app owns that adapter); `runtimeSessionId`
  management (UUID per conversation).
- **Retired:** the Lambda Function URL and its CORS config (already flagged
  throwaway in ADR 0002).
- **Deferred (not rejected):** the JWT inbound authorizer; Shape B (pending CORS
  verification); the Vercel move (3a) as a future option.

## Open questions

- **CORS:** does the `InvokeAgentRuntime` endpoint emit browser CORS headers?
  This single fact gates Shape B and the "trivial Vercel" path. Verify before
  ever choosing B.
- **Streaming through Amplify Hosting SSR:** confirm SSE passes cleanly through a
  Next.js Route Handler on Amplify Hosting.
- **Proxy home:** `apps/web` Route Handler (recommended) vs a dedicated tiny
  Lambda Function URL.

## References

- [ADR 0001](./0001-deployment-platform.md) — deployment platform; this ADR
  details its "Future-compatible" `InvokeAgentRuntime`/thin-proxy one-liner.
- [ADR 0002](./0002-portfolio-kit-architecture.md) — program direction; this ADR
  sharpens its purpose statement and resolves the browser↔agent boundary.
- AWS — [Invoke an AgentCore Runtime agent](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html)
  (`InvokeAgentRuntime`, streaming, sessions, OAuth-needs-direct-HTTPS).
- AWS — [Inbound Auth and Outbound Auth](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-oauth.html)
  (SigV4 default vs JWT bearer).
- AWS — [Configure inbound JWT authorizer](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/inbound-jwt-authorizer.html).
- AWS — [Get started with the AgentCore CLI in TypeScript](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli-typescript.html)
  (TS + Strands + CodeZip, no Docker).
