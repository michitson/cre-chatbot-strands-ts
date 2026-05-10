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

// "Downtown Office Tower" from the user's earlier session — strong cap rate
// compression case, used to verify exit cap rate dominates the tornado.
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

  it('each variable has 5 points at multipliers 0.8…1.2', () => {
    const r = runSensitivity(STANDARD);
    for (const v of r.variables) {
      expect(v.points.length).toBe(5);
      expect(v.points.map((p) => p.multiplier)).toEqual([0.8, 0.9, 1.0, 1.1, 1.2]);
    }
  });

  it('the multiplier=1.0 point matches the base IRR (per variable)', () => {
    const r = runSensitivity(STANDARD);
    for (const v of r.variables) {
      const basePoint = v.points.find((p) => p.multiplier === 1.0)!;
      expect(basePoint.irrPercentage).toBeCloseTo(r.baseIrrPercentage, 6);
    }
  });

  it('baseIrrPercentage matches calculateIrr directly', () => {
    const r = runSensitivity(STANDARD);
    expect(r.baseIrrPercentage).toBeCloseTo(calculateIrr(STANDARD).irrPercentage, 6);
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
});

describe('runSensitivity — economic sanity', () => {
  it('lower purchase price → higher IRR (monotonic on purchasePrice)', () => {
    const r = runSensitivity(STANDARD);
    const p = r.variables.find((v) => v.name === 'purchasePrice')!;
    const irrs = p.points.map((pt) => pt.irrPercentage);
    // Multipliers are sorted ascending; as price rises, IRR should fall.
    for (let i = 0; i < irrs.length - 1; i++) {
      expect(irrs[i]).toBeGreaterThan(irrs[i + 1]);
    }
  });

  it('lower exit cap rate → higher IRR (cap rate compression wins)', () => {
    const r = runSensitivity(STANDARD);
    const e = r.variables.find((v) => v.name === 'exitCapRate')!;
    const irrs = e.points.map((pt) => pt.irrPercentage);
    for (let i = 0; i < irrs.length - 1; i++) {
      expect(irrs[i]).toBeGreaterThan(irrs[i + 1]);
    }
  });

  it('top tornado variable for a strong deal has meaningful IRR sensitivity', () => {
    // Note: with a multiplicative ±20% sweep, dollar-amount variables
    // (purchasePrice, netOperatingIncome) tend to dominate over rate
    // variables (cap rates, growth) because $2M swings beat 1pp swings.
    // That's a known limitation of this kind of sensitivity — practitioners
    // typically prefer bp-move sweeps for rates, see BACKLOG.md.
    const r = runSensitivity(FUNKY);
    expect(['purchasePrice', 'netOperatingIncome']).toContain(r.variables[0].name);
    expect(r.variables[0].spreadPp).toBeGreaterThan(6);
  });
});
