import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store';
import type { SessionInfo } from '../types';

// Extended session info with history fields from the API
interface HistoricalSession extends SessionInfo {
  projectName?: string;
  projectDir?: string;
  lastActivityAt?: number;
  fileSizeBytes?: number;
}

type FilterMode = 'all' | 'active' | 'closed';

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 6) + '...' + id.slice(-4);
}

function shortenCwd(cwd: string): string {
  const parts = cwd.split('/');
  if (parts.length <= 2) return cwd;
  return '.../' + parts.slice(-2).join('/');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    overflow: 'hidden',
  },
  filterBar: {
    display: 'flex',
    gap: '2px',
    padding: '8px 8px 4px',
    flexShrink: 0,
  },
  filterBtn: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: active ? 600 : 400,
    color: active ? '#e0e0e8' : '#6666a0',
    backgroundColor: active ? '#1e1e3a' : 'transparent',
    border: active ? '1px solid #333355' : '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center' as const,
  }),
  searchBox: {
    margin: '4px 8px 8px',
    padding: '7px 10px',
    fontSize: '12px',
    backgroundColor: '#0e0e16',
    border: '1px solid #222238',
    borderRadius: '6px',
    color: '#e0e0e8',
    outline: 'none',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  } as React.CSSProperties,
  countBadge: {
    fontSize: '10px',
    color: '#6666a0',
    padding: '4px 12px 2px',
    flexShrink: 0,
  } as React.CSSProperties,
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    overflowY: 'auto' as const,
    flex: 1,
    padding: '0 8px 8px',
  },
  groupLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#6666a0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    padding: '10px 4px 4px',
  } as React.CSSProperties,
  item: (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: isSelected ? '#1e1e3a' : 'transparent',
    border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
    transition: 'background-color 0.15s, border-color 0.15s',
  }),
  topRow: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: '8px',
  },
  sessionId: {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '12px',
    color: '#c0c0d0',
    fontWeight: 500 as const,
  },
  badge: (active: boolean): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    backgroundColor: active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(136, 136, 160, 0.1)',
    color: active ? '#22c55e' : '#8888a0',
    flexShrink: 0,
  }),
  projectBadge: {
    fontSize: '10px',
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: '#818cf8',
    flexShrink: 0,
  } as React.CSSProperties,
  middleRow: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: '8px',
  },
  cwd: {
    fontSize: '11px',
    color: '#8888a0',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  meta: {
    fontSize: '10px',
    color: '#555570',
  },
  time: {
    fontSize: '11px',
    color: '#6666a0',
    flexShrink: 0,
  },
  emptyState: {
    padding: '24px 16px',
    textAlign: 'center' as const,
    color: '#6666a0',
    fontSize: '13px',
  },
};

function SessionItem({
  session,
  isSelected,
  onClick,
}: {
  session: HistoricalSession;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const duration = session.lastActivityAt
    ? formatDuration(session.startedAt, session.lastActivityAt)
    : null;

  return (
    <div
      style={{
        ...s.item(isSelected),
        ...(hovered && !isSelected ? { backgroundColor: '#15152a' } : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.topRow}>
        <span style={s.sessionId}>{truncateId(session.sessionId)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={s.badge(session.isActive)}>
            {session.isActive ? 'live' : 'closed'}
          </span>
        </div>
      </div>
      <div style={s.middleRow}>
        {session.projectName && (
          <span style={s.projectBadge}>{session.projectName}</span>
        )}
        <span style={s.meta}>
          {session.messageCount} msgs
          {duration && ` · ${duration}`}
          {session.fileSizeBytes && ` · ${formatSize(session.fileSizeBytes)}`}
        </span>
      </div>
      <div style={s.bottomRow}>
        <span style={s.cwd}>{shortenCwd(session.cwd)}</span>
        <span style={s.time}>{formatTime(session.lastActivityAt ?? session.startedAt)}</span>
      </div>
    </div>
  );
}

export function SessionList() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSession = useStore((s) => s.setActiveSession);
  const storeSetSessions = useStore((s) => s.setSessions);
  const loadSessionMessages = useStore((s) => s.loadSessionMessages);

  const [allSessions, setAllSessions] = useState<HistoricalSession[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all sessions from the API on mount
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        setAllSessions(data.sessions ?? []);
        // Also update the store with session info
        storeSetSessions(data.sessions ?? []);

        // Auto-select the first active session and load its messages
        if (!activeSessionId && data.sessions?.length > 0) {
          const firstActive = data.sessions.find((s: HistoricalSession) => s.isActive);
          const toSelect = firstActive ?? data.sessions[0];
          if (toSelect) {
            setActiveSession(toSelect.sessionId);
            loadSessionMessages(toSelect.sessionId);
          }
        }
      } catch {
        // Retry after a short delay
        setTimeout(fetchSessions, 2000);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();

    // Refresh every 30s to pick up new sessions
    const interval = setInterval(fetchSessions, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    let list = allSessions;

    if (filter === 'active') list = list.filter(s => s.isActive);
    if (filter === 'closed') list = list.filter(s => !s.isActive);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.sessionId.toLowerCase().includes(q) ||
        s.cwd.toLowerCase().includes(q) ||
        (s.projectName?.toLowerCase().includes(q) ?? false)
      );
    }

    return list;
  }, [allSessions, filter, search]);

  const activeSessions = allSessions.filter(s => s.isActive);
  const closedSessions = allSessions.filter(s => !s.isActive);

  const handleSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    loadSessionMessages(sessionId);
  };

  if (loading) {
    return <div style={s.emptyState}>Loading sessions...</div>;
  }

  return (
    <div style={s.container}>
      {/* Filter tabs */}
      <div style={s.filterBar}>
        <button style={s.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>
          All ({allSessions.length})
        </button>
        <button style={s.filterBtn(filter === 'active')} onClick={() => setFilter('active')}>
          Live ({activeSessions.length})
        </button>
        <button style={s.filterBtn(filter === 'closed')} onClick={() => setFilter('closed')}>
          Closed ({closedSessions.length})
        </button>
      </div>

      {/* Search */}
      <input
        style={s.searchBox}
        placeholder="Search sessions..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Count */}
      <div style={s.countBadge}>
        {filtered.length} session{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Session list */}
      <div style={s.list}>
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            {search ? 'No matching sessions.' : 'No sessions found.'}
          </div>
        ) : (
          filtered.map((session) => (
            <SessionItem
              key={session.sessionId}
              session={session}
              isSelected={session.sessionId === activeSessionId}
              onClick={() => handleSelect(session.sessionId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
