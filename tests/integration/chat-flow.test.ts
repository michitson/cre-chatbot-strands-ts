import { describe, expect, it } from 'vitest';
import { createCREAgent } from '../../amplify/functions/chat-handler/langraph/graph.js';
import type {
  ChatState,
  Message,
} from '../../amplify/functions/chat-handler/langraph/state.js';

function emptyState(): ChatState {
  return {
    sessionId: 'test',
    messages: [],
    step: 'property_selection',
    propertyType: null,
    dealId: null,
    collectedFields: {},
    dealData: null,
    irrResult: null,
  };
}

async function turn(
  agent: ReturnType<typeof createCREAgent>,
  prev: ChatState,
  userText: string,
): Promise<ChatState> {
  const next = (await agent.invoke({
    ...prev,
    messages: [...prev.messages, { role: 'user', content: userText } as Message],
  })) as ChatState;
  return next;
}

describe('chat flow — happy path', () => {
  it('drives the full deal-analysis workflow to completion', async () => {
    const agent = createCREAgent();
    let state = emptyState();

    state = await turn(agent, state, 'office');
    expect(state.propertyType).toBe('office');
    expect(state.step).toBe('data_collection');

    state = await turn(agent, state, 'Downtown Office Complex');
    expect(state.collectedFields.dealName).toBe('Downtown Office Complex');

    state = await turn(agent, state, '$5,000,000');
    expect(state.collectedFields.purchasePrice).toBe(5_000_000);

    state = await turn(agent, state, '$400,000');
    expect(state.collectedFields.netOperatingIncome).toBe(400_000);

    state = await turn(agent, state, '3%');
    expect(state.collectedFields.noiGrowthRate).toBeCloseTo(3.0);

    state = await turn(agent, state, '10 years');
    expect(state.collectedFields.holdPeriod).toBe(10);

    state = await turn(agent, state, '6.5%');
    expect(state.step).toBe('complete');
    expect(state.irrResult).not.toBeNull();
    expect(state.irrResult?.irrPercentage).toBe(12.5);
  });

  it('rejects unparseable currency and asks again', async () => {
    const agent = createCREAgent();
    let state = emptyState();

    state = await turn(agent, state, 'office');
    state = await turn(agent, state, 'Test Deal');
    state = await turn(agent, state, 'a few million');

    expect(state.collectedFields.purchasePrice).toBeUndefined();
    const last = state.messages[state.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.content.toLowerCase()).toContain('purchase price');
  });
});
