import { randomUUID } from 'crypto';
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { Agent, tool } from '@strands-agents/sdk';
import type { Message } from '@strands-agents/sdk';
import { z } from 'zod';
import { calculateIrr, type IrrResult } from './irr.js';
import { runSensitivity } from './sensitivity.js';
import { BEDROCK_MODEL_ID } from './config.js';
import { registerAuditLog } from './hooks/audit-log.js';
import { withSessionSpan } from './telemetry.js';
import { verifyRequest } from './auth.js';

// ---------------------------------------------------------------------------
// Domain types — same shape the LangGraph version had, minus the channel
// machinery. Kept inline because there are only two of them.
// ---------------------------------------------------------------------------

interface DealData {
  dealName: string;
  purchasePrice: number;
  netOperatingIncome: number;
  noiGrowthRate: number;
  holdPeriod: number;
  exitCapRate: number;
  city?: string;
}

export const DealDataSchema = z.object({
  dealName: z.string().min(1),
  purchasePrice: z.number().int().positive(),
  netOperatingIncome: z.number().int().positive(),
  noiGrowthRate: z.number().min(0).max(100),
  holdPeriod: z.number().int().min(1).max(50),
  exitCapRate: z.number().positive().max(100),
  city: z.string().optional(),
});

export interface SessionState {
  messages: Message[];
  propertyType: 'office' | 'shopping_center' | null;
  collected: Partial<DealData>;
  irrResult: IrrResult | null;
}

// ---------------------------------------------------------------------------
// Per-Lambda-container session store. Cold starts wipe state.
// Phase 4 will swap this for DynamoDB (or Strands' built-in S3 SessionManager).
// ---------------------------------------------------------------------------

const sessions = new Map<string, SessionState>();

export function emptySession(): SessionState {
  return { messages: [], propertyType: null, collected: {}, irrResult: null };
}

const REQUIRED_FIELDS: Array<keyof DealData> = [
  'dealName',
  'purchasePrice',
  'netOperatingIncome',
  'noiGrowthRate',
  'holdPeriod',
  'exitCapRate',
];

// ---------------------------------------------------------------------------
// Tool factory — tools close over the per-session state so different
// invocations share nothing.
// ---------------------------------------------------------------------------

export function buildTools(state: SessionState) {
  const setPropertyType = tool({
    name: 'set_property_type',
    description:
      'Record which type of commercial real estate the user wants to analyze. Call once at the start of the conversation.',
    inputSchema: z.object({
      propertyType: z.enum(['office', 'shopping_center']),
    }),
    callback: ({ propertyType }) => {
      state.propertyType = propertyType;
      return `Property type set to ${propertyType}.`;
    },
  });

  const recordField = tool({
    name: 'record_field',
    description:
      'Record one parsed deal parameter. Parse natural language yourself before calling: "$5M" → 5000000, "3.5%" → 3.5, "10 years" → 10. Field names: dealName (string), purchasePrice (int dollars), netOperatingIncome (int dollars), noiGrowthRate (number 0-100), holdPeriod (int 1-50 years), exitCapRate (number 0-100), city (optional string).',
    inputSchema: z.object({
      fieldName: z.enum([
        'dealName',
        'purchasePrice',
        'netOperatingIncome',
        'noiGrowthRate',
        'holdPeriod',
        'exitCapRate',
        'city',
      ]),
      value: z.union([z.string(), z.number()]),
    }),
    callback: ({ fieldName, value }) => {
      state.collected[fieldName as keyof DealData] = value as never;
      const remaining = REQUIRED_FIELDS.filter((f) => !(f in state.collected));
      const collected = Object.keys(state.collected);
      return `Recorded ${fieldName}=${value}. Collected: ${collected.join(', ')}. Still required: ${remaining.length === 0 ? 'none — ready to calculate' : remaining.join(', ')}.`;
    },
  });

  const calculateIrrTool = tool({
    name: 'calculate_irr',
    description:
      'Calculate IRR for the collected deal. Only call after all 6 required fields have been recorded.',
    inputSchema: z.object({}),
    callback: () => {
      const parsed = DealDataSchema.safeParse(state.collected);
      if (!parsed.success) {
        return `Cannot calculate yet. Validation failed: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`;
      }
      const result = calculateIrr(parsed.data);
      state.irrResult = result;
      // The model presents this to the user; exclude the cash_flows array
      // (it's noisy and only useful for debugging).
      const { cashFlows: _cf, ...summary } = result;
      return JSON.stringify(summary);
    },
  });

  const runSensitivityTool = tool({
    name: 'run_sensitivity',
    description:
      'Run a tornado-style sensitivity analysis on the deal. Mixed-mode sweep: dollar/period variables (purchasePrice, netOperatingIncome, holdPeriod) move ±20% multiplicatively; rate variables (noiGrowthRate, exitCapRate) move ±100bp additively, which is how CRE practitioners actually think about cap-rate compression. Returns variables ranked by IRR spread (largest first). Each point carries a moveLabel like "-100bp" or "+20%" and the resulting IRR. Call after calculate_irr has succeeded and the user wants to know which assumption their return is most sensitive to.',
    inputSchema: z.object({}),
    callback: () => {
      const parsed = DealDataSchema.safeParse(state.collected);
      if (!parsed.success) {
        return `Cannot run sensitivity yet — required deal fields not collected.`;
      }
      const result = runSensitivity(parsed.data);
      return JSON.stringify(result);
    },
  });

  return [setPropertyType, recordField, calculateIrrTool, runSensitivityTool];
}

