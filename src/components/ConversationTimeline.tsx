import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import type { ParsedMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { MessageSearchBar } from './MessageSearchBar';
import { applyMessageFilter, DEFAULT_FILTER } from '../utils/messageFilter';
import type { MessageFilter } from '../utils/messageFilter';

// ---- Types ----

interface Turn {
  id: string;
  timestamp: string;
  messages: ParsedMessage[];
}

// ---- Helpers ----

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Groups messages into turns. A turn starts with a user message
 * and includes all subsequent assistant/system/progress messages
 * until the next user message.
 */
function groupIntoTurns(messages: ParsedMessage[]): Turn[] {
  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const msg of messages) {
    if (msg.type === 'user' && !msg.isToolResult) {
      // Start a new turn
      currentTurn = {
        id: msg.id,
        timestamp: msg.timestamp,
        messages: [msg],
      };
      turns.push(currentTurn);
    } else if (currentTurn) {
      currentTurn.messages.push(msg);
    } else {
      // Messages before any user message — create a standalone turn
      currentTurn = {
        id: msg.id,
        timestamp: msg.timestamp,
        messages: [msg],
      };
      turns.push(currentTurn);
    }
  }

  return turns;
}

// ---- Styles ----

const AUTO_SCROLL_THRESHOLD = 120; // px from bottom to auto-scroll

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    position: 'relative' as const,
    background: 'var(--cv-bg-canvas)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid var(--cv-bg-elevated)',
    flexShrink: 0,
    background: 'var(--cv-bg-timeline-header)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--cv-text-primary)',
    letterSpacing: 0.3,
  },
  connectionIndicator: (connected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: connected ? 'var(--cv-status-success-bright)' : 'var(--cv-status-danger)',
  }),
  connectionDot: (connected: boolean): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: connected ? 'var(--cv-status-success)' : 'var(--cv-status-danger)',
    boxShadow: connected
      ? '0 0 6px rgba(34, 197, 94, 0.5)'
      : '0 0 6px rgba(239, 68, 68, 0.5)',
  }),
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px',
    scrollBehavior: 'smooth' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    color: 'var(--cv-text-subtle)',
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 32,
    opacity: 0.4,
  },
  emptyText: {
    color: 'var(--cv-text-subtle-alt)',
    fontSize: 14,
  },
  emptySubtext: {
    color: 'var(--cv-text-very-faint)',
    fontSize: 12,
  },
  turnDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '16px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--cv-bg-elevated)',
  },
  dividerTimestamp: {
    fontSize: 10,
    color: 'var(--cv-text-very-faint)',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    whiteSpace: 'nowrap' as const,
  },
  scrollToBottomBtn: {
    position: 'absolute' as const,
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 16px',
    borderRadius: 20,
    border: '1px solid var(--cv-border-muted)',
    background: 'var(--cv-bg-elevated)',
    color: 'var(--cv-text-muted)',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    transition: 'background 0.15s ease, color 0.15s ease',
    zIndex: 10,
  },
} as const;

// ---- Component ----

export function ConversationTimeline() {
  const messages = useStore((s) => s.messages);
  const connected = useStore((s) => s.connected);
  const loadingMessages = useStore((s) => s.loadingMessages);
  const agents = useStore((s) => s.agents);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userHasScrolledUp = useRef(false);

  const [filter, setFilter] = useState<MessageFilter>(DEFAULT_FILTER);

  // Apply filters then group into turns
  const filteredMessages = useMemo(
    () => applyMessageFilter(messages, filter),
    [messages, filter],
  );
  const turns = useMemo(() => groupIntoTurns(filteredMessages), [filteredMessages]);

  // Check if user has scrolled up from bottom
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < AUTO_SCROLL_THRESHOLD;

    userHasScrolledUp.current = !isNearBottom;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!userHasScrolledUp.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      userHasScrolledUp.current = false;
      setShowScrollButton(false);
    }
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Conversation</span>
        <div style={styles.connectionIndicator(connected)}>
          <div style={styles.connectionDot(connected)} />
          <span>
            {connected
              ? 'Connected \u2014 watching session'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Search / filter bar */}
      {messages.length > 0 && (
        <MessageSearchBar
          filter={filter}
          onFilterChange={setFilter}
          resultCount={filteredMessages.length}
          totalCount={messages.length}
          agents={agents}
        />
      )}

      {/* Scrollable message area */}
      <div
        ref={scrollAreaRef}
        style={styles.scrollArea}
        onScroll={handleScroll}
      >
        {loadingMessages ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>&#8987;</div>
            <div style={styles.emptyText}>Loading session...</div>
            <div style={styles.emptySubtext}>
              Parsing conversation transcript
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>&#9671;</div>
            <div style={styles.emptyText}>Waiting for messages...</div>
            <div style={styles.emptySubtext}>
              {connected
                ? 'Messages will appear here as the session progresses'
                : 'Select a session from the sidebar to view its conversation'}
            </div>
          </div>
        ) : (
          turns.map((turn, index) => (
            <React.Fragment key={turn.id}>
              {/* Turn divider (skip for first turn) */}
              {index > 0 && (
                <div style={styles.turnDivider}>
                  <div style={styles.dividerLine} />
                  <span style={styles.dividerTimestamp}>
                    {formatTimestamp(turn.timestamp)}
                  </span>
                  <div style={styles.dividerLine} />
                </div>
              )}

              {/* Messages in this turn */}
              {turn.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </React.Fragment>
          ))
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          style={styles.scrollToBottomBtn}
          onClick={scrollToBottom}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--cv-border-chart-axis)23a';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--cv-text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--cv-bg-elevated)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--cv-text-muted)';
          }}
        >
          <span>&#8595;</span>
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  );
}

export default ConversationTimeline;
