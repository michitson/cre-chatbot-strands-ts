'use client';

import { Amplify } from 'aws-amplify';
import amplifyOutputs from '@/amplify_outputs.json';

/**
 * Configures Amplify on the client once, at module load. Mounted in the
 * root layout so every client component (Authenticator, fetchAuthSession,
 * etc.) sees the right User Pool + region.
 *
 * Note: the `{ ssr: true }` option is intentionally NOT passed. That flag
 * tells Amplify to use cookie-based token storage, which only works when
 * paired with server-side cookie readers (middleware, server actions).
 * We have neither — this app is a static Next.js export hitting a Lambda
 * Function URL — so we want the default localStorage-based token storage.
 * Passing `{ ssr: true }` here caused an "undefined.payload" crash deep
 * inside Amplify's auth core when it tried to read tokens from cookies
 * that nothing was ever writing.
 */
Amplify.configure(amplifyOutputs);

export default function ConfigureAmplify() {
  return null;
}
