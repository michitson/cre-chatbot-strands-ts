/**
 * Agent behavior eval scenarios.
 *
 * Each scenario drives the agent through a sequence of user turns and
 * asserts (a) which tools the agent invoked and (b) substrings that must
 * appear in the final response. Unlike the unit tests, these run the
 * actual Strands → Bedrock loop — so they cost a few cents per run and
 * catch regressions the model itself could cause (e.g. a system-prompt
 * change that makes the agent stop calling `calculate_irr`).
 */

export interface ToolCallAssertion {
  /** Tool the agent must have invoked at least once. */
  name: string;
  /**
   * Subset of fields that must appear in the recorded tool input.
   * Each key/value is matched as `input[key] === value` (or `includes`
   * for string values when the expected value is a substring marker).
   */
  inputIncludes?: Record<string, string | number | boolean>;
}

export interface Scenario {
  id: string;
  description: string;
  /** User turns, fed one at a time. The agent's response after each is captured. */
  userMessages: string[];
  /** Tool calls the agent must have made, in any order, across all turns. */
  expectedToolCalls: ToolCallAssertion[];
  /** Substrings that must appear in the final assistant response. */
  expectedResponseContains: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'happy-path-office',
    description:
      'Full office deal: property type → 6 fields → IRR. The agent must drive the whole flow and report a verdict band.',
    userMessages: [
      'I want to analyze an office building.',
      'Deal name is Downtown Office Complex.',
      'Purchase price is $5,000,000.',
      'NOI is $400,000 annually.',
      'NOI growth rate is 3%.',
      'Hold period is 10 years.',
      'Exit cap rate is 6.5%.',
    ],
    expectedToolCalls: [
      { name: 'set_property_type', inputIncludes: { propertyType: 'office' } },
      { name: 'record_field', inputIncludes: { fieldName: 'dealName' } },
      {
        name: 'record_field',
        inputIncludes: { fieldName: 'purchasePrice', value: 5_000_000 },
      },
      { name: 'record_field', inputIncludes: { fieldName: 'exitCapRate' } },
      { name: 'calculate_irr' },
    ],
    expectedResponseContains: ['IRR'],
  },
  {
    id: 'sensitivity-after-irr',
    description:
      'After IRR is calculated, the user asks "what is most sensitive" and the agent must call `run_sensitivity` and present a tornado-style result.',
    userMessages: [
      'Office. Deal name Test, purchase price $5M, NOI $400K, growth 3%, hold 10 years, exit cap 6.5%.',
      'What is most sensitive about this deal?',
    ],
    expectedToolCalls: [
      { name: 'calculate_irr' },
      { name: 'run_sensitivity' },
    ],
    expectedResponseContains: ['exitCapRate'],
  },
];
