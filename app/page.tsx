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
