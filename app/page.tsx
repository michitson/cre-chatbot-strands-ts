'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import ChatComponent from '@/components/ChatComponent';
import ChatHeader from '@/components/ChatHeader';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="max-w-7xl w-full">
        <Authenticator
          signUpAttributes={['email']}
          loginMechanisms={['email']}
        >
          {({ signOut, user }) => (
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b text-sm">
                <span className="text-gray-700">
                  Signed in as{' '}
                  <span className="font-medium">
                    {user?.signInDetails?.loginId ?? 'user'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-gray-600 hover:text-gray-900 underline"
                >
                  Sign out
                </button>
              </div>
              <ChatHeader />
              <ChatComponent />
            </div>
          )}
        </Authenticator>
      </div>
    </main>
  );
}
