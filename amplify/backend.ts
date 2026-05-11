import { defineBackend } from '@aws-amplify/backend';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { chatHandler } from './functions/chat-handler/resource';
import { BEDROCK_MODEL_ID } from './functions/chat-handler/config';

const backend = defineBackend({
  chatHandler,
});

// Strands invokes Bedrock at runtime; grant the Lambda permission.
backend.chatHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: ['*'],
  }),
);

// Expose the chat Lambda directly via a Function URL.
// Phase 1–3 keeps things simple; switching to API Gateway with a custom domain
// is a Phase 7 deployment concern.
const chatUrl = backend.chatHandler.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['Content-Type'],
  },
});

backend.addOutput({
  custom: {
    chatHandlerUrl: chatUrl.url,
    bedrockModelId: BEDROCK_MODEL_ID,
  },
});
