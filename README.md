# CRE Chatbot — Strands + Next.js + Amplify Gen2

Commercial Real Estate investment-analysis chatbot. Pure-agent loop using
[Strands Agents SDK](https://github.com/strands-agents/sdk-typescript)
on AWS Bedrock, fronted by a Next.js UI, served by a Lambda Function URL
deployed via AWS Amplify Gen2.

**Status:** Working end-to-end. Calculation step still returns canned IRR
(12.5%) — Phase 4 ports the real bisection-method math from
`reference-python/deal_calculator.py` and validates against
`irr_reference_values.json`.

## Architecture

```
 Browser ──HTTP──▶  Next.js (app/, components/, hooks/)
                        │
                        ▼
                   Function URL  (amplify/backend.ts — public, CORS *)
                        │
                        ▼
                   Lambda (amplify/functions/chat-handler/handler.ts)
                        │
                        ▼  Strands Agent
                        │   ├── set_property_type tool
                        │   ├── record_field tool       (model parses NL)
                        │   └── calculate_irr tool      (canned for now)
                        ▼
                   Bedrock (Claude Sonnet 4)
```

The agent is **172 lines in one file**. No state machine, no graph, no
nodes. The system prompt teaches the workflow; the model orchestrates.
For comparison, the LangGraph version this replaced was 920 lines across
6 files (see git history).

## Layout

```
.
├── amplify/
│   ├── backend.ts                            Function URL + Bedrock IAM policy
│   └── functions/chat-handler/
│       ├── handler.ts                        Strands Agent + Lambda entry (172 lines)
│       └── resource.ts                       Lambda config
├── app/                                      Next.js app router
│   ├── page.tsx, layout.tsx, globals.css
├── components/ChatComponent.tsx              Chat UI + Deal Details side panel
├── hooks/{useChatbot,useChatScroll}.ts
├── tests/
│   ├── unit/handler.test.ts                  fast tests on tools (no LLM)
│   └── integration/live-smoke.test.ts        E2E vs deployed Lambda (opt-in)
├── reference-python/                         frozen 2025 Python prototype (read-only)
├── reference-frontend/                       original 2025 Next.js export (read-only)
├── irr_reference_values.json                 golden IRR values for Phase 4 parity
└── HANDOFF.md                                original architectural plan
```

## Getting started

```sh
# 1. Bring up the backend (creates a sandbox stack in AWS, ~1 min)
npx ampx sandbox

# 2. In another terminal, start the frontend
npm run dev
# → http://localhost:3000

# 3. (Optional) verify with curl
URL=$(jq -r .custom.chatHandlerUrl amplify_outputs.json)
curl -sS -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"message":"analyze an office building"}' | jq -r .response
```

The sandbox auto-redeploys on file save under `amplify/`.
`amplify_outputs.json` is regenerated after each deploy and read by both
the curl examples and the frontend.

## Tests

```sh
npm test           # 7 unit tests on tool callbacks (fast, no LLM)
npm run test:live  # 2 E2E smoke tests against deployed Lambda (~40s, ~$0.01 of Bedrock)
npm run typecheck
npm run build
```

## Prerequisites

- Node 20+
- AWS credentials (`aws configure`) with permissions to deploy Amplify stacks
- **Bedrock model access enabled** for Claude Sonnet 4 in `us-west-2` —
  one-time opt-in in the AWS Bedrock Console under "Model access"

## Phase 4 (next)

- Port `calculate_irr_manual` from `reference-python/deal_calculator.py`
  into `calculate_irr`'s callback; verify all 6 cases in
  `irr_reference_values.json` match within 0.01%
- Replace in-memory `Map<sessionId, SessionState>` with DynamoDB or
  Strands's built-in `SessionManager` (S3 backend ships with the SDK)
- Optionally pin a specific Bedrock model ID for cost/latency consistency
