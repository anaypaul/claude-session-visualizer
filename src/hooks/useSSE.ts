import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { SSEEvent } from '../types';

const SSE_URL = '/events';

export function useSSE(): void {
  const handleSSEEvent = useStore((s) => s.handleSSEEvent);
  const setConnected = useStore((s) => s.setConnected);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const prevSessionRef = useRef<string | null>(null);

  // Main SSE connection
  useEffect(() => {
    const eventSource = new EventSource(SSE_URL);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (ev: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(ev.data);
        handleSSEEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      // EventSource will automatically attempt to reconnect
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [handleSSEEvent, setConnected]);

  // When active session changes, load its messages via the store
  const loadSessionMessages = useStore((s) => s.loadSessionMessages);

  useEffect(() => {
    if (
      activeSessionId &&
      activeSessionId !== prevSessionRef.current
    ) {
      prevSessionRef.current = activeSessionId;
      loadSessionMessages(activeSessionId);
    }
  }, [activeSessionId, loadSessionMessages]);
}
