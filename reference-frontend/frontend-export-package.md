# Commercial Real Estate Assistant - Frontend Export Package

**Generated from conversation on: 2025**
**Project Type:** NextJS 14 + TypeScript + Tailwind CSS + React
**Architecture:** Data-driven UI with backend-controlled business logic

---

## Package Contents

This package contains the complete frontend for your Commercial Real Estate Assistant application. The UI is data-driven and expects a backend API to provide property details, completion status, and available actions.

---

## Directory Structure

```
project-root/
├── components/
│   └── ChatComponent.tsx
├── hooks/
│   ├── useChatbot.ts
│   └── useChatScroll.ts
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── tsconfig.json
└── .env.local
```

---

## File Contents

### 1. `package.json`

```json
{
  "name": "commercial-real-estate-assistant",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18",
    "react-dom": "^18",
    "react-icons": "^5.0.1",
    "react-markdown": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.17",
    "eslint": "^8",
    "eslint-config-next": "14.1.0",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

---

### 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*", "./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### 3. `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
```

---

### 4. `postcss.config.js`

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### 5. `.env.local`

```env
# Add your environment variables here
# If using OpenAI or other APIs, add keys here
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

### 6. `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### 7. `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Commercial Real Estate Assistant',
  description: 'AI-powered commercial real estate analysis tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

---

### 8. `app/page.tsx`

```tsx
import ChatComponent from '@/components/ChatComponent';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="max-w-7xl w-full bg-white shadow-lg rounded-lg overflow-hidden">
        <ChatComponent />
      </div>
    </main>
  );
}
```

---

### 9. `components/ChatComponent.tsx`

