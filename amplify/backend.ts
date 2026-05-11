import { defineBackend } from '@aws-amplify/backend';
import {
  Function as LambdaFunction,
  FunctionUrlAuthType,
  HttpMethod,
  LayerVersion,
} from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { chatHandler } from './functions/chat-handler/resource';
import { BEDROCK_MODEL_ID } from './functions/chat-handler/config';

const backend = defineBackend({
  chatHandler,
});

// Amplify types `resources.lambda` as `IFunction` (interface). The
// underlying construct is the concrete `Function` (with `addLayers`,
// `addEnvironment`, etc.) — cast once and reuse.
const chatLambda = backend.chatHandler.resources.lambda as LambdaFunction;
const chatLambdaCfn = backend.chatHandler.resources.cfnResources.cfnFunction;

// Strands invokes Bedrock at runtime; grant the Lambda permission.
chatLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: ['*'],
  }),
);

// ---------------------------------------------------------------------------
// Observability — OpenTelemetry → AWS X-Ray
//
// The AWS Distro for OpenTelemetry (ADOT) Lambda Layer ships an in-process
// OTLP collector that translates spans to X-Ray segments. Adding the layer
// + the AWS_LAMBDA_EXEC_WRAPPER env var auto-instruments AWS SDK, HTTP,
// and Lambda; the application code (via `setupTracer({otlp: true})` in
// functions/chat-handler/telemetry.ts) sends Strands' own agent/model/tool
// spans into the same pipeline.
//
// Layer ARN reference:
//   https://aws-otel.github.io/docs/getting-started/lambda/lambda-js
// Bump the version suffix when AWS publishes a newer layer.
// ---------------------------------------------------------------------------

const ADOT_LAYER_ARN =
  'arn:aws:lambda:us-west-2:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1';

chatLambda.addLayers(
  LayerVersion.fromLayerVersionArn(chatLambda, 'AdotLayer', ADOT_LAYER_ARN),
);

chatLambda.addEnvironment('AWS_LAMBDA_EXEC_WRAPPER', '/opt/otel-handler');

chatLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
    resources: ['*'],
  }),
);

// `defineFunction` doesn't expose `tracing` directly, so escape-hatch to
// the CloudFormation resource. `Active` enables X-Ray on every invocation.
chatLambdaCfn.tracingConfig = { mode: 'Active' };

// Expose the chat Lambda directly via a Function URL. Switching to API
// Gateway with a custom domain is deferred (see BACKLOG.md).
const chatUrl = chatLambda.addFunctionUrl({
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
