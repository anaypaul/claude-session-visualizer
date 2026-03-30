import React, { useState } from 'react';

interface ThinkingBlockProps {
  thinking: string;
}

const styles = {
  container: (expanded: boolean): React.CSSProperties => ({
    background: '#0d0d15',
    border: '1px dashed #333',
    borderRadius: 8,
    margin: '8px 0',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    color: '#8888a0',
    fontSize: 13,
    fontStyle: 'italic' as const,
  },
  chevron: (expanded: boolean): React.CSSProperties => ({
    display: 'inline-block',
    transition: 'transform 0.2s ease',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    fontSize: 10,
    color: '#555',
  }),
  contentWrapper: (expanded: boolean): React.CSSProperties => ({
    maxHeight: expanded ? 2000 : 0,
    opacity: expanded ? 1 : 0,
    transition: 'max-height 0.35s ease, opacity 0.25s ease',
    overflow: 'hidden',
  }),
  content: {
    padding: '0 14px 14px 14px',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: 12,
    lineHeight: 1.6,
    color: '#7a7a90',
    fontStyle: 'italic' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
} as const;

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.container(expanded)}>
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
        <span>
          {expanded
            ? 'Thinking...'
            : 'Thinking... (click to expand)'}
        </span>
      </div>
      <div style={styles.contentWrapper(expanded)}>
        <div style={styles.content}>{thinking}</div>
      </div>
    </div>
  );
}

export default ThinkingBlock;
