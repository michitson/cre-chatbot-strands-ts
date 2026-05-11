import { setupTracer, getTracer } from '@strands-agents/sdk/telemetry';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

/**
 * OpenTelemetry tracing for the Strands agent.
 *
 * Strands ships with a built-in OTel tracer that emits spans for each
 * `agent.invoke`, `model.call`, and `tool.call`. To send those spans to
 * AWS X-Ray we run inside Lambda with the AWS Distro for OpenTelemetry
 * (ADOT) Lambda Layer attached. The layer runs an in-process collector
 * that accepts OTLP HTTP on `localhost:4318` (the SDK default) and
 * translates it to X-Ray segments.
 *
 * The full pipeline:
 *
 *   Strands tracer (this file → setupTracer)
 *      │
 *      ▼ OTLP HTTP, localhost:4318
 *   ADOT Lambda Layer collector
 *      │
 *      ▼ X-Ray PutTraceSegments
 *   AWS X-Ray service map
 *
 * IAM permissions for X-Ray are added to the Lambda role in
 * `amplify/backend.ts`.
 */

let configured = false;

export function ensureTelemetryConfigured(): void {
  if (configured) return;
  setupTracer({ exporters: { otlp: true } });
  configured = true;
}

/**
 * Wrap an async operation in a span tagged with `sessionId`. The Strands
 * agent emits its own spans for the invoke/model/tool calls inside; this
 * wrapper just establishes the parent span and the session correlation.
 */
export async function withSessionSpan<T>(
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  ensureTelemetryConfigured();
  const tracer = getTracer();
  const span: Span = tracer.startSpan('cre.chat.turn', {
    attributes: { 'cre.session_id': sessionId },
  });
  try {
    return await context.with(trace.setSpan(context.active(), span), fn);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}
