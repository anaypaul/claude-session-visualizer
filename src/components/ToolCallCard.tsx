import React, { useState } from 'react';
import type { ToolCallInfo } from '../types';

interface ToolCallCardProps {
  toolCall: ToolCallInfo;
}

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
const INPUT_TRUNCATE_LENGTH = 200;
const RESULT_TRUNCATE_LENGTH = 200;

function getToolColor(name: string): string {
  return TOOL_COLORS[name] ?? DEFAULT_TOOL_COLOR;
}

function summarizeInput(input: Record<string, unknown>): string {
  // Try to produce a meaningful one-line summary
  if (input.command && typeof input.command === 'string') {
    return input.command;
  }
  if (input.file_path && typeof input.file_path === 'string') {
    return input.file_path as string;
  }
  if (input.pattern && typeof input.pattern === 'string') {
    return `pattern: ${input.pattern}`;
  }
  if (input.content && typeof input.content === 'string') {
    return (input.content as string).slice(0, INPUT_TRUNCATE_LENGTH);
  }
  // Fallback: JSON stringified keys
  const json = JSON.stringify(input);
  return json;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const styles = {
  container: (isError: boolean, expanded: boolean): React.CSSProperties => ({
    background: '#0f0f18',
    border: isError ? '1px solid #ef4444' : '1px solid #1e1e30',
    borderRadius: 6,
    margin: '6px 0',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  chevron: (expanded: boolean): React.CSSProperties => ({
    display: 'inline-block',
    transition: 'transform 0.2s ease',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    fontSize: 9,
    color: '#555',
    flexShrink: 0,
  }),
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: '#fff',
    background: color,
    opacity: 0.9,
    flexShrink: 0,
  }),
  summary: {
    fontSize: 12,
    color: '#8888a0',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    flex: 1,
    minWidth: 0,
  },
  duration: {
    fontSize: 11,
    color: '#555',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  errorIcon: {
    fontSize: 14,
    color: '#ef4444',
    flexShrink: 0,
  },
  expandedWrapper: (expanded: boolean): React.CSSProperties => ({
    maxHeight: expanded ? 5000 : 0,
    opacity: expanded ? 1 : 0,
    transition: 'max-height 0.35s ease, opacity 0.25s ease',
    overflow: 'hidden',
  }),
  section: {
    padding: '8px 12px',
    borderTop: '1px solid #1e1e30',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: '#555',
    marginBottom: 4,
  },
  sectionContent: {
    fontSize: 12,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: '#b0b0c0',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.5,
    maxHeight: 400,
    overflowY: 'auto' as const,
  },
  errorContent: {
    color: '#f87171',
  },
} as const;

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const color = getToolColor(toolCall.name);
  const inputSummary = summarizeInput(toolCall.input);
  const isError = toolCall.isError ?? false;

  const inputDisplay = expanded
    ? JSON.stringify(toolCall.input, null, 2)
    : truncate(inputSummary, INPUT_TRUNCATE_LENGTH);

  return (
    <div style={styles.container(isError, expanded)}>
      <div
        style={styles.header}
        onClick={() => setExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        <span style={styles.chevron(expanded)}>&#9654;</span>
        <span style={styles.badge(color)}>{toolCall.name}</span>
        <span style={styles.summary} title={inputSummary}>
          {truncate(inputSummary, INPUT_TRUNCATE_LENGTH)}
        </span>
        {isError && <span style={styles.errorIcon}>&#9888;</span>}
        {toolCall.durationMs != null && (
          <span style={styles.duration}>
            {formatDuration(toolCall.durationMs)}
          </span>
        )}
      </div>
      <div style={styles.expandedWrapper(expanded)}>
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Input</div>
          <div style={styles.sectionContent}>{inputDisplay}</div>
        </div>
        {toolCall.result != null && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>
              {isError ? 'Error' : 'Result'}
            </div>
            <div
              style={{
                ...styles.sectionContent,
                ...(isError ? styles.errorContent : {}),
              }}
            >
              {expanded
                ? toolCall.result
                : truncate(toolCall.result, RESULT_TRUNCATE_LENGTH)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolCallCard;
