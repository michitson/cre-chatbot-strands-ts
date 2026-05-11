import type { Metadata } from 'next';
import './globals.css';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplify from './ConfigureAmplify';

export const metadata: Metadata = {
  title: 'CRE Chatbot',
  description: 'Commercial real estate investment-analysis chatbot.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ConfigureAmplify />
        {children}
      </body>
    </html>
  );
}
