'use client';

import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import amplifyOutputs from '@/amplify_outputs.json';

const CHAT_URL = (amplifyOutputs as { custom?: { chatHandlerUrl?: string } })
  .custom?.chatHandlerUrl;

export interface Message {
  text: string;
  sender: 'user' | 'bot';
}

interface IrrResult {
  irrPercentage: number;
  totalReturnPercentage: number;
  annualCashFlowYear1: number;
  exitValue: number;
}

interface ChatResponse {
  response: string;
  sessionId: string;
  propertyType: 'office' | 'shopping_center' | null;
  collectedFields: Record<string, unknown>;
  irrResult: IrrResult | null;
}

export default function useChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [collectedFields, setCollectedFields] = useState<Record<string, unknown>>({});
  const [irrResult, setIrrResult] = useState<IrrResult | null>(null);

  async function sendMessage(text: string) {
    if (!CHAT_URL) {
      setMessages((prev) => [
        ...prev,
        { text, sender: 'user' },
        {
          text: 'Backend not configured. Run `npx ampx sandbox` to deploy and refresh amplify_outputs.json.',
          sender: 'bot',
        },
      ]);
      return;
    }

    const next: Message[] = [...messages, { text, sender: 'user' }];
    setMessages(next);
    setIsLoading(true);

    try {
      // Pull the current Cognito session's idToken. The Authenticator
      // wrapper guarantees there's a signed-in user by the time this
      // hook is reachable, but fetchAuthSession can still fail (e.g.
      // expired refresh token after the tab sleeps overnight) — let it
      // bubble up as an HTTP-shaped error message.
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) throw new Error('not signed in');

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ message: text, sessionId: sessionId ?? undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChatResponse = await res.json();

      setSessionId(data.sessionId);
      setPropertyType(data.propertyType);
      setCollectedFields(data.collectedFields ?? {});
      setIrrResult(data.irrResult);
      setMessages([...next, { text: data.response, sender: 'bot' }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...next,
        { text: `Error: ${err instanceof Error ? err.message : 'unknown'}`, sender: 'bot' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setSessionId(null);
    setPropertyType(null);
    setCollectedFields({});
    setIrrResult(null);
  }

  return {
    messages,
    sendMessage,
    isLoading,
    propertyType,
    collectedFields,
    irrResult,
    reset,
    backendConfigured: !!CHAT_URL,
  };
}
