import React, { useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { ParsedMessage, ToolCallInfo } from '../types';

// ---------------------------------------------------------------------------
// Tool color palette — matches ToolCallCard
// ---------------------------------------------------------------------------

const TOOL_COLORS: Record<string, string> = {
  Bash: '#f59e0b',
  Read: '#3b82f6',
  Glob: '#3b82f6',
  Grep: '#3b82f6',
  Write: '#22c55e',
  Edit: '#22c55e',
  Agent: '#a855f7',
  WebSearch: '#06b6d4',
  WebFetch: '#06b6d4',
};
const DEFAULT_TOOL_COLOR = '#6b7280';

function getToolColor(name: string): string {
  return TOOL_COLORS[name] ?? DEFAULT_TOOL_COLOR;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecoveryAction = 'Retried same tool' | 'Tried different approach' | 'Gave up';

interface ErrorIncident {
  /** Unique key for React rendering */
  key: string;
  toolCall: ToolCallInfo;
  timestamp: string;
  /** 1-based position of the assistant message in the full message list */
  turnPosition: number;
  /** Index of the tool call within its parent message's toolCalls array */
  toolCallIndex: number;
  /** The agent that produced this error, if any */
  agentId?: string;
  /** What Claude did after the error */
  recovery: RecoveryAction;
  /** Proportional position in the session (0..1) for the density strip */
  normalizedPosition: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INPUT_TRUNCATE = 120;

function summarizeInput(input: Record<string, unknown>): string {
  if (input.command && typeof input.command === 'string') return input.command;
  if (input.file_path && typeof input.file_path === 'string') return input.file_path as string;
  if (input.pattern && typeof input.pattern === 'string') return `pattern: ${input.pattern}`;
  if (input.content && typeof input.content === 'string') {
    return (input.content as string).slice(0, INPUT_TRUNCATE);
  }
  return JSON.stringify(input);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\u2026';
}

function determineRecovery(
  toolCalls: ToolCallInfo[],
  errorIndex: number,
  errorToolName: string,
): RecoveryAction {
  if (errorIndex + 1 < toolCalls.length) {
    const next = toolCalls[errorIndex + 1];
    return next.name === errorToolName ? 'Retried same tool' : 'Tried different approach';
  }
  return 'Gave up';
}

function buildIncidents(messages: ParsedMessage[]): ErrorIncident[] {
  const incidents: ErrorIncident[] = [];
  const totalMessages = messages.length;

  for (let mi = 0; mi < totalMessages; mi++) {
    const msg = messages[mi];
    if (msg.type !== 'assistant' || !msg.toolCalls) continue;

    for (let ti = 0; ti < msg.toolCalls.length; ti++) {
      const tc = msg.toolCalls[ti];
      if (!tc.isError) continue;

      incidents.push({
        key: `${msg.id}-${tc.id}`,
        toolCall: tc,
        timestamp: msg.timestamp,
        turnPosition: mi + 1,
        toolCallIndex: ti,
        agentId: msg.agentId,
        recovery: determineRecovery(msg.toolCalls, ti, tc.name),
        normalizedPosition: totalMessages > 1 ? mi / (totalMessages - 1) : 0.5,
      });
    }
  }

  return incidents;
}

function mostCommonTool(incidents: ErrorIncident[]): string | null {
  if (incidents.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const inc of incidents) {
    counts[inc.toolCall.name] = (counts[inc.toolCall.name] ?? 0) + 1;
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function countTotalToolCalls(messages: ParsedMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (msg.toolCalls) total += msg.toolCalls.length;
  }
  return total;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// Recovery badge color
// ---------------------------------------------------------------------------

const RECOVERY_COLORS: Record<RecoveryAction, { bg: string; fg: string }> = {
  'Retried same tool': { bg: '#1e3a5f', fg: '#60a5fa' },
  'Tried different approach': { bg: '#1a3329', fg: '#4ade80' },
  'Gave up': { bg: '#3b1c1c', fg: '#f87171' },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#0e0e18',
    color: '#d0d0e0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  // Error density strip
  stripContainer: {
    background: '#12121a',
    padding: '8px 16px',
    borderBottom: '1px solid #1e1e30',
    flexShrink: 0,
  },
  stripSvg: {
    display: 'block',
    width: '100%',
    height: 36,
    borderRadius: 4,
    background: '#12121a',
    cursor: 'pointer',
  },

  // Summary bar
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '8px 16px',
    borderBottom: '1px solid #1e1e30',
    background: '#13131f',
    fontSize: 13,
    color: '#8888a0',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  summaryHighlight: {
    color: '#ef4444',
    fontWeight: 700,
  },
  summaryMuted: {
    color: '#6b7280',
    fontSize: 12,
  },

  // Card list
  cardList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },

  // Individual card
  card: {
    background: '#1a1a2e',
    borderLeft: '4px solid #ef4444',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  toolBadge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: MONO,
    color: '#fff',
    background: color,
    flexShrink: 0,
  }),
  agentBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: MONO,
    color: '#c084fc',
    background: '#2d1f4e',
    flexShrink: 0,
  } as React.CSSProperties,
  cardMeta: {
    fontSize: 11,
    color: '#555',
    marginLeft: 'auto',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  inputSummary: {
    fontSize: 12,
    fontFamily: MONO,
    color: '#8888a0',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.5,
    background: '#12121a',
    padding: '6px 10px',
    borderRadius: 4,
  },
  errorMessage: {
    fontSize: 12,
    fontFamily: MONO,
    color: '#f87171',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.5,
    background: '#1c1018',
    padding: '6px 10px',
    borderRadius: 4,
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  recoveryBadge: (action: RecoveryAction): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: RECOVERY_COLORS[action].fg,
    background: RECOVERY_COLORS[action].bg,
    alignSelf: 'flex-start',
  }),

  // Empty state
  emptyRoot: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    color: '#4ade80',
  },
  emptyCheck: {
    fontSize: 48,
    lineHeight: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 600,
    color: '#4ade80',
  },
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <div style={s.emptyRoot}>
      <div style={s.emptyCheck}>{'\u2714'}</div>
      <div style={s.emptyText}>No errors found</div>
    </div>
  );
}

