'use client';

import { useEffect, useRef } from 'react';

export default function useChatScroll<T>(dep: T[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}
