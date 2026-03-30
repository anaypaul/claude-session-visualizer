import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../store';
import type { ParsedMessage } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThinkingEntry {
  turnIndex: number;
  message: ParsedMessage;
  thinking: string;
  triggerMessage: ParsedMessage | null;
  charCount: number;
  estimatedTokens: number;
}

interface SparklinePoint {
  index: number;
  chars: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highlightText(
  text: string,
  query: string,
): React.ReactNode {
  if (!query) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        style={{
          backgroundColor: 'rgba(250, 204, 21, 0.4)',
          color: '#fef08a',
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatModel(model?: string): string {
  if (!model) return 'unknown';
  // Trim version suffixes like "-20260301"
  return model.replace(/-\d{8}$/, '');
}

// ---------------------------------------------------------------------------
// Sparkline tooltip
// ---------------------------------------------------------------------------

function SparklineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SparklinePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 11,
        color: '#e0e0e8',
      }}
    >
      <div style={{ color: '#8888a0', marginBottom: 2 }}>Turn {point.index}</div>
      <div style={{ fontWeight: 600 }}>
        {point.chars.toLocaleString()} chars (~{Math.round(point.chars / 4).toLocaleString()} tokens)
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThinkingExplorer(): React.ReactElement {
  const messages = useStore((s) => s.messages);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  // Build thinking entries from messages
  const entries = useMemo<ThinkingEntry[]>(() => {
    const result: ThinkingEntry[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type !== 'assistant' || !msg.thinking) continue;

      // Find the preceding user message (trigger context)
      let trigger: ParsedMessage | null = null;
      if (msg.parentId) {
        trigger = messages.find((m) => m.id === msg.parentId) ?? null;
      }
      if (!trigger) {
        // Fall back to scanning backwards for the nearest user message
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].type === 'user') {
            trigger = messages[j];
            break;
          }
        }
      }

      const charCount = msg.thinking.length;
      result.push({
        turnIndex: i + 1,
        message: msg,
        thinking: msg.thinking,
        triggerMessage: trigger,
        charCount,
        estimatedTokens: Math.round(charCount / 4),
      });
    }

    // Sort by timestamp
    result.sort(
      (a, b) =>
        new Date(a.message.timestamp).getTime() -
        new Date(b.message.timestamp).getTime(),
    );