interface DensityStripProps {
  incidents: ErrorIncident[];
  onDotClick: (index: number) => void;
}

function DensityStrip({ incidents, onDotClick }: DensityStripProps): React.ReactElement {
  const DOT_RADIUS = 5;
  const STRIP_HEIGHT = 36;
  const PADDING_X = 12;

  return (
    <div style={s.stripContainer}>
      <svg
        style={s.stripSvg}
        viewBox={`0 0 1000 ${STRIP_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {/* Background track */}
        <rect x={0} y={STRIP_HEIGHT / 2 - 1} width={1000} height={2} rx={1} fill="#1e1e30" />

        {/* Error dots */}
        {incidents.map((inc, i) => {
          const cx = PADDING_X + inc.normalizedPosition * (1000 - 2 * PADDING_X);
          return (
            <circle
              key={inc.key}
              cx={cx}
              cy={STRIP_HEIGHT / 2}
              r={DOT_RADIUS}
              fill="#ef4444"
              opacity={0.85}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onDotClick(i);
              }}
            >
              <title>
                {`${inc.toolCall.name} error at turn ${inc.turnPosition}`}
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

interface SummaryBarProps {
  errorCount: number;
  totalToolCalls: number;
  topFailingTool: string | null;
}

function SummaryBar({ errorCount, totalToolCalls, topFailingTool }: SummaryBarProps): React.ReactElement {
  const pct = totalToolCalls > 0 ? ((errorCount / totalToolCalls) * 100).toFixed(1) : '0.0';

  return (
    <div style={s.summaryBar}>
      <span>
        <span style={s.summaryHighlight}>{errorCount}</span>
        {` error${errorCount === 1 ? '' : 's'} out of `}
        <span style={{ fontWeight: 600, color: '#d0d0e0' }}>{totalToolCalls}</span>
        {' tool calls '}
        <span style={s.summaryMuted}>({pct}% failure rate)</span>
      </span>
      {topFailingTool && (
        <span style={s.summaryMuted}>
          Most common: <span style={{ color: getToolColor(topFailingTool), fontWeight: 600 }}>{topFailingTool}</span>
        </span>
      )}
    </div>
  );
}

const RECOVERY_ICONS: Record<RecoveryAction, string> = {
  'Retried same tool': '\u21BB',        // clockwise arrow
  'Tried different approach': '\u2794',  // right arrow
  'Gave up': '\u2717',                  // cross mark
};

interface ErrorCardProps {
  incident: ErrorIncident;
  cardRef: (el: HTMLDivElement | null) => void;
}

function ErrorCard({ incident, cardRef }: ErrorCardProps): React.ReactElement {
  const { toolCall, timestamp, turnPosition, agentId, recovery } = incident;
  const color = getToolColor(toolCall.name);

  return (
    <div ref={cardRef} style={s.card}>
      {/* Header row */}
      <div style={s.cardHeader}>
        <span style={s.toolBadge(color)}>{toolCall.name}</span>
        {agentId && <span style={s.agentBadge}>agent: {agentId}</span>}
        <span style={s.cardMeta}>
          {formatTimestamp(timestamp)} &middot; turn {turnPosition}
        </span>
      </div>

      {/* Input summary */}
      <div style={s.inputSummary}>
        {truncate(summarizeInput(toolCall.input), INPUT_TRUNCATE)}
      </div>

      {/* Error message */}
      {toolCall.result != null && (
        <div style={s.errorMessage}>
          {toolCall.result}
        </div>
      )}

      {/* Recovery badge */}
      <div style={s.recoveryBadge(recovery)}>
        <span>{RECOVERY_ICONS[recovery]}</span>
        <span>{recovery}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ErrorReplayView(): React.ReactElement {
  const messages = useStore((state) => state.messages);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const incidents = useMemo(() => buildIncidents(messages), [messages]);
  const totalToolCalls = useMemo(() => countTotalToolCalls(messages), [messages]);
  const topTool = useMemo(() => mostCommonTool(incidents), [incidents]);

  const handleDotClick = useCallback((index: number) => {
    const el = cardRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight flash
      el.style.outline = '2px solid #ef4444';
      el.style.outlineOffset = '2px';
      setTimeout(() => {
        el.style.outline = 'none';
        el.style.outlineOffset = '0';
      }, 1200);
    }
  }, []);

  if (incidents.length === 0) {
    return (
      <div style={s.root}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div style={s.root}>
      <DensityStrip incidents={incidents} onDotClick={handleDotClick} />

      <SummaryBar
        errorCount={incidents.length}
        totalToolCalls={totalToolCalls}
        topFailingTool={topTool}
      />

      <div style={s.cardList}>
        {incidents.map((inc, i) => (
          <ErrorCard
            key={inc.key}
            incident={inc}
            cardRef={(el) => { cardRefs.current[i] = el; }}
          />
        ))}
      </div>
    </div>
  );
}

export default ErrorReplayView;
