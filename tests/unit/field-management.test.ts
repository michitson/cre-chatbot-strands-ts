import { describe, expect, it } from 'vitest';
import {
  getMissingRequiredFields,
  getNextFieldToCollect,
  validateAllCollectedFields,
} from '../../amplify/functions/chat-handler/tools/field-management.js';

describe('field-management', () => {
  it('reports all required fields missing on empty input', () => {
    const missing = getMissingRequiredFields({});
    expect(missing).toEqual([
      'dealName',
      'purchasePrice',
      'netOperatingIncome',
      'noiGrowthRate',
      'holdPeriod',
      'exitCapRate',
    ]);
  });

  it('next field is dealName on empty', () => {
    expect(getNextFieldToCollect({})).toBe('dealName');
  });

  it('falls through to optional city after all required collected', () => {
    const next = getNextFieldToCollect({
      dealName: 'X',
      purchasePrice: 5_000_000,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3.0,
      holdPeriod: 10,
      exitCapRate: 6.5,
    });
    expect(next).toBe('city');
  });

  it('validation rejects negative purchase price', () => {
    const r = validateAllCollectedFields({
      dealName: 'X',
      purchasePrice: -100,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3.0,
      holdPeriod: 10,
      exitCapRate: 6.5,
    });
    expect(r.valid).toBe(false);
  });

  it('validation accepts a complete deal', () => {
    const r = validateAllCollectedFields({
      dealName: 'Test Deal',
      purchasePrice: 5_000_000,
      netOperatingIncome: 400_000,
      noiGrowthRate: 3.0,
      holdPeriod: 10,
      exitCapRate: 6.5,
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.dealData.dealName).toBe('Test Deal');
  });
});
