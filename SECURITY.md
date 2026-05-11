# Security

This repo is a demo / portfolio project, not a production deployment.
A handful of things are deliberately left in a "demo mode" state and
called out below so a reviewer can see what was a conscious choice
vs. an oversight.

## Known deferred work

- **Lambda Function URL is `authType: NONE`.** Anyone who knows the URL
  can POST to it. This is intentional for a free side-project demo —
  it keeps `curl`-based examples one-liners and frees the frontend
  from needing IAM signing or Cognito. For a real deployment, switch
  to one of: API key check in the handler, IAM-signed requests via
  AWS SDK from the frontend, Cognito JWT verification, or move
  behind API Gateway with an authorizer. Tracked in
  [`BACKLOG.md`](BACKLOG.md) under Productionization.
- **CORS is `*` on the Function URL.** Same rationale — local dev and
  any future hosted preview both work without origin gymnastics.
- **Session state lives in a per-Lambda-container `Map`.** Cold starts
  drop conversations. Not a security boundary (sessions are scoped by
  client-supplied sessionId; a guessing attacker has random UUIDs to
  brute-force, and there are no secrets in session state). Replacing
  it with DynamoDB and adding per-user scoping is the natural
  follow-on if this ever gets real users.
- **No rate limiting.** A determined caller could rack up Bedrock cost.
  In the production shape, API Gateway throttling + per-token cost
  caps via `AfterModelCallEvent` usage capture would be the answer.

## Bedrock & IAM

- The Lambda's execution role grants `bedrock:InvokeModel` +
  `bedrock:InvokeModelWithResponseStream` on `*` (the model used is
  pinned in code; the wildcard resource just matches AWS's own model
  ARN format). For tighter scoping in a multi-tenant setting, restrict
  to the specific model ARN.
- X-Ray write permissions (`xray:PutTraceSegments`,
  `xray:PutTelemetryRecords`) on `*` are added so the ADOT Lambda
  Layer can ship traces. Again, `*` is the standard resource for
  these actions.
- The Function URL is allowed by IAM (Function URL `authType: NONE`
  controls the URL-level auth, separate from the role policy).

## Secrets & credentials

- The repo contains no secrets. `amplify_outputs.json` (which holds
  the deployed Function URL and the pinned model ID) is `.gitignored`
  and regenerated per developer by `npx ampx sandbox`.
- AWS credentials for local development come from `aws configure` /
  IAM roles — never checked in.

## Reporting

If you find something here that looks like a real vulnerability
rather than a known demo-mode tradeoff, please open an issue on the
GitHub repo.
