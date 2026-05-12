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

    await sendMessage(lastUserMessage.content);

    yield '' satisfies ChatStreamChunk;
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