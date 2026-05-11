/**
 * Tornado-style sensitivity analysis.
 *
 * Mixed-mode sweep, by variable category:
 *
 *   - **Rate variables** (`noiGrowthRate`, `exitCapRate`) move in
 *     **basis points**: ±100bp, ±50bp, base. A 100bp move on a 6.5%
 *     exit cap rate is 5.5%/7.5%, which is how CRE practitioners think
 *     about cap-rate compression / decompression.
 *   - **Dollar / period variables** (`purchasePrice`, `netOperatingIncome`,
 *     `holdPeriod`) move **multiplicatively**: ±20%, ±10%, base. Dollar
 *     amounts don't have a natural "bp" scale and integer hold periods
 *     just round.
 *
 * Variables are ranked by IRR spread (max − min across the sweep). The
 * single-mode ±20% multiplier sweep this replaces systematically over-rated
 * dollar variables vs. rates — a $1M swing on a $5M price is a 20% move,
 * but a 20% swing on a 6.5% cap rate is 5.2% / 7.8%, which is _smaller_
 * than the bp moves practitioners care about.
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

/** Variables that are percentages — move in basis points, not multiplicatively. */
const RATE_VARIABLES: ReadonlySet<SensitivityVariable> = new Set([
  'noiGrowthRate',
  'exitCapRate',
]);

const PERCENT_MULTIPLIERS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;
/** Basis-point moves applied additively to rate variables (percentage points). */
const BP_MOVES = [-100, -50, 0, 50, 100] as const;

export type SweepMode = 'multiplicative' | 'basis-points';

export interface SensitivityPoint {
  /** Short human label for the move, e.g. "-20%" or "+100bp". */
  moveLabel: string;
  value: number;
  irrPercentage: number;
}

export interface VariableSensitivity {
  name: SensitivityVariable;
  baseValue: number;
  mode: SweepMode;
  points: SensitivityPoint[];
  /** max IRR − min IRR across the sweep, in percentage points. Tornado width. */
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

function sweepMultiplicative(
  base: IrrInputs,
  name: SensitivityVariable,
): SensitivityPoint[] {
  const baseValue = base[name];
  return PERCENT_MULTIPLIERS.map((m) => {
    const value = coerce(name, baseValue * m);
    const inputs: IrrInputs = { ...base, [name]: value };
    const r = calculateIrr(inputs);
    const pct = Math.round((m - 1) * 100);
    return {
      moveLabel: pct === 0 ? 'base' : `${pct > 0 ? '+' : ''}${pct}%`,
      value,
      irrPercentage: r.irrPercentage,
    };
  });
}

function sweepBasisPoints(
  base: IrrInputs,
  name: SensitivityVariable,
): SensitivityPoint[] {
  const baseValue = base[name];
  return BP_MOVES.map((bp) => {
    // Inputs use percentages (6.5 means 6.5%), so 1bp = 0.01.
    const value = Math.max(0, baseValue + bp / 100);
    const inputs: IrrInputs = { ...base, [name]: value };
    const r = calculateIrr(inputs);
    return {
      moveLabel: bp === 0 ? 'base' : `${bp > 0 ? '+' : ''}${bp}bp`,
      value,
      irrPercentage: r.irrPercentage,
    };
  });
}

export function runSensitivity(base: IrrInputs): SensitivityResult {
  const baseResult = calculateIrr(base);

  const variables: VariableSensitivity[] = SENSITIVITY_VARIABLES.map((name) => {
    const mode: SweepMode = RATE_VARIABLES.has(name)
      ? 'basis-points'
      : 'multiplicative';
    const points =
      mode === 'basis-points'
        ? sweepBasisPoints(base, name)
        : sweepMultiplicative(base, name);

    const irrs = points.map((p) => p.irrPercentage);
    const spreadPp = Math.max(...irrs) - Math.min(...irrs);
    return { name, baseValue: base[name], mode, points, spreadPp };
  });

  variables.sort((a, b) => b.spreadPp - a.spreadPp);

  return {
    baseIrrPercentage: baseResult.irrPercentage,
    variables,
  };
}
