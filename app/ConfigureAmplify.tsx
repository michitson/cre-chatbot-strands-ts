'use client';

import { Amplify } from 'aws-amplify';
import amplifyOutputs from '@/amplify_outputs.json';

/**
 * Configures Amplify on the client once, at module load. Mounted in the
 * root layout so every client component (Authenticator, fetchAuthSession,
 * etc.) sees the right User Pool + region.
 */
Amplify.configure(amplifyOutputs, { ssr: true });

export default function ConfigureAmplify() {
  return null;
}
