# CRE Chatbot — Amplify Gen2 + LangGraph.js

Commercial Real Estate investment-analysis chatbot. TypeScript rebuild of an
earlier Python/Flask + LangChain + LangGraph prototype (2025).

**Status**: Phases 1–3 of the handoff (boot + working chat Lambda, canned IRR).
DynamoDB persistence, real IRR computation, frontend wiring, and AWS deployment
are deferred to subsequent phases.

## Stack

- AWS Amplify Gen2 (Lambda + API Gateway, DynamoDB later)
- LangGraph.js for the conversational state machine
- TypeScript everywhere, Zod for runtime validation
- Vitest for tests

## Layout

```
.
├── HANDOFF.md                   Authoritative spec (extracted from May 2026 Claude.ai chat)
├── irr_reference_values.json    Golden IRR values from the Python reference (parity target)
├── reference-python/            Frozen copy of salvaged 2025 Python source
├── reference-frontend/          Frozen copy of the Next.js 14 frontend export
├── amplify/
│   ├── backend.ts
│   └── functions/chat-handler/
│       ├── handler.ts           Lambda entry
│       ├── langraph/            State machine (state.ts, graph.ts, nodes.ts)
│       ├── tools/               field-parser, field-management
│       └── utils/               field-configs
└── tests/                       Vitest unit + integration
```

## Getting started

```sh
npm install
npx ampx sandbox          # start local Amplify backend
npm test                  # run vitest
```

## Reference material

- `HANDOFF.md` — the architectural plan (read this first).
- `reference-python/` — original Python source. **Do not modify.** Used for behavioral reference and porting decisions.
- `reference-python/handoff-conversation.html` — original Claude.ai conversation that produced HANDOFF.md.
- `reference-frontend/frontend-export-package.md` — Next.js frontend, to be split into real files in Phase 6.
