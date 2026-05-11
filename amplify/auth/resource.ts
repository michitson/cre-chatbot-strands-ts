import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito-backed auth for the chatbot.
 *
 * Email + password sign-in. Self-service sign-up is on by default in
 * Amplify Gen2 — anyone can register, which is the right default for a
 * demo/portfolio piece (a reviewer can spin up an account in 30s
 * without bothering me for credentials).
 *
 * The User Pool's `idToken` is what the frontend forwards to the chat
 * Lambda as `Authorization: Bearer <id_token>`; the Lambda validates
 * it against the User Pool's JWKS before invoking the agent.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