    return result;
  }, [messages]);

  // Sparkline data
  const sparklineData = useMemo<SparklinePoint[]>(
    () =>
      entries.map((e) => ({
        index: e.turnIndex,
        chars: e.charCount,
      })),
    [entries],
  );

  // Filtered entries based on search
  const filteredEntries = useMemo(() => {
    if (!debouncedQuery) return entries;
    const lower = debouncedQuery.toLowerCase();
    return entries.filter((e) => e.thinking.toLowerCase().includes(lower));
  }, [entries, debouncedQuery]);

  // Match count for search display
  const matchCount = useMemo(() => {
    if (!debouncedQuery) return 0;
    const lower = debouncedQuery.toLowerCase();
    let count = 0;
    for (const e of filteredEntries) {
      const text = e.thinking.toLowerCase();
      let idx = 0;
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        count++;
        idx += lower.length;
      }
    }
    return count;
  }, [filteredEntries, debouncedQuery]);

  // Summary stats
  const stats = useMemo(() => {
    if (entries.length === 0) {
      return {
        total: 0,
        totalTokens: 0,
        avgLength: 0,
        longestTurn: 0,
        longestChars: 0,
      };
    }
    const totalChars = entries.reduce((s, e) => s + e.charCount, 0);
    let longestIdx = 0;
    let longestChars = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].charCount > longestChars) {
        longestChars = entries[i].charCount;
        longestIdx = i;
      }
    }
    return {
      total: entries.length,
      totalTokens: Math.round(totalChars / 4),
      avgLength: Math.round(totalChars / entries.length),
      longestTurn: entries[longestIdx].turnIndex,
      longestChars,
    };
  }, [entries]);

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  if (entries.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: '#555',
          fontSize: 14,
          fontStyle: 'italic',
        }}
      >
        No thinking blocks found
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div style={{ width: '100%', color: '#e0e0e8', fontFamily: 'inherit' }}>
      {/* Summary Stats Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          padding: '12px 16px',
          marginBottom: 8,
          background: 'rgba(139, 92, 246, 0.06)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        <StatBadge label="Thinking Blocks" value={stats.total.toString()} />
        <StatBadge
          label="Est. Thinking Tokens"
          value={stats.totalTokens.toLocaleString()}
        />
        <StatBadge
          label="Avg Length"
          value={`${stats.avgLength.toLocaleString()} chars`}
        />
        <StatBadge
          label="Longest Block"
          value={`Turn ${stats.longestTurn} (${stats.longestChars.toLocaleString()} chars)`}
          highlight
        />
      </div>

      {/* Thinking Density Sparkline */}
      <div
        style={{
          width: '100%',
          height: 48,
          marginBottom: 12,
        }}
      >
        <ResponsiveContainer width="100%" height={48}>
          <AreaChart
            data={sparklineData}
            margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
          >
            <defs>
              <linearGradient id="thinking-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="index" hide />
            <YAxis hide />
            <Tooltip content={<SparklineTooltip />} />
            <Area
              type="monotone"
              dataKey="chars"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              fill="url(#thinking-grad)"
              dot={false}
              activeDot={{
                r: 3,
                fill: '#8b5cf6',
                stroke: '#1a1a2e',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16, padding: '0 4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="text"
            placeholder="Search thinking blocks..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              background: '#111119',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              color: '#e0e0e8',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {debouncedQuery && (
            <span
              style={{
                fontSize: 11,
                color: '#8888a0',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {matchCount} match{matchCount !== 1 ? 'es' : ''} in{' '}
              {filteredEntries.length} thinking block
              {filteredEntries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Thinking Block Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {filteredEntries.map((entry) => (
          <ThinkingCard
            key={entry.message.id}
            entry={entry}
            searchQuery={debouncedQuery}
          />
        ))}

        {debouncedQuery && filteredEntries.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#555',
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            No thinking blocks match "{debouncedQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatBadge sub-component
// ---------------------------------------------------------------------------

function StatBadge({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          color: '#8888a0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: highlight ? '#8b5cf6' : '#e0e0e8',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThinkingCard sub-component
// ---------------------------------------------------------------------------

function ThinkingCard({
  entry,
  searchQuery,
}: {
  entry: ThinkingEntry;
  searchQuery: string;
}) {
  const { turnIndex, message, thinking, triggerMessage, charCount, estimatedTokens } =
    entry;

  // Determine what followed the thinking
  let whatFollowed = '';
  if (message.toolCalls && message.toolCalls.length > 0) {
    const toolNames = message.toolCalls.map((tc) => tc.name).join(', ');
    whatFollowed = `Then called: ${toolNames}`;
  } else if (message.text) {
    whatFollowed = truncate(message.text, 80);
  }

  // Trigger context from the user message
  const triggerText = triggerMessage?.userContent
    ? truncate(triggerMessage.userContent, 100)
    : triggerMessage?.type === 'user' && triggerMessage?.isToolResult
      ? `[Tool result for ${triggerMessage.toolUseId ?? 'unknown'}]`
      : null;

  return (
    <div
      style={{
        background: '#0d0d15',
        border: '1px dashed #333',
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#e0e0e8',
          }}
        >
          Turn {turnIndex}
        </span>
        <span style={{ fontSize: 11, color: '#666' }}>
          {formatTimestamp(message.timestamp)}
        </span>
        {message.model && (
          <span
            style={{
              fontSize: 10,
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {formatModel(message.model)}
          </span>
        )}
      </div>

      {/* Trigger context */}
      {triggerText && (
        <div
          style={{
            fontSize: 12,
            color: '#8888a0',
            marginBottom: 10,
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 4,
            borderLeft: '2px solid #333',
          }}
        >
          <span style={{ color: '#555', marginRight: 6 }}>Triggered by:</span>
          {triggerText}
        </div>
      )}

      {/* Thinking content */}
      <div
        style={{
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 12,
          lineHeight: 1.6,
          color: '#9ca3af',
          fontStyle: 'italic',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 300,
          overflowY: 'auto',
          padding: '10px 12px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 4,
          marginBottom: 10,
        }}
      >
        {searchQuery ? highlightText(thinking, searchQuery) : thinking}
      </div>

      {/* Stats line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 11,
          color: '#666',
        }}
      >
        <span>
          ~{estimatedTokens.toLocaleString()} tokens estimated (
          {charCount.toLocaleString()} chars)
        </span>

        {/* What followed */}
        {whatFollowed && (
          <span
            style={{
              color: '#8888a0',
              maxWidth: 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {whatFollowed}
          </span>
        )}
      </div>
    </div>
  );
}

export default ThinkingExplorer;
