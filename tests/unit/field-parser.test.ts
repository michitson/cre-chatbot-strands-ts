import { describe, expect, it } from 'vitest';
import { parseFieldValue } from '../../amplify/functions/chat-handler/tools/field-parser.js';

describe('parseFieldValue — currency', () => {
  it.each([
    ['5500000', 5_500_000],
    ['$5,000,000', 5_000_000],
    ['5M', 5_000_000],
    ['5.5M', 5_500_000],
    ['400K', 400_000],
    ['$400,000', 400_000],
    ['0.4M', 400_000],
  ])('%s → %i', (input, expected) => {
    const r = parseFieldValue('purchasePrice', input);
    expect(r.success).toBe(true);
    if (r.success) expect(r.value).toBe(expected);
  });

  it('rejects garbage', () => {
    const r = parseFieldValue('purchasePrice', 'a lot');
    expect(r.success).toBe(false);
  });

  it('rejects zero', () => {
    const r = parseFieldValue('purchasePrice', '$0');
    expect(r.success).toBe(false);
  });
});

describe('parseFieldValue — percentage', () => {
  it.each([
    ['3.5%', 3.5],
    ['3.5', 3.5],
    ['6.5%', 6.5],
  ])('%s → %f', (input, expected) => {
    const r = parseFieldValue('noiGrowthRate', input);
    expect(r.success).toBe(true);
    if (r.success) expect(r.value).toBeCloseTo(expected as number);
  });

  it('rejects out-of-range', () => {
    const r = parseFieldValue('noiGrowthRate', '150%');
    expect(r.success).toBe(false);
  });
});

describe('parseFieldValue — int (hold period)', () => {
  it.each([
    ['10', 10],
    ['10 years', 10],
    ['10y', 10],
    ['5 year', 5],
  ])('%s → %i', (input, expected) => {
    const r = parseFieldValue('holdPeriod', input);
    expect(r.success).toBe(true);
    if (r.success) expect(r.value).toBe(expected);
  });

  it('hands off written-out forms (Phase 4 LLM scope)', () => {
    const r = parseFieldValue('holdPeriod', 'ten years');
    expect(r.success).toBe(false);
  });
});

describe('parseFieldValue — string', () => {
  it('passes through trimmed text', () => {
    const r = parseFieldValue('dealName', '  Downtown Office Complex  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.value).toBe('Downtown Office Complex');
  });
});
