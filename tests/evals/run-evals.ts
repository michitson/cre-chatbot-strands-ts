#!/usr/bin/env tsx
/**
 * Eval runner.
 *
 * Drives each scenario through the same `Agent` configuration the Lambda
 * uses (same model, same tools, same system prompt) and asserts that the
 * agent called the right tools and produced a response containing the
 * expected substrings.
 *
 * Costs:  a few cents per run (real Bedrock calls). Designed to run on
 *         push to `main` rather than every PR.
 *
 * Usage:  npm run test:evals
 *
 * Exit codes:
 *   0  all scenarios passed
 *   1  one or more scenario failures
 *   2  runtime error
 */

import { Agent, BeforeToolCallEvent } from '@strands-agents/sdk';
import {
  buildTools,
  emptySession,
  SYSTEM_PROMPT,
} from '../../amplify/functions/chat-handler/handler.js';
import { BEDROCK_MODEL_ID } from '../../amplify/functions/chat-handler/config.js';
import {
  SCENARIOS,
  type Scenario,
  type ToolCallAssertion,
} from './scenarios.js';

interface RecordedToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface ScenarioResult {
  id: string;
  passed: boolean;
  failures: string[];
  toolCalls: RecordedToolCall[];
  finalResponse: string;
}

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const state = emptySession();
  const recordedCalls: RecordedToolCall[] = [];

  const agent = new Agent({
    model: BEDROCK_MODEL_ID,
    systemPrompt: SYSTEM_PROMPT,
    tools: buildTools(state),
    printer: false,
  });

  agent.addHook(BeforeToolCallEvent, (event) => {
    recordedCalls.push({
      name: event.toolUse.name,
      input: (event.toolUse.input ?? {}) as Record<string, unknown>,
    });
  });

  let finalResponse = '';
  for (const userMessage of scenario.userMessages) {
    const result = await agent.invoke(userMessage);
    finalResponse = typeof result === 'string' ? result : String(result);
  }

  const failures: string[] = [];

  for (const expected of scenario.expectedToolCalls) {
    if (!recordedCalls.some((call) => matchesAssertion(call, expected))) {
      failures.push(
        `missing tool call: ${expected.name}${
          expected.inputIncludes
            ? ` with input matching ${JSON.stringify(expected.inputIncludes)}`
            : ''
        }`,
      );
    }
  }

  for (const needle of scenario.expectedResponseContains) {
    if (!finalResponse.toLowerCase().includes(needle.toLowerCase())) {
      failures.push(`final response missing substring: "${needle}"`);
    }
  }

  return {
    id: scenario.id,
    passed: failures.length === 0,
    failures,
    toolCalls: recordedCalls,
    finalResponse,
  };
}

function matchesAssertion(
  call: RecordedToolCall,
  expected: ToolCallAssertion,
): boolean {
  if (call.name !== expected.name) return false;
  if (!expected.inputIncludes) return true;
  for (const [key, expectedVal] of Object.entries(expected.inputIncludes)) {
    const actual = call.input[key];
    if (typeof expectedVal === 'string' && typeof actual === 'string') {
      if (!actual.toLowerCase().includes(expectedVal.toLowerCase())) {
        return false;
      }
    } else if (actual !== expectedVal) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  console.log(`Running ${SCENARIOS.length} eval scenario(s)…\n`);

  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    process.stdout.write(`▶ ${scenario.id} … `);
    const t0 = Date.now();
    try {
      const r = await runScenario(scenario);
      results.push(r);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(r.passed ? `✓ (${elapsed}s)` : `✗ (${elapsed}s)`);
      if (!r.passed) {
        for (const f of r.failures) console.log(`    - ${f}`);
        console.log(
          `    captured tools: ${r.toolCalls.map((c) => c.name).join(', ') || '(none)'}`,
        );
      }
    } catch (err) {
      console.log(`✗ (runtime error)`);
      console.log(`    ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        id: scenario.id,
        passed: false,
        failures: [`runtime error: ${err instanceof Error ? err.message : err}`],
        toolCalls: [],
        finalResponse: '',
      });
    }
  }

  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${results.length - failed}/${results.length} scenarios passed.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Eval runner crashed:', err);
  process.exit(2);
});
