/**
 * Parity test: the TypeScript calculateIrr() must match the Python
 * reference implementation across all 6 golden cases.
 *
 * Golden values were extracted on Day 0 by running
 * reference-python/extract_irr_golden.py against the verbatim Python
 * source. See irr_reference_values.json.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { calculateIrr } from '../../amplify/functions/chat-handler/irr.js';

interface GoldenCase {
  name: string;
  inputs: {
    purchase_price: number;
    net_operating_income: number;
    noi_growth_rate: number;
    hold_period: number;
    exit_cap_rate: number;
  };
  irr_pct: number;
  total_return_pct: number;
  annual_cf_y1: number;
  exit_value: number;
  cash_flows: number[];
}

const golden: GoldenCase[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../irr_reference_values.json'), 'utf8'),
);

describe('calculateIrr — parity with Python reference', () => {
  // Floating-point parity tolerance. The Python version uses the same
  // bisection method, so results should agree to many decimals. We assert
  // 4 decimal places (better than the "0.01%" bar from the handoff).
  const IRR_PRECISION = 4;
  const VALUE_PRECISION = 0; // dollars

  for (const c of golden) {
    it(`${c.name}: IRR=${c.irr_pct.toFixed(4)}%, exit=$${Math.round(c.exit_value).toLocaleString()}`, () => {
      const result = calculateIrr({
        purchasePrice: c.inputs.purchase_price,
        netOperatingIncome: c.inputs.net_operating_income,
        noiGrowthRate: c.inputs.noi_growth_rate,
        holdPeriod: c.inputs.hold_period,
        exitCapRate: c.inputs.exit_cap_rate,
      });

      expect(result.irrPercentage).toBeCloseTo(c.irr_pct, IRR_PRECISION);
      expect(result.exitValue).toBeCloseTo(c.exit_value, VALUE_PRECISION);
      expect(result.totalReturnPercentage).toBeCloseTo(
        c.total_return_pct,
        IRR_PRECISION,
      );
      expect(result.annualCashFlowYear1).toBe(c.annual_cf_y1);

      // Cash flow array shape: [-purchase, year1, year2, ..., yearN+exit]
      expect(result.cashFlows.length).toBe(c.cash_flows.length);
      result.cashFlows.forEach((cf, i) => {
        expect(cf).toBeCloseTo(c.cash_flows[i], VALUE_PRECISION);
      });
    });
  }
});

describe('calculateIrr — sanity checks', () => {
  it('a deal with no growth still produces a sensible IRR', () => {
    const r = calculateIrr({
      purchasePrice: 1_000_000,
      netOperatingIncome: 80_000,
      noiGrowthRate: 0,
      holdPeriod: 10,
      exitCapRate: 8,
    });
    // No growth, going-in cap == exit cap → IRR ≈ cap rate = 8%
    expect(r.irrPercentage).toBeCloseTo(8, 1);
  });

  it('cap rate compression boosts IRR significantly', () => {
    // The user's "Downtown Office Tower" inputs from earlier:
    // $10M / $1.2M NOI / 3% / 10y / 5%
    // Going-in 12%, exit 5% — massive compression. IRR should be very high.
    const r = calculateIrr({
      purchasePrice: 10_000_000,
      netOperatingIncome: 1_200_000,
      noiGrowthRate: 3,
      holdPeriod: 10,
      exitCapRate: 5,
    });
    expect(r.irrPercentage).toBeGreaterThan(20);
    // Exit value should be Year-10 forward NOI / 5% = 1.2M * 1.03^10 / 0.05
    // ≈ $32.25M
    expect(r.exitValue).toBeCloseTo(32_253_785, -3);
  });
});
