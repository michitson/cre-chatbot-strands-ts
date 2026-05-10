import { randomUUID } from 'crypto';
import type {
  ChatState,
  ChatStateUpdate,
  DealData,
  IrrResult,
  Message,
} from './state.js';
import {
  FIELD_CONFIGS,
  FIELD_ORDER,
  getFieldDisplayName,
} from '../utils/field-configs.js';
import {
  getFieldPrompt,
  getMissingRequiredFields,
  getNextFieldToCollect,
  validateAllCollectedFields,
} from '../tools/field-management.js';
import { parseFieldValue } from '../tools/field-parser.js';

// --- helpers ---------------------------------------------------------------

function lastMessage(state: ChatState): Message | undefined {
  return state.messages[state.messages.length - 1];
}

function isExit(input: string): boolean {
  const lower = input.toLowerCase();
  return ['exit', 'exit deal mode', 'quit', 'cancel'].some((p) =>
    lower.includes(p),
  );
}

function exitMessage(): Message {
  return {
    role: 'assistant',
    content: `👋 **Exited Deal Mode**

You're now back to regular chat mode. I can help you with:

💬 General questions and conversations
🏢 Real estate analysis (just say "I want to analyze a deal")
📊 Financial calculations and advice

How can I assist you today?`,
  };
}

function formatFieldValue(fieldName: string, value: unknown): string {
  if (fieldName === 'purchasePrice' || fieldName === 'netOperatingIncome') {
    if (typeof value === 'number') {
      return `$${value.toLocaleString('en-US')}`;
    }
  }
  if (fieldName === 'noiGrowthRate' || fieldName === 'exitCapRate') {
    if (typeof value === 'number') return `${value}%`;
  }
  if (fieldName === 'holdPeriod' && typeof value === 'number') {
    return `${value} years`;
  }
  if (fieldName === 'dealName') return `"${String(value)}"`;
  return String(value);
}

function countRequiredCollected(collected: Record<string, unknown>): number {
  let n = 0;
  for (const k of Object.keys(collected)) {
    if (FIELD_CONFIGS[k]?.required) n++;
  }
  return n;
}

function totalRequiredFields(): number {
  return FIELD_ORDER.filter((f) => FIELD_CONFIGS[f].required).length;
}

// --- nodes -----------------------------------------------------------------

export async function propertySelectionNode(
  state: ChatState,
): Promise<ChatStateUpdate> {
  // If property type is already chosen, the graph re-enters here at the start
  // of every turn — fall through to data_collection without re-prompting.
  if (state.propertyType && state.step === 'data_collection') {
    return {};
  }

  const last = lastMessage(state);
  const userInput = (last?.content ?? '').toLowerCase();

  if (isExit(userInput)) {
    return { messages: [exitMessage()], step: 'property_selection' };
  }

  if (userInput.includes('office')) {
    let response = `✅ **Office Building Analysis Selected**

Perfect! I'll guide you through a structured analysis of this commercial office property. I'll need some key information to calculate the IRR and provide investment recommendations.

**Analysis Beginning** 📊

`;
    const next = getNextFieldToCollect({});
    if (next) response += getFieldPrompt(next);
    return {
      propertyType: 'office',
      step: 'data_collection',
      dealId: randomUUID(),
      messages: [{ role: 'assistant', content: response }],
    };
  }

  if (userInput.includes('shopping') || userInput.includes('retail')) {
    let response = `✅ **Shopping Center Analysis Selected**

Excellent! I'll guide you through a structured analysis of this retail property. I'll need some key information to calculate the IRR and provide investment recommendations.

**Analysis Beginning** 🛍️

`;
    const next = getNextFieldToCollect({});
    if (next) response += getFieldPrompt(next);
    return {
      propertyType: 'shopping_center',
      step: 'data_collection',
      dealId: randomUUID(),
      messages: [{ role: 'assistant', content: response }],
    };
  }

  return {
    messages: [
      {
        role: 'assistant',
        content: `🏢 **Commercial Real Estate Analysis**

I can help you analyze commercial real estate deals with professional IRR calculations and investment recommendations.

**What type of property would you like to analyze?**

1️⃣ **Office Building** - Multi-tenant office properties
2️⃣ **Shopping Center** - Retail and mixed-use properties

Type **"office"** or **"shopping center"** to begin your analysis.`,
      },
    ],
  };
}

