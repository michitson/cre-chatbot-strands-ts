/**
 * Tornado-style sensitivity analysis. For each numeric input, sweep ±20%
 * in 10% steps and re-run the IRR calc. Returns variables sorted by IRR
 * spread, so the dominant assumption is first.
 *
 * Improves on the Python reference (calculate_sensitivity_analysis) by
 * sweeping all variables at once and ranking by impact.
 */

import { calculateIrr, type IrrInputs } from './irr.js';

export const SENSITIVITY_VARIABLES = [
  'purchasePrice',
  'netOperatingIncome',
  'noiGrowthRate',
  'holdPeriod',
  'exitCapRate',
] as const satisfies ReadonlyArray<keyof IrrInputs>;

export type SensitivityVariable = (typeof SENSITIVITY_VARIABLES)[number];

const MULTIPLIERS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;

export interface SensitivityPoint {
  multiplier: number;
  value: number;
  irrPercentage: number;
}

export interface VariableSensitivity {
  name: SensitivityVariable;
  baseValue: number;
  points: SensitivityPoint[];
  /** max IRR − min IRR across the sweep. Tornado width. */
  spreadPp: number;
}

export interface SensitivityResult {
  baseIrrPercentage: number;
  /** Variables ranked by spreadPp descending. */
  variables: VariableSensitivity[];
}

function coerce(name: SensitivityVariable, value: number): number {
  // holdPeriod must be a positive integer year count; round to keep things
  // physical. Everything else is continuous.
  if (name === 'holdPeriod') return Math.max(1, Math.round(value));
  return value;
}

export function runSensitivity(base: IrrInputs): SensitivityResult {
  const baseResult = calculateIrr(base);

  const variables: VariableSensitivity[] = SENSITIVITY_VARIABLES.map((name) => {
    const baseValue = base[name];
    const points: SensitivityPoint[] = MULTIPLIERS.map((m) => {
      const value = coerce(name, baseValue * m);
      const inputs: IrrInputs = { ...base, [name]: value };
      const r = calculateIrr(inputs);
      return { multiplier: m, value, irrPercentage: r.irrPercentage };
    });

    const irrs = points.map((p) => p.irrPercentage);
    const spreadPp = Math.max(...irrs) - Math.min(...irrs);
    return { name, baseValue, points, spreadPp };
  });

  variables.sort((a, b) => b.spreadPp - a.spreadPp);

  return {
    baseIrrPercentage: baseResult.irrPercentage,
    variables,
  };
}
