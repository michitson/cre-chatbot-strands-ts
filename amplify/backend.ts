import { defineBackend } from '@aws-amplify/backend';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { chatHandler } from './functions/chat-handler/resource';

const backend = defineBackend({
  chatHandler,
});

// Expose the chat Lambda directly via a Function URL.
// Phase 1–3 keeps things simple; switching to API Gateway with a custom domain
// is a Phase 7 deployment concern.
const chatUrl = backend.chatHandler.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST, HttpMethod.OPTIONS],
    allowedHeaders: ['Content-Type'],
  },
});

backend.addOutput({
  custom: {
    chatHandlerUrl: chatUrl.url,
  },
});
