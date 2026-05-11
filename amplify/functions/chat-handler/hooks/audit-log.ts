import type { Agent } from '@strands-agents/sdk';
import {
  BeforeToolCallEvent,
  AfterToolCallEvent,
} from '@strands-agents/sdk';

/**
 * Strands' `ToolResultContent` is a union of class-based blocks (TextBlock,
 * JsonBlock, ImageBlock, ...). Our four tools only ever produce text or
 * JSON blocks, and the audit log only needs to read those two fields, so
 * we accept anything and duck-type at runtime. Keeps tests simple.
 */
type AuditableContent = unknown;

/**
 * Tool-call audit log.
 *
 * Subscribes to Strands' Before/AfterToolCallEvent hooks and emits one
 * structured JSON line per completed tool call to stdout. AWS Lambda
 * ships stdout to CloudWatch Logs unchanged, so each line lands as a
 * single record that CloudWatch Logs Insights can query.
 *
 * Example Logs Insights query:
 *
 *     fields @timestamp, sessionId, toolName, durationMs, status
 *     | filter event = "tool_call"
 *     | sort @timestamp desc
 *     | limit 50
 *
 * The schema is intentionally narrow: just the data needed to
 * (a) replay a session's deterministic tool calls against canonical
 * implementations and (b) spot anomalies at a glance.
 */

export interface ToolCallAuditRecord {
  event: 'tool_call';
  ts: string;
  sessionId: string;
  toolName: string;
  toolUseId: string;
  status: 'success' | 'error';
  durationMs: number;
  input: unknown;
  output: string;
  error?: string;
}

export interface BuildAuditRecordArgs {
  sessionId: string;
  toolName: string;
  toolUseId: string;
  input: unknown;
  status: 'success' | 'error';
  content: AuditableContent[];
  startedAt?: number;
  finishedAt?: number;
  error?: Error;
}

/** Build the structured audit record. Pure — straightforward to unit-test. */
export function buildAuditRecord(args: BuildAuditRecordArgs): ToolCallAuditRecord {
  const finishedAt = args.finishedAt ?? Date.now();
  const durationMs =
    args.startedAt === undefined ? -1 : finishedAt - args.startedAt;

  return {
    event: 'tool_call',
    ts: new Date(finishedAt).toISOString(),
    sessionId: args.sessionId,
    toolName: args.toolName,
    toolUseId: args.toolUseId,
    status: args.status,
    durationMs,
    input: args.input,
    output: extractText(args.content),
    ...(args.error ? { error: args.error.message } : {}),
  };
}

/**
 * Wire `agent` to log every tool invocation under `sessionId`. Returns a
 * cleanup function that removes the hooks, but in Lambda we just discard
 * it — the Agent instance lives for one invocation and is GC'd.
 */
export function registerAuditLog(agent: Agent, sessionId: string): () => void {
  const startTimes = new Map<string, number>();

  const removeBefore = agent.addHook(BeforeToolCallEvent, (event) => {
    startTimes.set(event.toolUse.toolUseId, Date.now());
  });

  const removeAfter = agent.addHook(AfterToolCallEvent, (event) => {
    const startedAt = startTimes.get(event.toolUse.toolUseId);
    startTimes.delete(event.toolUse.toolUseId);

    const record = buildAuditRecord({
      sessionId,
      toolName: event.toolUse.name,
      toolUseId: event.toolUse.toolUseId,
      input: event.toolUse.input,
      status: event.result.status,
      content: event.result.content,
      startedAt,
      error: event.error,
    });

    // One JSON object per stdout line — CloudWatch Logs Insights treats
    // this as a structured record.
    console.log(JSON.stringify(record));
  });

  return () => {
    removeBefore();
    removeAfter();
  };
}

/** Collapse the content array into a single readable string. */
function extractText(content: readonly AuditableContent[]): string {
  return content
    .map((block) => {
      if (block && typeof block === 'object') {
        if ('text' in block && typeof (block as { text: unknown }).text === 'string') {
          return (block as { text: string }).text;
        }
        if ('json' in block) {
          return JSON.stringify((block as { json: unknown }).json);
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}
