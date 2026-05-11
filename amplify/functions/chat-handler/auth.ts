import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Cognito JWT verification.
 *
 * The frontend authenticates against the Amplify-managed Cognito User
 * Pool, gets an `idToken` back, and forwards it on every request as
 *   Authorization: Bearer <idToken>
 *
 * This module validates that token: signature, expiry, audience (the
 * User Pool client ID), and issuer (the User Pool itself). The JWKS
 * keys are cached after first fetch, so cold-start cost is one HTTPS
 * round-trip to Cognito and warm calls are CPU-only.
 */

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID;

// Build the verifier lazily — at module load time, if the env vars are
// missing we want to fail at the first request (with a clear 500), not
// at module init (which would kill the Lambda container before it can
// even respond with a status code).
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (verifier) return verifier;
  if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
    throw new Error(
      'Auth misconfigured: COGNITO_USER_POOL_ID and COGNITO_USER_POOL_CLIENT_ID must be set on the Lambda',
    );
  }
  verifier = CognitoJwtVerifier.create({
    userPoolId: USER_POOL_ID,
    tokenUse: 'id',
    clientId: USER_POOL_CLIENT_ID,
  });
  return verifier;
}

export interface AuthSuccess {
  ok: true;
  /** Cognito `sub` claim — stable per user, safe to use as a partition key. */
  userSub: string;
  /** User's email if the User Pool issues it as a claim. */
  email?: string;
}

export interface AuthFailure {
  ok: false;
  status: 401 | 403;
  reason: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

/** Pull the bearer token out of the Authorization header (case-insensitive). */
function extractBearer(headers: Record<string, string | undefined> | undefined): string | null {
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization' && typeof value === 'string') {
      const match = value.match(/^Bearer\s+(.+)$/i);
      return match ? match[1].trim() : null;
    }
  }
  return null;
}

export async function verifyRequest(
  headers: Record<string, string | undefined> | undefined,
): Promise<AuthResult> {
  const token = extractBearer(headers);
  if (!token) {
    return { ok: false, status: 401, reason: 'missing Authorization: Bearer <token>' };
  }
  try {
    const payload = await getVerifier().verify(token);
    return {
      ok: true,
      userSub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      status: 403,
      reason: err instanceof Error ? err.message : 'token verification failed',
    };
  }
}
