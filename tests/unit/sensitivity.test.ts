import { describe, expect, it } from 'vitest';
import { calculateIrr } from '../../amplify/functions/chat-handler/irr.js';
import {
  runSensitivity,
  SENSITIVITY_VARIABLES,
} from '../../amplify/functions/chat-handler/sensitivity.js';

const STANDARD = {
  purchasePrice: 5_000_000,
  netOperatingIncome: 400_000,
  noiGrowthRate: 3,
  holdPeriod: 10,
  exitCapRate: 6.5,
};

// "Downtown Office Tower" — strong cap-rate-compression case. Used to verify
// exit cap rate dominates the tornado once we sweep rates in bp (not %).
const FUNKY = {
  purchasePrice: 10_000_000,
  netOperatingIncome: 1_200_000,
  noiGrowthRate: 3,
  holdPeriod: 10,
  exitCapRate: 5,
};

describe('runSensitivity — shape and consistency', () => {
  it('returns one entry per sensitivity variable', () => {
    const r = runSensitivity(STANDARD);
    expect(r.variables.length).toBe(SENSITIVITY_VARIABLES.length);
    const names = r.variables.map((v) => v.name).sort();
    expect(names).toEqual([...SENSITIVITY_VARIABLES].sort());
  });

  it('each variable has 5 sweep points', () => {
    const r = runSensitivity(STANDARD);
    for (const v of r.variables) {
      expect(v.points.length).toBe(5);
    }
  });

  it('rate variables sweep in bp, dollar/period variables sweep multiplicatively', () => {
    const r = runSensitivity(STANDARD);
    for (const v of r.variables) {
      if (v.name === 'noiGrowthRate' || v.name === 'exitCapRate') {
        expect(v.mode).toBe('basis-points');
        expect(v.points.map((p) => p.moveLabel)).toEqual([
          '-100bp',
          '-50bp',
          'base',
          '+50bp',
          '+100bp',
        ]);
      } else {
        expect(v.mode).toBe('multiplicative');
        expect(v.points.map((p) => p.moveLabel)).toEqual([
          '-20%',
          '-10%',
          'base',
          '+10%',
          '+20%',
        ]);
      }
    }
  });

  it('the "base" point matches the base IRR (per variable)', () => {
    const r = runSensitivity(STANDARD);
    for (const v of r.variables) {
      const basePoint = v.points.find((p) => p.moveLabel === 'base')!;
      expect(basePoint).toBeDefined();
      expect(basePoint.irrPercentage).toBeCloseTo(r.baseIrrPercentage, 6);
    }
  });

  it('baseIrrPercentage matches calculateIrr directly', () => {
    const r = runSensitivity(STANDARD);
    expect(r.baseIrrPercentage).toBeCloseTo(
      calculateIrr(STANDARD).irrPercentage,
      6,
    );
  });

  it('variables are sorted by spread descending', () => {
    const r = runSensitivity(STANDARD);
    for (let i = 0; i < r.variables.length - 1; i++) {
      expect(r.variables[i].spreadPp).toBeGreaterThanOrEqual(
        r.variables[i + 1].spreadPp,
      );
    }
  });

  it('holdPeriod is always a positive integer', () => {
    const r = runSensitivity(STANDARD);
    const hp = r.variables.find((v) => v.name === 'holdPeriod')!;
    for (const p of hp.points) {
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThanOrEqual(1);
    }
  });

  it('exitCapRate bp sweep produces 5.5, 6.0, 6.5, 7.0, 7.5', () => {
    const r = runSensitivity(STANDARD);
    const e = r.variables.find((v) => v.name === 'exitCapRate')!;
    expect(e.points.map((p) => p.value)).toEqual([5.5, 6.0, 6.5, 7.0, 7.5]);
  });
});

describe('runSensitivity — economic sanity', () => {
  it('higher purchase price → lower IRR (monotonic)', () => {
    const r = runSensitivity(STANDARD);
    const p = r.variables.find((v) => v.name === 'purchasePrice')!;
    const irrs = p.points.map((pt) => pt.irrPercentage);
    for (let i = 0; i < irrs.length - 1; i++) {
      expect(irrs[i]).toBeGreaterThan(irrs[i + 1]);
    }
  });

  it('higher exit cap rate → lower IRR (cap-rate compression)', () => {
    const r = runSensitivity(STANDARD);
    const e = r.variables.find((v) => v.name === 'exitCapRate')!;
    const irrs = e.points.map((pt) => pt.irrPercentage);
    for (let i = 0; i < irrs.length - 1; i++) {
      expect(irrs[i]).toBeGreaterThan(irrs[i + 1]);
    }
  });

  it('bp sweep gives rate variables a meaningful IRR spread (not vanishing)', () => {
    // With the previous ±20% multiplicative sweep, a 20% move on a 6.5%
    // exit cap was 5.2%↔7.8% — close to a ±100bp move but framed in a
    // way practitioners don't think in. Now we sweep ±100bp directly
    // (5.5%↔7.5% for FUNKY's 5% base → 4%↔6%), giving rates a fair
    // shake on the tornado. Dollar variables can still dominate when
    // their natural ±20% swings are larger; that's a feature, not a bug.
    const r = runSensitivity(FUNKY);
    const exitCap = r.variables.find((v) => v.name === 'exitCapRate')!;
    const growth = r.variables.find((v) => v.name === 'noiGrowthRate')!;
    expect(exitCap.spreadPp).toBeGreaterThan(2);
    expect(growth.spreadPp).toBeGreaterThan(1);
  });
});
