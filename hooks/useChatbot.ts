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

  /**
   * Send a chat turn. Updates the hook's internal state (used by any
   * side-panel-style consumers) AND returns the assistant text, so the
   * `@michitson/react-chat` adapter in ChatComponent.tsx can yield it
   * into the package's stream. The package owns its own message state
   * for now (semi-controlled API) — returning the text from here is
   * the bridge until the package moves to fully-controlled `messages`
   * / `onSend` props.
   */
  async function sendMessage(text: string): Promise<string> {
    if (!CHAT_URL) {
      const reply =
        'Backend not configured. Run `npx ampx sandbox` to deploy and refresh amplify_outputs.json.';
      setMessages((prev) => [
        ...prev,
        { text, sender: 'user' },
        { text: reply, sender: 'bot' },
      ]);
      return reply;
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
      return data.response;
    } catch (err) {
      console.error(err);
      const reply = `Error: ${err instanceof Error ? err.message : 'unknown'}`;
      setMessages([...next, { text: reply, sender: 'bot' }]);
      return reply;
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
