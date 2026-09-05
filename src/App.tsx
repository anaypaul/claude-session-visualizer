import React, { useState } from 'react';
import { useStore } from './store';
import { useSSE } from './hooks/useSSE';
import { SessionList } from './components/SessionList';
import { ConversationTimeline } from './components/ConversationTimeline';
import { AgentGraph } from './components/AgentGraph';
import { TaskBoard } from './components/TaskBoard';
import { MetricsPanel } from './components/MetricsPanel';
import { TokenBurnChart } from './components/TokenBurnChart';
import { ThinkingExplorer } from './components/ThinkingExplorer';
import { ErrorReplayView } from './components/ErrorReplayView';
import {
  exportSessionAsJson,
  exportSessionAsMarkdown,
} from './utils/sessionExport';

type TabId = 'timeline' | 'agents' | 'tasks' | 'costs' | 'thinking' | 'errors';

const TABS: { id: TabId; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'agents', label: 'Execution Tree' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'costs', label: 'Costs' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'errors', label: 'Errors' },
];

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  timeline: ConversationTimeline,
  agents: AgentGraph,
  tasks: TaskBoard,
  costs: TokenBurnChart,
  thinking: ThinkingExplorer,
  errors: ErrorReplayView,
};

// -- Styles --

const s = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--cv-bg-canvas)',
    color: 'var(--cv-text-primary)',
    overflow: 'hidden',
  } as React.CSSProperties,

  sidebar: {
    width: '280px',
    minWidth: '280px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--cv-bg-panel)',
    borderRight: '1px solid var(--cv-border-default)',
    overflow: 'hidden',
  } as React.CSSProperties,

  sidebarCollapsed: {
    width: '0px',
    minWidth: '0px',
    borderRight: 'none',
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    padding: '20px 16px 16px',
    borderBottom: '1px solid var(--cv-border-default)',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--cv-text-primary)',
    letterSpacing: '-0.2px',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '11px',
    color: 'var(--cv-text-faint)',
    marginTop: '4px',
  } as React.CSSProperties,

  sessionsLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--cv-text-faint)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    padding: '12px 16px 6px',
    flexShrink: 0,
  } as React.CSSProperties,

  metricsPanel: {
    borderTop: '1px solid var(--cv-border-default)',
    padding: '12px 16px',
    flexShrink: 0,
  } as React.CSSProperties,

  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  } as React.CSSProperties,

  metricLabel: {
    fontSize: '11px',
    color: 'var(--cv-text-faint)',
  } as React.CSSProperties,

  metricValue: {
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  } as React.CSSProperties,

  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,

  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    padding: '0 16px',
    backgroundColor: 'var(--cv-bg-header-bar)',
    borderBottom: '1px solid var(--cv-border-default)',
    flexShrink: 0,
  } as React.CSSProperties,

  tabBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    flex: 1,
  } as React.CSSProperties,

  tabBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  } as React.CSSProperties,

  exportWrap: {
    position: 'relative' as const,
  } as React.CSSProperties,

  exportBtn: {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--cv-text-export-btn)',
    backgroundColor: 'var(--cv-bg-elevated)',
    border: '1px solid var(--cv-border-active)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s',
  } as React.CSSProperties,

  exportMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '170px',
    backgroundColor: 'var(--cv-bg-menu)',
    border: '1px solid var(--cv-border-default)',
    borderRadius: '10px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
    padding: '6px',
    zIndex: 20,
  } as React.CSSProperties,

  exportMenuBtn: {
    width: '100%',
    padding: '9px 10px',
    textAlign: 'left' as const,
    fontSize: '12px',
    color: 'var(--cv-text-primary)',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,

  exportHint: {
    fontSize: '11px',
    color: 'var(--cv-text-faint)',
    marginRight: '2px',
  } as React.CSSProperties,

  tabContent: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: 'var(--cv-bg-canvas)',
  } as React.CSSProperties,

  connectionDot: (connected: boolean): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: connected ? 'var(--cv-status-success)' : 'var(--cv-status-danger)',
    boxShadow: connected
      ? '0 0 6px rgba(34, 197, 94, 0.5)'
      : '0 0 6px rgba(239, 68, 68, 0.4)',
  }),

  connectionLabel: {
    fontSize: '11px',
    color: 'var(--cv-text-muted)',
  } as React.CSSProperties,

  collapseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--cv-text-faint)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: 1,
  } as React.CSSProperties,

  themeToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    background: 'var(--cv-bg-elevated)',
    border: '1px solid var(--cv-border-active)',
    borderRadius: '8px',
    color: 'var(--cv-text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'background-color 0.15s, border-color 0.15s',
  } as React.CSSProperties,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '12px 18px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--cv-text-primary)' : 'var(--cv-text-muted)',
    cursor: 'pointer',
    borderBottom: active ? '2px solid var(--cv-accent-indigo)' : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomStyle: 'solid',
    borderBottomWidth: '2px',
    borderBottomColor: active ? 'var(--cv-accent-indigo)' : 'transparent',
    transition: 'color 0.15s, border-color 0.15s',
  };
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function MetricsSummary() {
  const sessions = useStore((s) => s.sessions);
  const messages = useStore((s) => s.messages);
  
  
  const agents = useStore((s) => s.agents);

  const activeSessions = sessions.filter((s) => s.isActive).length;
  const activeAgents = agents.filter((a) => a.status === 'running').length;

  // Sum tokens across loaded messages
  let totalTokens = 0;
  for (const msg of messages) {
    if (msg.usage) {
      totalTokens += msg.usage.input_tokens + msg.usage.output_tokens;
    }
  }


  return (
    <div style={s.metricsPanel}>
      <div style={s.metricRow}>
        <span style={s.metricLabel}>Active sessions</span>
        <span style={{ ...s.metricValue, color: activeSessions > 0 ? 'var(--cv-status-success)' : 'var(--cv-text-muted)' }}>
          {activeSessions}
        </span>
      </div>
      <div style={s.metricRow}>
        <span style={s.metricLabel}>Running agents</span>
        <span style={{ ...s.metricValue, color: activeAgents > 0 ? 'var(--cv-accent-indigo-light)' : 'var(--cv-text-muted)' }}>
          {activeAgents}
        </span>
      </div>
      <div style={s.metricRow}>
        <span style={s.metricLabel}>Tokens (session)</span>
        <span style={{ ...s.metricValue, color: 'var(--cv-text-primary)' }}>
          {formatTokenCount(totalTokens)}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const connected = useStore((s) => s.connected);
  const messages = useStore((s) => s.messages);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const themeMode = useStore((s) => s.themeMode);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const activeSession = sessions.find((session) => session.sessionId === activeSessionId) ?? null;

  // Establish SSE connection
  useSSE();

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={sidebarVisible ? s.sidebar : { ...s.sidebar, ...s.sidebarCollapsed }}>
        {sidebarVisible && (
          <>
            <div style={s.header}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={s.title}>Claude Session Visualizer</div>
                  <div style={s.subtitle}>Live dashboard</div>
                </div>
                <button
                  style={s.collapseBtn}
                  onClick={() => setSidebarVisible(false)}
                  title="Collapse sidebar"
                >
                  {'\u00AB'}
                </button>
              </div>
            </div>
            <div style={s.sessionsLabel}>Sessions</div>
            <SessionList />
            <MetricsSummary />
          </>
        )}
      </aside>

      {/* Main content area */}
      <main style={s.main}>
        <div style={s.tabBar}>
          <div style={s.tabBarLeft}>
            {!sidebarVisible && (
              <button
                style={{ ...s.collapseBtn, marginRight: '8px' }}
                onClick={() => setSidebarVisible(true)}
                title="Show sidebar"
              >
                {'\u00BB'}
              </button>
            )}
            {TABS.map((tab) => (
              <button
                key={tab.id}
                style={tabStyle(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={s.tabBarRight}>
            <div style={s.exportWrap}>
              <button
                style={{
                  ...s.exportBtn,
                  opacity: messages.length === 0 ? 0.6 : 1,
                  cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  if (messages.length === 0) return;
                  setExportMenuOpen((open) => !open);
                }}
                title={messages.length === 0 ? 'Load a session to export it' : 'Export current session'}
                disabled={messages.length === 0}
              >
                Export
              </button>
              {exportMenuOpen && messages.length > 0 && (
                <div style={s.exportMenu}>
                  <button
                    style={s.exportMenuBtn}
                    onClick={() => {
                      exportSessionAsJson(activeSession, messages);
                      setExportMenuOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--cv-bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Download JSON
                  </button>
                  <button
                    style={s.exportMenuBtn}
                    onClick={() => {
                      exportSessionAsMarkdown(activeSession, messages);
                      setExportMenuOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--cv-bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Download Markdown
                  </button>
                </div>
              )}
            </div>
            {activeSession && (
              <span style={s.exportHint}>
                {activeSession.sessionId.slice(0, 8)}
              </span>
            )}
            <span style={s.connectionLabel}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            <div style={s.connectionDot(connected)} />
            <button
              style={s.themeToggleBtn}
              onClick={toggleTheme}
              title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle color theme"
            >
              {themeMode === 'dark' ? '☀️' : '\u{1F319}'}
            </button>
          </div>
        </div>
        <div style={s.tabContent}>
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
