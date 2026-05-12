'use client';

import {
  Chatbot,
  type ChatStreamChunk,
  type SendMessage,
} from '@michitson/react-chat';

import useChatbot from '@/hooks/useChatbot';

export default function ChatComponent() {
  const { messages, sendMessage } = useChatbot();

  const handleSend: SendMessage = async function* (chatMessages) {
    const lastUserMessage = [...chatMessages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!lastUserMessage) return;

    // useChatbot.sendMessage already has the full assistant response
    // by the time it resolves (the Lambda returns JSON, not a stream).
    // Yield it as a single chunk so the package's bubble actually
    // shows text instead of staying empty. When the package or the
    // backend moves to true streaming, this becomes a loop.
    const assistant = await sendMessage(lastUserMessage.content);
    yield assistant satisfies ChatStreamChunk;
  };

  return (
    <div className="h-[90vh] bg-white">
      <Chatbot
        initialMessages={messages.map((message, index) => ({
          id: String(index),
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.text,
        }))}
        sendMessage={handleSend}
      />
    </div>
  );
}