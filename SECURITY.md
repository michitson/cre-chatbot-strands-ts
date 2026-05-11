# Security

This repo is a demo / portfolio project, not a production deployment.
A handful of things are deliberately left in a "demo mode" state and
called out below so a reviewer can see what was a conscious choice
vs. an oversight.

## Known deferred work

- **Auth is enforced inside the Lambda, not at the Function URL.** The
  Function URL itself is `authType: NONE` so the handler can return
  proper 401/403 bodies and serve CORS preflights, but every real
  request must carry `Authorization: Bearer <idToken>` — a Cognito
  User Pool id-token. The Lambda validates the JWT against the
  Pool's JWKS on every invocation (see
  [`amplify/functions/chat-handler/auth.ts`](amplify/functions/chat-handler/auth.ts)).
  Self-service sign-up is on (Amplify Gen2 default), so a reviewer
  can create an account from the Authenticator UI without bothering
  anyone for credentials.
- **CORS is `*` on the Function URL.** Even without auth on the URL
  layer, no useful action happens before the JWT check; CORS `*`
  just keeps local dev and hosted previews both working without
  origin gymnastics.
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
