/**
 * Pinned configuration shared between the Lambda handler and the Amplify
 * backend (which surfaces these values to the frontend via
 * `amplify_outputs.json`). Bumping the model ID is a deliberate edit here,
 * not an accident from an SDK default drifting.
 */

/**
 * Bedrock model the Strands agent talks to. `global.anthropic.claude-sonnet-4-6`
 * is the global cross-region inference profile for Claude Sonnet 4.6 —
 * resolves from us-west-2 (and every other supported region). 1M context,
 * 64K max output.
 */
export const BEDROCK_MODEL_ID = 'global.anthropic.claude-sonnet-4-6';
