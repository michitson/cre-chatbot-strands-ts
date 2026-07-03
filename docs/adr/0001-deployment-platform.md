# ADR 0001 — Deployment platform (superseded)

**Status:** Superseded by [ADR 0002](./0002-portfolio-kit-architecture.md) (2026-06-21)
**Date:** 2026-06-09 · **Decider:** Andrew

This ADR compared frontend-hosting platforms (Amplify vs Vercel vs Cloudflare)
and recommended a Vercel-frontend / AWS-agent hybrid. It predates the AgentCore
decisions and is now obsolete:

- **Agent runtime** is decided in [ADR 0002](./0002-portfolio-kit-architecture.md):
  the agent runs on the **AgentCore harness** (managed) — not Lambda, not a
  self-hosted server.
- **Frontend hosting** stays on **AWS for now** (Amplify Hosting or S3 +
  CloudFront); the Vercel hybrid is **deferred, not adopted**.

The original analysis (four platform options, the Bedrock-IAM coupling argument,
per-platform cost shapes, and the Option-B hybrid recommendation) is preserved in
git history.
