import { describe, expect, it } from 'vitest';
import { buildAuditRecord } from '../../amplify/functions/chat-handler/hooks/audit-log.js';

describe('buildAuditRecord', () => {
  it('captures the happy-path tool call shape', () => {
    const r = buildAuditRecord({
      sessionId: 'sess-1',
      toolName: 'record_field',
      toolUseId: 'tu-abc',
      input: { fieldName: 'purchasePrice', value: 5_000_000 },
      status: 'success',
      content: [{ text: 'Recorded purchasePrice=5000000.' }],
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_000_042,
    });

    expect(r.event).toBe('tool_call');
    expect(r.sessionId).toBe('sess-1');
    expect(r.toolName).toBe('record_field');
    expect(r.toolUseId).toBe('tu-abc');
    expect(r.status).toBe('success');
    expect(r.durationMs).toBe(42);
    expect(r.input).toEqual({ fieldName: 'purchasePrice', value: 5_000_000 });
    expect(r.output).toBe('Recorded purchasePrice=5000000.');
    expect(r.ts).toBe('2023-11-14T22:13:20.042Z');
    expect(r.error).toBeUndefined();
  });

  it('flags durationMs = -1 when the Before event was missed', () => {
    const r = buildAuditRecord({
      sessionId: 's',
      toolName: 'calculate_irr',
      toolUseId: 't',
      input: {},
      status: 'success',
      content: [{ text: 'ok' }],
      // no startedAt
      finishedAt: 1_700_000_000_000,
    });

    // -1 is the sentinel: we never saw the Before event, so duration is
    // unknown. Better than silently reporting 0 or NaN.
    expect(r.durationMs).toBe(-1);
  });

  it('serializes JSON content blocks into the output string', () => {
    const r = buildAuditRecord({
      sessionId: 's',
      toolName: 'calculate_irr',
      toolUseId: 't',
      input: {},
      status: 'success',
      content: [{ json: { irrPercentage: 12.5, totalReturnPct: 157 } }],
      startedAt: 0,
      finishedAt: 5,
    });

    expect(r.output).toBe('{"irrPercentage":12.5,"totalReturnPct":157}');
  });

  it('preserves error.message when status is error', () => {
    const r = buildAuditRecord({
      sessionId: 's',
      toolName: 'calculate_irr',
      toolUseId: 't',
      input: {},
      status: 'error',
      content: [{ text: 'Validation failed: purchasePrice required' }],
      startedAt: 0,
      finishedAt: 10,
      error: new Error('purchasePrice required'),
    });

    expect(r.status).toBe('error');
    expect(r.error).toBe('purchasePrice required');
  });

  it('produces a stringify-able single-line JSON record', () => {
    const r = buildAuditRecord({
      sessionId: 's',
      toolName: 'set_property_type',
      toolUseId: 't',
      input: { propertyType: 'office' },
      status: 'success',
      content: [{ text: 'Property type set to office.' }],
      startedAt: 0,
      finishedAt: 1,
    });

    const line = JSON.stringify(r);
    // No accidental newlines or undefined values that would break Logs Insights.
    expect(line).not.toContain('\n');
    expect(line).not.toContain('undefined');
  });
});
