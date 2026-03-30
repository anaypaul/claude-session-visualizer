import React from 'react';
import type { ParsedMessage } from '../types';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: ParsedMessage;
}

// ---- Markdown renderer (regex-based, no external library) ----

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Render text before the code block
    if (match.index > lastIndex) {
      nodes.push(
        ...renderInlineMarkdown(text.slice(lastIndex, match.index), nodes.length)
      );
    }
    // Render code block
    const lang = match[1];
    const code = match[2];
    nodes.push(
      <pre
        key={`code-${nodes.length}`}
        style={{
          background: '#0a0a14',
          border: '1px solid #1e1e30',
          borderRadius: 6,
          padding: 12,
          margin: '8px 0',
          overflowX: 'auto',
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          color: '#c8c8d8',
        }}
      >
        {lang && (
          <div
            style={{
              fontSize: 10,
              color: '#555',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {lang}
          </div>
        )}
        <code>{code}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the last code block
  if (lastIndex < text.length) {
    nodes.push(
      ...renderInlineMarkdown(text.slice(lastIndex), nodes.length)
    );
  }

  return nodes;
}

function renderInlineMarkdown(
  text: string,
  keyOffset: number
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Process inline formatting: bold, italic, inline code
  // Order matters: bold (**) before italic (*) to avoid conflicts
  const inlineRegex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    const key = `inline-${keyOffset}-${nodes.length}`;

    if (full.startsWith('`')) {
      // Inline code
      nodes.push(
        <code
          key={key}
          style={{
            background: '#1a1a2e',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: '0.9em',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            color: '#c8c8d8',
          }}
        >
          {full.slice(1, -1)}
        </code>
      );
    } else if (full.startsWith('**')) {
      nodes.push(
        <strong key={key} style={{ color: '#e8e8f0', fontWeight: 600 }}>
          {full.slice(2, -2)}
        </strong>
      );
    } else {
      // * or _ italic
      nodes.push(
        <em key={key} style={{ fontStyle: 'italic', color: '#c0c0d0' }}>
          {full.slice(1, -1)}
        </em>
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ---- Format helpers ----

function formatModel(model?: string): string | null {
  if (!model) return null;
  // e.g., "claude-opus-4-6-20250301" -> "opus-4-6"
  const match = model.match(/(opus|sonnet|haiku)-[\d-]+/);
  if (match) return match[0];
  // Fallback: just return the model trimmed
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

// ---- Styles ----

const baseMessage: React.CSSProperties = {
  borderRadius: 8,
  padding: 16,
  margin: '8px 0',
  position: 'relative',
  lineHeight: 1.55,
  fontSize: 14,
};

const styles = {
  user: {
    ...baseMessage,
    background: '#1a1a2e',
    borderLeft: '3px solid #6366f1',
    color: '#e0e0e8',
  } as React.CSSProperties,
  assistant: {
    ...baseMessage,
    background: '#12121a',
    borderLeft: '3px solid #22c55e',
    color: '#e0e0e8',
  } as React.CSSProperties,
  system: {
    ...baseMessage,
    background: 'transparent',
    color: '#666',
    textAlign: 'center' as const,
    fontSize: 12,
    padding: '8px 16px',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  userLabel: {
    color: '#6366f1',
  },
  assistantLabel: {
    color: '#22c55e',
  },
  modelBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    padding: '1px 6px',
    borderRadius: 3,
    background: '#1a2e1a',
    color: '#4ade80',
    letterSpacing: 0.3,
    textTransform: 'none' as const,
  },
  usage: {
    display: 'flex',
    gap: 12,
    marginTop: 10,
    fontSize: 11,
    color: '#555',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
  toolResult: {
    ...baseMessage,
    background: '#14141e',
    borderLeft: '3px solid #6366f1',
    padding: 12,
  } as React.CSSProperties,
  toolResultLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: '#6366f1',
    marginBottom: 4,
  } as React.CSSProperties,
  toolResultContent: {
    fontSize: 12,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: '#b0b0c0',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.5,
    maxHeight: 200,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  errorBorder: {
    borderLeft: '3px solid #ef4444',
  },
  content: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  } as React.CSSProperties,
} as const;

// ---- Component ----

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.type === 'system') {
    return <SystemMessage message={message} />;
  }

  if (message.type === 'user') {
    return <UserMessage message={message} />;
  }

  if (message.type === 'assistant') {
    return <AssistantMessage message={message} />;
  }

  // Progress messages are rendered as system-like
  return <SystemMessage message={message} />;
}

function UserMessage({ message }: { message: ParsedMessage }) {
  // Tool result messages render as compact cards
  if (message.isToolResult) {
    const errorStyle = message.isError ? styles.errorBorder : {};
    return (
      <div style={{ ...styles.toolResult, ...errorStyle }}>
        <div style={styles.toolResultLabel}>
          {message.isError ? 'Tool Error' : 'Tool Result'}
        </div>
        <div style={styles.toolResultContent}>
          {message.userContent
            ? truncateResult(message.userContent, 500)
            : '(empty result)'}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.user}>
      <div style={{ ...styles.label, ...styles.userLabel }}>You</div>
      <div style={styles.content}>{message.userContent ?? ''}</div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ParsedMessage }) {
  const modelDisplay = formatModel(message.model);

  return (
    <div style={styles.assistant}>
      <div style={{ ...styles.label, ...styles.assistantLabel }}>
        <span>Claude</span>
        {modelDisplay && (
          <span style={styles.modelBadge}>{modelDisplay}</span>
        )}
      </div>

      {/* Thinking block */}
      {message.thinking && <ThinkingBlock thinking={message.thinking} />}

      {/* Text content with markdown */}
      {message.text && (
        <div style={styles.content}>
          {renderMarkdown(message.text)}
        </div>
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Usage */}
      {message.usage && (
        <div style={styles.usage}>
          <span>
            &#8595;{message.usage.input_tokens.toLocaleString()} tokens in
          </span>
          <span>
            &#8593;{message.usage.output_tokens.toLocaleString()} tokens out
          </span>
        </div>
      )}
    </div>
  );
}

function SystemMessage({ message }: { message: ParsedMessage }) {
  let text = '';

  if (message.subtype === 'turn_duration' && message.durationMs != null) {
    const secs = (message.durationMs / 1000).toFixed(1);
    text = `Turn completed in ${secs}s`;
  } else if (message.durationMs != null) {
    const secs = (message.durationMs / 1000).toFixed(1);
    text = `${secs}s`;
  } else if (message.type === 'progress') {
    text = 'Processing...';
  } else {
    text = message.subtype ?? 'system';
  }

  return (
    <div style={styles.system}>
      <span>{text}</span>
    </div>
  );
}

function truncateResult(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export default MessageBubble;
