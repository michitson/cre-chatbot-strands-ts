import { describe, expect, it } from 'vitest';
import {
  DealDataSchema,
  buildTools,
  type SessionState,
} from '../../amplify/functions/chat-handler/handler.js';

function emptyState(): SessionState {
  return { messages: [], propertyType: null, collected: {}, irrResult: null };
}

describe('DealDataSchema', () => {
  it('accepts a complete valid deal', () => {
    const r = DealDataSchema.safeParse({
      dealName: 'Test Deal',
      purchasePrice: 5_000_000,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3.0,
      holdPeriod: 10,
      exitCapRate: 6.5,
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative purchase price', () => {
    const r = DealDataSchema.safeParse({
      dealName: 'X',
      purchasePrice: -100,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3,
      holdPeriod: 10,
      exitCapRate: 6.5,
    });
    expect(r.success).toBe(false);
  });

  it('rejects out-of-range hold period', () => {
    const r = DealDataSchema.safeParse({
      dealName: 'X',
      purchasePrice: 5_000_000,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3,
      holdPeriod: 100,
      exitCapRate: 6.5,
    });
    expect(r.success).toBe(false);
  });
});

describe('agent tools (callbacks)', () => {
  it('set_property_type updates session state', async () => {
    const state = emptyState();
    const [setPropertyType] = buildTools(state);
    const result = await setPropertyType.invoke({
      propertyType: 'office',
    } as never);
    expect(state.propertyType).toBe('office');
    expect(String(result)).toContain('office');
  });

  it('record_field accumulates values and reports remaining', async () => {
    const state = emptyState();
    const [, recordField] = buildTools(state);

    await recordField.invoke({
      fieldName: 'dealName',
      value: 'Downtown Office',
    } as never);
    expect(state.collected.dealName).toBe('Downtown Office');

    const r2 = await recordField.invoke({
      fieldName: 'purchasePrice',
      value: 5_000_000,
    } as never);
    expect(state.collected.purchasePrice).toBe(5_000_000);
    expect(String(r2)).toContain('purchasePrice');
    // Should still report remaining required fields
    expect(String(r2)).toMatch(/netOperatingIncome|noiGrowthRate|holdPeriod|exitCapRate/);
  });

  it('calculate_irr fails before required fields collected', async () => {
    const state = emptyState();
    const [, , calculateIrr] = buildTools(state);
    const r = await calculateIrr.invoke({} as never);
    expect(String(r)).toMatch(/Cannot calculate|Validation failed/);
    expect(state.irrResult).toBeNull();
  });

  it('calculate_irr returns canned IRR with all required fields', async () => {
    const state: SessionState = {
      messages: [],
      propertyType: 'office',
      collected: {
        dealName: 'Test Deal',
        purchasePrice: 5_000_000,
        netOperatingIncome: 400_000,
        noiGrowthRate: 3.0,
        holdPeriod: 10,
        exitCapRate: 6.5,
      },
      irrResult: null,
    };
    const [, , calculateIrr] = buildTools(state);
    const r = await calculateIrr.invoke({} as never);
    const parsed = JSON.parse(String(r));
    // Standard golden case from irr_reference_values.json.
    expect(parsed.irrPercentage).toBeCloseTo(12.5447, 3);
    expect(state.irrResult?.irrPercentage).toBeCloseTo(12.5447, 3);
    expect(parsed.exitValue).toBeCloseTo(8_270_254, -1);
  });
});