// ---------------------------------------------------------------------------
// System prompt — the entire workflow lives here. Compare to the 5 graph
// nodes + conditional edges of the LangGraph version.
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are a Commercial Real Estate (CRE) investment analyst. Guide the user through a structured deal analysis using markdown formatting with emojis (✅ 💰 📊 📈 ⏰ 🎯 🏢 🛍️) and progress indicators.

WORKFLOW:
1. If the user hasn't picked a property type yet, ask whether they want to analyze an Office Building or Shopping Center. Once they tell you, call set_property_type.
2. Collect these 6 required fields, in this order, one at a time:
   - dealName — descriptive name (e.g. "Downtown Office Complex")
   - purchasePrice — total acquisition cost in dollars
   - netOperatingIncome — annual NOI in dollars
   - noiGrowthRate — expected annual NOI growth (percentage 0-100)
   - holdPeriod — number of years (1-50)
   - exitCapRate — capitalization rate at sale (percentage 0-100)
3. Parse natural-language values yourself before calling record_field:
   - "$5,000,000" / "5M" / "5.5 million" → integer dollars
   - "3.5%" / "3.5 percent" / "3.5" → number
   - "10 years" / "10y" / "ten" → integer
4. After each record_field call, confirm the value back to the user with the field name in bold and show progress like "**Progress**: 3/6 fields completed".
5. Optionally collect city.
6. When all 6 required fields are recorded, call calculate_irr and present the result with: ## 📊 IRR Analysis Results header, the IRR percentage, total return, annual cash flow, exit value, and a one-line performance verdict (≥15% Excellent 🟢, ≥12% Good 🟡, ≥8% Moderate 🟠, else Below Market 🔴). Then offer next steps including "Run sensitivity analysis" alongside new deal / adjust / exit.
7. If the user asks about sensitivity, "what-if", "what's most sensitive", "tornado", or wants to understand which assumption matters most: call run_sensitivity. Present the result as a compact markdown table with one row per variable sorted by spread (already pre-sorted), showing variable name, base value, mode (multiplicative vs basis-points), and IRR spread (in percentage points). Briefly explain the top 1-2 dominant variables in plain English. Mention that rate variables (noiGrowthRate, exitCapRate) sweep in basis points (±100bp) while dollar/period variables sweep multiplicatively (±20%) — that's the practitioner-standard way to compare them.

Be conversational and concise. Don't dump raw tool results — synthesize them into a friendly response.`;

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Verify the Cognito JWT before doing any work. The Function URL
    // itself is `authType: NONE` (so we can serve CORS preflights and
    // craft proper 401/403 bodies), but every real call has to carry
    // `Authorization: Bearer <idToken>`.
    const auth = await verifyRequest(
      event.headers as Record<string, string | undefined>,
    );
    if (!auth.ok) {
      return {
        statusCode: auth.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ error: 'unauthorized', detail: auth.reason }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { message = '', sessionId: clientSessionId } = body as {
      message?: string;
      sessionId?: string;
    };

    const sessionId = clientSessionId ?? randomUUID();
    let state = sessions.get(sessionId);
    if (!state) {
      state = emptySession();
      sessions.set(sessionId, state);
    }

    const result = await withSessionSpan(sessionId, async () => {
      const agent = new Agent({
        model: BEDROCK_MODEL_ID,
        systemPrompt: SYSTEM_PROMPT,
        tools: buildTools(state),
        messages: state.messages,
        printer: false,
      });

      // Emit one structured JSON line per completed tool call to stdout
      // (Lambda → CloudWatch Logs). See hooks/audit-log.ts for the schema
      // and the matching Logs Insights query.
      registerAuditLog(agent, sessionId);

      const invokeResult = await agent.invoke(message);
      state.messages = agent.messages;
      return invokeResult;
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({
        response: typeof result === 'string' ? result : String(result),
        sessionId,
        propertyType: state.propertyType,
        collectedFields: state.collected,
        irrResult: state.irrResult,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('chat-handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ error: 'An error occurred', detail: message }),
    };
  }
};
