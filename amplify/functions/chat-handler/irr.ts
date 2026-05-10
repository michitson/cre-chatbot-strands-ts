/**
 * IRR calculator — verbatim port of calculate_irr_analysis +
 * calculate_irr_manual from reference-python/deal_calculator.py.
 *
 * Validated against irr_reference_values.json. See tests/unit/irr.test.ts.
 */

export interface IrrInputs {
  purchasePrice: number;
  netOperatingIncome: number;
  /** Percentage, e.g. 3.5 for 3.5% */
  noiGrowthRate: number;
  /** Years */
  holdPeriod: number;
  /** Percentage, e.g. 6.5 for 6.5% */
  exitCapRate: number;
}

export interface IrrResult {
  irrPercentage: number;
  totalReturnPercentage: number;
  annualCashFlowYear1: number;
  exitValue: number;
  /** Year 0 (purchase) plus one entry per held year; final year includes exit value. */
  cashFlows: number[];
}

/**
 * Bisection-method IRR solver. Matches the Python implementation iteration
 * for iteration: 100 iters, search range [-0.99, 10.0], early-out when
 * |NPV| < 1e-6.
 */
function calculateIrrBisection(cashFlows: number[]): number {
  const npv = (rate: number): number =>
    cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i), 0);

  let low = -0.99;
  let high = 10.0;
  let mid = 0;

  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-6) return mid;
    if (v > 0) low = mid;
    else high = mid;
  }
  return mid;
}

export function calculateIrr(inputs: IrrInputs): IrrResult {
  const { purchasePrice, netOperatingIncome: noiY1, holdPeriod } = inputs;
  const growth = inputs.noiGrowthRate / 100;
  const exitCap = inputs.exitCapRate / 100;

  const cashFlows: number[] = [-purchasePrice];
  for (let year = 1; year <= holdPeriod; year++) {
    cashFlows.push(noiY1 * Math.pow(1 + growth, year - 1));
  }

  // Exit value: forward NOI (year holdPeriod+1) capitalized at exit cap rate,
  // added to the final held year's cash flow. Same convention as the Python
  // version — exit cap applied to forward NOI, not last-year NOI.
  const forwardNoi = noiY1 * Math.pow(1 + growth, holdPeriod);
  const exitValue = forwardNoi / exitCap;
  cashFlows[cashFlows.length - 1] += exitValue;

  const irr = calculateIrrBisection(cashFlows);
  const totalInflow = cashFlows.slice(1).reduce((a, b) => a + b, 0);
  const totalReturn = (totalInflow / purchasePrice - 1) * 100;

  return {
    irrPercentage: irr * 100,
    totalReturnPercentage: totalReturn,
    annualCashFlowYear1: noiY1,
    exitValue,
    cashFlows,
  };
}
