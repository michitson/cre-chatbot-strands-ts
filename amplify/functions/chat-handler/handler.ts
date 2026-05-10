import { randomUUID } from 'crypto';
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { createCREAgent } from './langraph/graph.js';
import type { ChatState, Message } from './langraph/state.js';
import { FIELD_CONFIGS, FIELD_ORDER } from './utils/field-configs.js';
import { getNextFieldToCollect } from './tools/field-management.js';

const agent = createCREAgent();

// Phase 1–3: in-memory session store. Cold starts wipe state. DynamoDB
// persistence comes in Phase 4.
const sessions = new Map<string, ChatState>();

function emptyState(sessionId: string): ChatState {
  return {
    sessionId,
    messages: [],
    step: 'property_selection',
    propertyType: null,
    dealId: null,
    collectedFields: {},
    dealData: null,
    irrResult: null,
  };
}

function progressFor(state: ChatState) {
  const totalRequired = FIELD_ORDER.filter(
    (f) => FIELD_CONFIGS[f].required,
  ).length;
  const collectedRequired = Object.keys(state.collectedFields).filter(
    (k) => FIELD_CONFIGS[k]?.required,
  ).length;
  const fieldName = getNextFieldToCollect(state.collectedFields);
  return {
    current: collectedRequired,
    total: totalRequired,
    fieldName,
  };
}

function lastAssistant(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i].content;
  }
  return "I'm ready to help!";
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { message = '', sessionId: clientSessionId } = body as {
      message?: string;
      sessionId?: string;
    };

    const sessionId = clientSessionId ?? randomUUID();
    let state = sessions.get(sessionId) ?? emptyState(sessionId);

    // Allow user to start over from a completed session.
    if (message.toLowerCase().includes('new deal') && state.step === 'complete') {
      state = emptyState(sessionId);
    }

    state = {
      ...state,
      messages: [...state.messages, { role: 'user', content: message }],
    };

    const result = (await agent.invoke(state)) as ChatState;
    sessions.set(sessionId, result);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        response: lastAssistant(result.messages),
        sessionId,
        step: result.step,
        propertyType: result.propertyType,
        dealId: result.dealId,
        collectedFields: Object.keys(result.collectedFields),
        irrResult: result.irrResult,
        progress: progressFor(result),
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'An error occurred', detail: message }),
    };
  }
};