export async function dataCollectionNode(
  state: ChatState,
): Promise<ChatStateUpdate> {
  const last = lastMessage(state);
  // Don't re-process when we just emitted an assistant message in the same turn.
  if (!last || last.role === 'assistant') return {};
  const userInput = last.content;

  // The user typed "office" / "shopping center" — that was for the previous
  // node, not a field value.
  const lower = userInput.toLowerCase().trim();
  if (lower === 'office' || lower === 'shopping center' || lower === 'retail') {
    return {};
  }

  if (isExit(userInput)) {
    return { messages: [exitMessage()], step: 'property_selection' };
  }

  if (userInput.trim() === '') return {};

  const nextField = getNextFieldToCollect(state.collectedFields);
  if (!nextField) {
    return {
      step: 'validation',
      messages: [
        {
          role: 'assistant',
          content: "Great! Let me validate all the information you've provided...",
        },
      ],
    };
  }

  const result = parseFieldValue(nextField, userInput);
  if (!result.success) {
    const display = getFieldDisplayName(nextField);
    return {
      messages: [
        {
          role: 'assistant',
          content: `❓ **I need clarification on ${display}**\n\n${result.error}\n\n${getFieldPrompt(nextField)}`,
        },
      ],
    };
  }

  const updated = { ...state.collectedFields, [nextField]: result.value };
  const display = getFieldDisplayName(nextField);
  let response = `✅ **${display}**: ${formatFieldValue(nextField, result.value)}\n\n`;

  const validation = validateAllCollectedFields(updated);
  if (validation.valid) {
    response += '🎉 **All Information Collected!**\n\nCalculating your IRR analysis...';
    return {
      collectedFields: updated,
      dealData: validation.dealData,
      step: 'calculation',
      messages: [{ role: 'assistant', content: response }],
    };
  }

  const collectedCount = countRequiredCollected(updated);
  const totalCount = totalRequiredFields();
  response += `**Progress**: ${collectedCount}/${totalCount} fields completed\n\n`;

  const after = getNextFieldToCollect(updated);
  if (after) {
    response += getFieldPrompt(after);
  } else {
    response += '📋 **Validating Information...**';
    return {
      collectedFields: updated,
      step: 'validation',
      messages: [{ role: 'assistant', content: response }],
    };
  }

  return {
    collectedFields: updated,
    messages: [{ role: 'assistant', content: response }],
  };
}

export async function validationNode(state: ChatState): Promise<ChatStateUpdate> {
  const validation = validateAllCollectedFields(state.collectedFields);
  if (!validation.valid) {
    return {
      step: 'data_collection',
      messages: [
        {
          role: 'assistant',
          content: `❌ **Data Validation Issue**\n\n${validation.error}\n\nLet me ask for that information again...`,
        },
      ],
    };
  }
  const deal = validation.dealData;
  const propertyDisplay =
    state.propertyType === 'shopping_center'
      ? 'Shopping Center'
      : state.propertyType === 'office'
        ? 'Office'
        : 'Property';

  let response = `✅ **Data Validation Complete**

Perfect! Here's a summary of your ${propertyDisplay} investment:

## 📋 **${deal.dealName}**

**Financial Overview:**
💰 Purchase Price: $${deal.purchasePrice.toLocaleString('en-US')}
📊 Net Operating Income: $${deal.netOperatingIncome.toLocaleString('en-US')}
📈 NOI Growth Rate: ${deal.noiGrowthRate}% annually
⏰ Hold Period: ${deal.holdPeriod} years
🎯 Exit Cap Rate: ${deal.exitCapRate}%`;

  if (deal.city) response += `\n🌆 Location: ${deal.city}`;

  response += '\n\n🔄 **Calculating IRR Analysis...**';

  return {
    dealData: deal,
    step: 'calculation',
    messages: [{ role: 'assistant', content: response }],
  };
}

