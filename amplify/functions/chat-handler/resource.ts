import { defineFunction } from '@aws-amplify/backend';

export const chatHandler = defineFunction({
  name: 'chat-handler',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
});