```tsx
"use client";

import * as React from "react";
import {
  LuBot,
  LuSendHorizontal,
  LuRefreshCw,
  LuCircleCheck,
  LuCalculator,
} from "react-icons/lu";
import useChatbot from "@/hooks/useChatbot";
import useChatScroll from "@/hooks/useChatScroll";
import ReactMarkdown from "react-markdown";

// Helper function to format field names for display
const formatFieldName = (key: string): string => {
  // Convert camelCase to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/Noi/g, 'NOI')
    .replace(/Npv/g, 'NPV');
};

// Helper function to format field values based on their type and key
const formatFieldValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined) return '-';
  
  // Handle nested objects (like address)
  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([nestedKey, nestedValue]) => (
          <div key={nestedKey}>
            {nestedValue ? String(nestedValue) : ''}
          </div>
        ))}
      </div>
    );
  }
  
  // Format numeric values
  if (typeof value === 'number') {
    // Price values (assuming keys containing 'price' or 'noi' are monetary)
    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('noi') || key.toLowerCase().includes('npv')) {
      return `$${value.toLocaleString()}`;
    }
    
    // Percentage values (assuming keys containing 'rate' are percentages)
    if (key.toLowerCase().includes('rate')) {
      return `${value}%`;
    }
    
    // Square footage
    if (key.toLowerCase().includes('footage')) {
      return `${value.toLocaleString()} sq ft`;
    }
  }
  
  // Default string representation
  return String(value);
};

const ChatComponent: React.FC = () => {
  const [input, setInput] = React.useState("");
  const {
    messages,
    sendMessage,
    isLoading,
    propertyDetails,
    completed,
    resetConversation,
    showActionButtons,
    actions,
    handleAction,
  } = useChatbot();
  const ref = useChatScroll(messages);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[90vh] bg-white">
      <h2 className="p-4 font-semibold text-lg text-center bg-blue-100 flex text-blue-800 justify-center items-center gap-2">
        Commercial Real Estate Assistant <LuBot size={25} />
        <button
          onClick={resetConversation}
          className="ml-auto p-2 rounded-full hover:bg-blue-200"
          title="Reset conversation"
        >
          <LuRefreshCw size={20} />
        </button>
      </h2>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat section */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center mt-8">
                Describe a commercial real estate property or ask for help
                finding one.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    msg.sender === "user"
                      ? "bg-blue-500 text-white ml-auto max-w-xs"
                      : "bg-gray-300 text-gray-800 max-w-md"
                  }`}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ))
            )}
            {isLoading && (
              <div className="p-3 rounded-lg max-w-xs bg-gray-300 text-gray-800">
                <div className="flex space-x-2">
                  <div
                    className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            {showActionButtons && actions && actions.length > 0 && (
              <div className="flex flex-col space-y-2 p-2 border border-blue-200 rounded-lg bg-blue-50">
                <div className="text-sm text-blue-700 font-medium">Available Actions:</div>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleAction(action.value)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                      disabled={isLoading}
                    >
                      {action.value === "calculate_npv" && <LuCalculator size={16} />}
                      {action.value === "reset" && <LuRefreshCw size={16} />}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center p-4 bg-gray-50">
            <input
              type="text"
              className="flex-1 p-2 border rounded-lg focus:outline-none"
              placeholder="Your message here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              className="p-2"
              disabled={isLoading || !input.trim()}
            >
              <LuSendHorizontal
                size={25}
                className={isLoading ? "text-gray-400" : "text-blue-500"}
              />
            </button>
          </div>
        </div>

        {/* Property details section - DATA DRIVEN, NO HARDCODED FIELDS */}
        <div className="w-1/3 p-4 overflow-y-auto bg-gray-50">
          <h3 className="font-semibold text-lg mb-4">Property Details</h3>

          {Object.keys(propertyDetails).length === 0 ? (
            <div className="text-gray-500 p-4 border border-gray-200 rounded-lg bg-white">
              <p>No property details collected yet.</p>
              <p className="mt-2 text-sm">
                Start by describing a commercial property.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* DYNAMICALLY RENDER ALL PROPERTY DETAILS - NO HARDCODED FIELDS */}
              {Object.entries(propertyDetails)
                .filter(([key, value]) => 
                  // Filter out complex objects that shouldn't be displayed as simple fields
                  key !== 'financialAnalysis' && 
                  key !== 'cashFlows' &&
                  value !== null && 
                  value !== undefined && 
                  value !== ''
                )
                .map(([key, value]) => (
                <div key={key} className="p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="font-medium text-gray-500">{formatFieldName(key)}</div>
                  <div>{formatFieldValue(key, value)}</div>
                </div>
              ))}

              {/* Completion status - controlled by backend */}
              {completed && (
                <div className="p-3 border border-green-200 rounded-lg bg-green-50 text-green-700 flex items-center">
                  <LuCircleCheck size={20} className="mr-2" />
                  <div>
                    <div className="font-medium">
                      All required fields collected
                    </div>
                    <div className="text-sm">Property details are complete</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
```

---

### 10. `hooks/useChatbot.ts`

```tsx
"use client";

import { useState, useEffect } from "react";

interface Message {
  text: string;
  sender: "user" | "bot";
}

interface ActionButton {
  label: string;
  value: string;
}

const useChatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Generic property details - backend determines what fields exist
  const [propertyDetails, setPropertyDetails] = useState<Record<string, any>>({});
  const [completed, setCompleted] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [actions, setActions] = useState<ActionButton[]>([]);

  // Initialize conversation on first load
  useEffect(() => {
    const initConversation = async (): Promise<void> => {
      try {
        const response = await fetch('/api/chat/init', {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error('Failed to initialize conversation');
        }
        
        const data = await response.json();
        
        if (data.conversationId) {
          setConversationId(data.conversationId);
          localStorage.setItem('conversationId', data.conversationId);
          
          // Add the welcome message to the chat
          if (data.botMessage) {
            setMessages([{ text: data.botMessage, sender: 'bot' }]);
          }
          
          // Update state with any initial data
          if (data.propertyDetails) {
            setPropertyDetails(data.propertyDetails);
          }
          setCompleted(!!data.completed);
          setShowActionButtons(!!data.showActionButtons);
          setActions(data.actions || []);
        }
      } catch (error) {
        console.error('Failed to initialize conversation:', error);
        setMessages([{
          text: "Sorry, I couldn't start the conversation. Please refresh the page.",
          sender: 'bot'
        }]);
      }
    };

    const storedId = localStorage.getItem('conversationId');
    if (storedId) {
      setConversationId(storedId);
    } else {
      initConversation();
    }
  }, []);

  const sendMessage = async (message: string, action?: string) => {
    // Add user message to the chat if it's not an action
    const newMessages: Message[] = action
      ? [...messages]
      : [...messages, { text: message, sender: "user" }];
    
    if (!action) {
      setMessages(newMessages);
    }
    setIsLoading(true);

    try {
      // Use the appropriate endpoint based on whether it's an action
      const endpoint = action ? '/api/chat/action' : '/api/chat';
      const requestBody = action 
        ? { action, conversationId }
        : { message, conversationId };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Save the conversation ID if provided
      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem("conversationId", data.conversationId);
      }

      // Accept any property details from backend - no validation
      if (data.propertyDetails) {
        setPropertyDetails(data.propertyDetails);
      }

      // Update completion status (backend determines this)
      if (data.completed !== undefined) {
        setCompleted(data.completed);
      }

      // Update action buttons (backend determines what actions are available)
      setShowActionButtons(data.showActionButtons || false);
      setActions(data.actions || []);

      // Add bot response to messages
      if (data.botMessage) {
        setMessages([...newMessages, { text: data.botMessage, sender: "bot" }]);
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setMessages([
        ...newMessages,
        {
          text: "Sorry, I encountered an error. Please try again.",
          sender: "bot",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (actionValue: string) => {
    console.log(`Executing action: ${actionValue}`);
    sendMessage("", actionValue);
  };

  const resetConversation = async () => {
    try {
      if (conversationId) {
        await fetch('/api/chat/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId }),
        });
      }
    } catch (error) {
      console.error('Error resetting conversation:', error);
    }
    
    // Clear UI state
    setMessages([]);
    setPropertyDetails({});
    setCompleted(false);
    setShowActionButtons(false);
    setActions([]);
    localStorage.removeItem('conversationId');
    setConversationId(null);
    
    // Initialize a new conversation
    try {
      const response = await fetch('/api/chat/init', { 
        method: 'POST' 
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) {
          setConversationId(data.conversationId);
          localStorage.setItem('conversationId', data.conversationId);
          
          if (data.botMessage) {
            setMessages([{ text: data.botMessage, sender: 'bot' }]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize new conversation:', err);
    }
  };

  return {
    messages,
    sendMessage,
    isLoading,
    propertyDetails,
    completed,
    resetConversation,
    showActionButtons,
    actions,
    handleAction,
  };
};

export default useChatbot;
```

---

### 11. `hooks/useChatScroll.ts`

```tsx
'use client';

import { useEffect, useRef } from 'react';

const useChatScroll = <T>(dependency: T[]) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dependency]);

  return ref;
};

export default useChatScroll;
```

---

## Expected Backend API Endpoints

Your backend (Python/Flask or NextJS API routes) should implement these endpoints:

### 1. `POST /api/chat/init`
Initialize a new conversation.

**Response:**
```json
{
  "conversationId": "uuid-string",
  "botMessage": "Welcome message",
  "propertyDetails": {},
  "completed": false,
  "showActionButtons": false,
  "actions": []
}
```

### 2. `POST /api/chat`
Send a message to the chatbot.

**Request:**
```json
{
  "message": "User's message",
  "conversationId": "uuid-string"
}
```

**Response:**
```json
{
  "botMessage": "AI response",
  "propertyDetails": {
    "propertyType": "Office",
    "askingPrice": 5000000,
    // ... any other fields the backend extracts
  },
  "completed": false,
  "showActionButtons": false,
  "actions": []
}
```

### 3. `POST /api/chat/action`
Execute an action (like calculate NPV).

**Request:**
```json
{
  "action": "calculate_npv",
  "conversationId": "uuid-string"
}
```

**Response:**
```json
{
  "botMessage": "Calculation results...",
  "propertyDetails": {
    // ... updated property details including NPV
  },
  "completed": true,
  "showActionButtons": true,
  "actions": [
    {"label": "Reset", "value": "reset"}
  ]
}
```

### 4. `POST /api/chat/reset`
Reset the conversation.

**Request:**
```json
{
  "conversationId": "uuid-string"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Installation Instructions

1. **Create a new NextJS project** (or use existing):
   ```bash
   npx create-next-app@latest my-cre-assistant --typescript
   cd my-cre-assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install react-icons react-markdown
   ```

3. **Copy all files** from this package to your project following the directory structure above.

4. **Set up Tailwind CSS** (should already be configured if you used create-next-app):
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   ```

5. **Configure your backend API URL** in `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

6. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## Key Features

✅ **Data-Driven UI** - No hardcoded business logic  
✅ **Split-Panel Design** - Chat on left, property details on right  
✅ **Dynamic Property Fields** - Displays any fields the backend provides  
✅ **Action Buttons** - Backend determines available actions  
✅ **Loading States** - Animated loading indicator  
✅ **Markdown Support** - Rich text formatting in bot messages  
✅ **Responsive Design** - Works on desktop and mobile  
✅ **TypeScript** - Full type safety  

---

## Notes for Claude Code

When importing this into your Claude Code project:

1. This is **frontend only** - you need to connect it to your Python/Flask backend
2. Update the API endpoint URLs in `useChatbot.ts` to match your Flask routes
3. The backend should return the exact JSON structure shown in the API documentation above
4. All business logic (field extraction, validation, completion checking) should be in the backend
5. The UI will automatically adapt to display whatever fields the backend provides

---

## End of Export Package

**Total Files:** 11  
**Languages:** TypeScript, CSS, JavaScript (config files)  
**Framework:** Next.js 14 with App Router  
**Styling:** Tailwind CSS  
**State Management:** React Hooks  

This package is ready to be integrated with your Python/Flask backend or any other backend that implements the expected API endpoints.