export async function calculationNode(
  state: ChatState,
): Promise<ChatStateUpdate> {
  if (!state.dealData) {
    return {
      step: 'validation',
      messages: [
        {
          role: 'assistant',
          content: 'I need to validate the deal data first...',
        },
      ],
    };
  }

  // Phase 3 stub: canned IRR. Phase 4 ports calculate_irr_analysis from
  // reference-python/deal_calculator.py and validates against
  // irr_reference_values.json.
  const canned: IrrResult = {
    irrPercentage: 12.5,
    totalReturnPercentage: 157.1,
    annualCashFlowYear1: state.dealData.netOperatingIncome,
    exitValue: 8_270_254,
  };

  const performance =
    canned.irrPercentage >= 15
      ? '🟢 **Excellent Return** - This deal shows strong performance above typical real estate benchmarks.'
      : canned.irrPercentage >= 12
        ? '🟡 **Good Return** - This deal meets typical commercial real estate return expectations.'
        : canned.irrPercentage >= 8
          ? '🟠 **Moderate Return** - This deal provides moderate returns. Consider if it meets your risk-adjusted requirements.'
          : '🔴 **Below Market** - This deal shows below-market returns. Review assumptions or consider alternative investments.';

  const response = `## 📊 IRR Analysis Results

**${state.dealData.dealName}**

### Key Metrics:
- **Internal Rate of Return (IRR): ${canned.irrPercentage.toFixed(2)}%**
- **Total Return: ${canned.totalReturnPercentage.toFixed(1)}%**
- **Annual Cash Flow (Year 1): $${canned.annualCashFlowYear1.toLocaleString('en-US')}**
- **Exit Value: $${canned.exitValue.toLocaleString('en-US')}**

### Investment Summary:
- Initial Investment: $${state.dealData.purchasePrice.toLocaleString('en-US')}
- Hold Period: ${state.dealData.holdPeriod} years
- NOI Growth: ${state.dealData.noiGrowthRate}% annually

### Analysis:
${performance}

## 🎯 **Next Steps**

What would you like to do next?

1️⃣ **Analyze a New Deal** - Start fresh with property type selection
2️⃣ **Adjust Assumptions** - Modify parameters for this deal
3️⃣ **Export Results** - Get a summary for your records
4️⃣ **Exit Deal Mode** - Return to regular chat

Just let me know your preference!`;

  return {
    irrResult: canned,
    step: 'complete',
    messages: [{ role: 'assistant', content: response }],
  };
}

export async function completeNode(state: ChatState): Promise<ChatStateUpdate> {
  // Find the last user message; if the most recent assistant message contains
  // the IRR results header, this is the just-finished-calc turn — stay quiet
  // and let the user respond.
  const assistantMessages = state.messages.filter((m) => m.role === 'assistant');
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  if (
    lastAssistant?.content
      .toLowerCase()
      .includes('irr analysis results')
  ) {
    return {};
  }

  const lastUser = [...state.messages]
    .reverse()
    .find((m) => m.role === 'user');
  const userInput = (lastUser?.content ?? '').toLowerCase();

  if (userInput.includes('new')) {
    const intro = `🆕 **Starting New Analysis**

Great! Let's analyze another deal. What type of property would you like to analyze?

🏢 **Commercial Real Estate Analysis**

1️⃣ **Office Building** - Multi-tenant office properties
2️⃣ **Shopping Center** - Retail and mixed-use properties

Type **"office"** or **"shopping center"** to begin your analysis.`;
    return {
      step: 'property_selection',
      propertyType: null,
      collectedFields: {},
      dealData: null,
      irrResult: null,
      dealId: null,
      messages: [{ role: 'assistant', content: intro }],
    };
  }

  if (userInput.includes('exit') || userInput.includes('4')) {
    return {
      step: 'property_selection',
      propertyType: null,
      collectedFields: {},
      dealData: null,
      irrResult: null,
      dealId: null,
      messages: [exitMessage()],
    };
  }

  if (userInput.includes('adjust') || userInput.includes('change')) {
    return {
      messages: [
        {
          role: 'assistant',
          content: `🔧 **Adjusting Deal Assumptions**

I can help you modify the parameters for this analysis.

**What would you like to change?**

💰 Purchase price
📊 NOI or NOI growth rate
⏰ Hold period
🎯 Exit cap rate

Just tell me what you'd like to adjust and the new value.`,
        },
      ],
    };
  }

  if (userInput.includes('export') && state.dealData && state.irrResult) {
    return {
      messages: [
        {
          role: 'assistant',
          content: `📄 **Deal Summary Export**

## **${state.dealData.dealName}**

**Key Results:**
📈 IRR: ${state.irrResult.irrPercentage.toFixed(2)}%
💰 Purchase Price: $${state.dealData.purchasePrice.toLocaleString('en-US')}
📊 NOI: $${state.dealData.netOperatingIncome.toLocaleString('en-US')}
⏰ Hold Period: ${state.dealData.holdPeriod} years

✅ You can copy this information to your records.`,
        },
      ],
    };
  }

  return {
    messages: [
      {
        role: 'assistant',
        content: `💡 **How can I help?**

You can:

1️⃣ **Analyze a New Deal** - Say "new deal"
2️⃣ **Adjust Assumptions** - Say "adjust [field]"
3️⃣ **Export Results** - Say "export"
4️⃣ **Exit Deal Mode** - Say "exit"

What would you like to do next?`,
      },
    ],
  };
}

// Suppress unused import warnings for symbols re-exported by tests.
export { getMissingRequiredFields };
