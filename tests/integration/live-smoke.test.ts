/**
 * End-to-end smoke test against the live deployed Lambda.
 *
 * Skipped by default. Run with:
 *   npm run test:live
 *
 * Reads the Function URL from amplify_outputs.json. Hits real Bedrock,
 * costs roughly $0.01 per run.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const RUN_LIVE = process.env.RUN_LIVE === '1';
const ds = RUN_LIVE ? describe : describe.skip;

ds('live smoke (real Bedrock)', () => {
  const outputs = JSON.parse(
    readFileSync(resolve(__dirname, '../../amplify_outputs.json'), 'utf8'),
  );
  const URL: string = outputs.custom?.chatHandlerUrl;
  if (!URL) throw new Error('chatHandlerUrl missing from amplify_outputs.json');

  async function call(message: string, sessionId?: string) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
    });
    expect(res.status).toBe(200);
    return res.json() as Promise<{
      response: string;
      sessionId: string;
      propertyType: string | null;
      collectedFields: Record<string, unknown>;
      irrResult: {
        irrPercentage: number;
        totalReturnPercentage: number;
        annualCashFlowYear1: number;
        exitValue: number;
      } | null;
    }>;
  }

  it(
    'completes a full deal-analysis conversation',
    async () => {
      const r1 = await call('I want to analyze an office building');
      expect(r1.propertyType).toBe('office');
      const sid = r1.sessionId;

      const r2 = await call('Smoketest Tower', sid);
      expect(r2.collectedFields.dealName).toBe('Smoketest Tower');

      // Inputs match the "standard" golden case in irr_reference_values.json
      // so we can assert against the known Python IRR (12.5447%) /
      // exit_value ($8,270,254).
      const r3 = await call('$5,000,000', sid);
      expect(r3.collectedFields.purchasePrice).toBe(5_000_000);

      const r4 = await call('$400,000', sid);
      expect(r4.collectedFields.netOperatingIncome).toBe(400_000);

      const r5 = await call('3%', sid);
      expect(r5.collectedFields.noiGrowthRate).toBeCloseTo(3);

      const r6 = await call('10 years', sid);
      expect(r6.collectedFields.holdPeriod).toBe(10);

      const r7 = await call('6.5%', sid);
      expect(r7.collectedFields.exitCapRate).toBeCloseTo(6.5);
      expect(r7.irrResult).not.toBeNull();
      expect(r7.irrResult?.irrPercentage).toBeCloseTo(12.5447, 2);
      expect(r7.irrResult?.exitValue).toBeCloseTo(8_270_254, -2);
      expect(r7.response.toLowerCase()).toContain('irr');
    },
    90_000,
  );

  it(
    'agent rejects out-of-order field values',
    async () => {
      const r1 = await call('analyze a shopping center');
      const sid = r1.sessionId;
      // Skip dealName + price; jump straight to a percentage. The model
      // should refuse to record this as anything other than dealName, or
      // ask for clarification.
      const r2 = await call('3.5%', sid);
      expect(r2.collectedFields.noiGrowthRate).toBeUndefined();
      expect(r2.collectedFields.dealName).toBeUndefined();
    },
    60_000,
  );
});
