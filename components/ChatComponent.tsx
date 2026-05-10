'use client';

import * as React from 'react';
import { LuBot, LuSendHorizontal, LuRefreshCw, LuCircleCheck } from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import useChatbot from '@/hooks/useChatbot';
import useChatScroll from '@/hooks/useChatScroll';

const FIELD_LABELS: Record<string, string> = {
  dealName: 'Deal Name',
  purchasePrice: 'Purchase Price',
  netOperatingIncome: 'Net Operating Income',
  noiGrowthRate: 'NOI Growth Rate',
  holdPeriod: 'Hold Period',
  exitCapRate: 'Exit Cap Rate',
  city: 'City',
};

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    if (key === 'purchasePrice' || key === 'netOperatingIncome')
      return `$${value.toLocaleString('en-US')}`;
    if (key === 'noiGrowthRate' || key === 'exitCapRate') return `${value}%`;
    if (key === 'holdPeriod') return `${value} years`;
    return String(value);
  }
  return String(value);
}

export default function ChatComponent() {
  const [input, setInput] = React.useState('');
  const {
    messages,
    sendMessage,
    isLoading,
    propertyType,
    collectedFields,
    irrResult,
    reset,
    backendConfigured,
  } = useChatbot();
  const scrollRef = useChatScroll(messages);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fieldsCollected = Object.keys(collectedFields).length;
  const totalRequired = 6;
  const completed = !!irrResult;

  return (
    <div className="flex flex-col h-[90vh] bg-white">
      <h2 className="p-4 font-semibold text-lg text-center bg-blue-100 flex text-blue-800 justify-center items-center gap-2">
        Commercial Real Estate Assistant <LuBot size={25} />
        <button
          onClick={reset}
          className="ml-auto p-2 rounded-full hover:bg-blue-200"
          title="Reset conversation"
        >
          <LuRefreshCw size={20} />
        </button>
      </h2>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {!backendConfigured && (
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                Backend URL not found in <code>amplify_outputs.json</code>. Run{' '}
                <code>npx ampx sandbox</code> to deploy.
              </div>
            )}
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center mt-8">
                Type something like <em>&ldquo;analyze an office building&rdquo;</em> to start.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white ml-auto max-w-xs'
                      : 'bg-gray-100 text-gray-800 max-w-2xl prose prose-sm max-w-none'
                  }`}
                >
                  {msg.sender === 'bot' ? (
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  ) : (
                    msg.text
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="p-3 rounded-lg max-w-xs bg-gray-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center p-4 bg-gray-50 gap-2">
            <input
              type="text"
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              className="p-2"
              disabled={isLoading || !input.trim()}
              aria-label="Send"
            >
              <LuSendHorizontal
                size={25}
                className={isLoading ? 'text-gray-400' : 'text-blue-500'}
              />
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-1/3 p-4 overflow-y-auto bg-gray-50">
          <h3 className="font-semibold text-lg mb-2">Deal Details</h3>
          <div className="text-sm text-gray-500 mb-4">
            Progress: {fieldsCollected}/{totalRequired}
            {propertyType && (
              <>
                {' · '}
                <span className="capitalize">{propertyType.replace('_', ' ')}</span>
              </>
            )}
          </div>

          {fieldsCollected === 0 ? (
            <div className="text-gray-500 p-3 border border-gray-200 rounded-lg bg-white text-sm">
              No fields collected yet.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(collectedFields).map(([k, v]) => (
                <div key={k} className="p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="font-medium text-gray-500 text-xs uppercase tracking-wide">
                    {FIELD_LABELS[k] ?? k}
                  </div>
                  <div className="text-sm">{formatValue(k, v)}</div>
                </div>
              ))}
              {completed && irrResult && (
                <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                  <div className="flex items-center text-green-700 mb-2">
                    <LuCircleCheck size={20} className="mr-2" />
                    <span className="font-semibold">IRR Analysis Complete</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-gray-500">IRR:</span>{' '}
                      <strong>{irrResult.irrPercentage.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Return:</span>{' '}
                      {irrResult.totalReturnPercentage.toFixed(1)}%
                    </div>
                    <div>
                      <span className="text-gray-500">Exit Value:</span>{' '}
                      ${irrResult.exitValue.toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
