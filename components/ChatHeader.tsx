'use client';

import { LuBuilding2 } from 'react-icons/lu';

/**
 * Branded header bar that sits above the @michitson/react-chat Chatbot
 * in app/page.tsx. The package is intentionally generic and renders no
 * header itself; this is the app's CRE-specific framing — kept as a
 * separate component so page.tsx stays small and the styling is easy
 * to iterate on.
 */
export default function ChatHeader() {
  return (
    <h2
      className="flex items-center justify-center gap-2 bg-blue-100 p-4
                 text-center text-lg font-semibold text-blue-800"
    >
      <LuBuilding2 size={25} />
      CRE Deal Analyzer
    </h2>
  );
}
