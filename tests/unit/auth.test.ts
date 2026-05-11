import { describe, expect, it } from 'vitest';
import { verifyRequest } from '../../amplify/functions/chat-handler/auth.js';

describe('verifyRequest — bearer-token extraction', () => {
  it('rejects when no Authorization header is present', async () => {
    const r = await verifyRequest({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.reason).toMatch(/missing Authorization/);
    }
  });

  it('rejects when headers is undefined', async () => {
    const r = await verifyRequest(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('rejects an Authorization header without the Bearer scheme', async () => {
    const r = await verifyRequest({ Authorization: 'Basic abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.reason).toMatch(/missing Authorization/);
    }
  });

  it('reaches the verifier when a Bearer token is supplied (403 on bad token)', async () => {
    // The env vars are unset in unit tests, so getVerifier() throws
    // a configured error caught by verifyRequest -> 403. We just
    // assert we *passed* extraction and reached the verifier path
    // rather than being rejected at the parse layer.
    const r = await verifyRequest({ Authorization: 'Bearer not-a-real-token' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('accepts case-insensitive header names', async () => {
    const r = await verifyRequest({ authorization: 'Bearer fake' });
    // Same as above: passes extraction, fails verification.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
