import React, { useCallback, useRef, useEffect } from 'react';
import type { MessageFilter } from '../utils/messageFilter';
import type { AgentInfo } from '../types';

// ---- Props ----

interface MessageSearchBarProps {
  filter: MessageFilter;
  onFilterChange: (filter: MessageFilter) => void;
  resultCount: number;
  totalCount: number;
  agents: AgentInfo[];
}

// ---- Styles ----

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 16px',
  minHeight: 48,
  background: '#12121a',
  borderBottom: '1px solid #1a1a2e',
  flexShrink: 0,
  flexWrap: 'wrap',
};

const searchInputStyle: React.CSSProperties = {
  flex: '1 1 180px',
  minWidth: 140,
  height: 30,
  padding: '0 10px 0 30px',
  border: '1px solid #2a2a3e',
  borderRadius: 6,
  background: '#0a0a0f',
  color: '#e0e0e8',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
};

const searchWrapperStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 180px',
  minWidth: 140,
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 9,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 13,
  color: '#555',
  pointerEvents: 'none',
  lineHeight: 1,
};

const pillGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  flexWrap: 'wrap',
};

function pillStyle(active: boolean, color?: string): React.CSSProperties {
  const bg = active
    ? color === 'red'
      ? '#5c1a1a'
      : '#1e2a4a'
    : '#16161e';
  const border = active
    ? color === 'red'
      ? '#a03030'
      : '#3060b0'
    : '#2a2a3e';
  const textColor = active
    ? color === 'red'
      ? '#ff6b6b'
      : '#8cb4ff'
    : '#666';

  return {
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 500,
    border: `1px solid ${border}`,
    borderRadius: 12,
    background: bg,
    color: textColor,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    lineHeight: '20px',
  };
}

const selectStyle: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  border: '1px solid #2a2a3e',
  borderRadius: 6,
  background: '#0a0a0f',
  color: '#e0e0e8',
  fontSize: 11,
  outline: 'none',
  cursor: 'pointer',
  maxWidth: 140,
};

const countBarStyle: React.CSSProperties = {
  padding: '3px 16px',
  fontSize: 10,
  color: '#555',
  background: '#0e0e16',
  borderBottom: '1px solid #1a1a2e',
  flexShrink: 0,
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
};

// ---- Component ----

export function MessageSearchBar({
  filter,
  onFilterChange,
  resultCount,
  totalCount,
  agents,
}: MessageSearchBarProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ ...filter, searchQuery: value });
      }, 300);
    },
    [filter, onFilterChange],
  );

  const toggle = useCallback(
    (key: keyof MessageFilter) => {
      onFilterChange({ ...filter, [key]: !filter[key] });
    },
    [filter, onFilterChange],
  );

  const handleAgentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onFilterChange({ ...filter, agentId: val === '__all__' ? null : val });
    },
    [filter, onFilterChange],
  );

  const isFiltered = resultCount !== totalCount;

  return (
    <>
      <div style={barStyle}>
        {/* Search input */}
        <div style={searchWrapperStyle}>
          <span style={searchIconStyle}>&#128269;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages..."
            defaultValue={filter.searchQuery}
            onChange={handleSearchChange}
            style={searchInputStyle}
          />
        </div>

        {/* Filter pills */}
        <div style={pillGroupStyle}>
          <span
            role="button"
            tabIndex={0}
            style={pillStyle(filter.showUser)}
            onClick={() => toggle('showUser')}
            onKeyDown={(e) => e.key === 'Enter' && toggle('showUser')}
          >
            User
          </span>
          <span
            role="button"
            tabIndex={0}
            style={pillStyle(filter.showAssistant)}
            onClick={() => toggle('showAssistant')}
            onKeyDown={(e) => e.key === 'Enter' && toggle('showAssistant')}
          >
            Assistant
          </span>
          <span
            role="button"
            tabIndex={0}
            style={pillStyle(filter.showSystem)}
            onClick={() => toggle('showSystem')}
            onKeyDown={(e) => e.key === 'Enter' && toggle('showSystem')}
          >
            System
          </span>
          <span
            role="button"
            tabIndex={0}
            style={pillStyle(filter.showSidechains)}
            onClick={() => toggle('showSidechains')}
            onKeyDown={(e) => e.key === 'Enter' && toggle('showSidechains')}
          >
            Sidechains
          </span>
          <span
            role="button"
            tabIndex={0}
            style={pillStyle(filter.errorsOnly, 'red')}
            onClick={() => toggle('errorsOnly')}
            onKeyDown={(e) => e.key === 'Enter' && toggle('errorsOnly')}
          >
            Errors only
          </span>

          {/* Agent dropdown (only if agents exist) */}
          {agents.length > 0 && (
            <select
              style={selectStyle}
              value={filter.agentId ?? '__all__'}
              onChange={handleAgentChange}
            >
              <option value="__all__">All agents</option>
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.agentType || a.agentId}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Result count */}
      <div style={countBarStyle}>
        {isFiltered
          ? `Showing ${resultCount} of ${totalCount} messages`
          : `${totalCount} messages`}
      </div>
    </>
  );
}

export default MessageSearchBar;
