import React, { useMemo } from 'react';
import { useStore } from '../store';
import type { TaskInfo } from '../types';

// --- Style injection for animations ---

const STYLE_ID = 'task-board-keyframes';

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes taskPulse {
      0%, 100% { border-left-color: var(--cv-status-warning); }
      50% { border-left-color: var(--cv-status-warning-strong); }
    }
  `;
  document.head.appendChild(style);
}

// --- Column definitions ---

interface ColumnDef {
  key: TaskInfo['status'];
  label: string;
  color: string;
  icon: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'pending', label: 'Pending', color: 'var(--cv-text-dim)', icon: '\u25CB' },
  { key: 'in_progress', label: 'In Progress', color: 'var(--cv-status-warning)', icon: '\u25D4' },
  { key: 'completed', label: 'Completed', color: 'var(--cv-status-success)', icon: '\u25CF' },
];

// --- Task card component ---

function TaskCard({ task }: { task: TaskInfo }) {
  const isInProgress = task.status === 'in_progress';

  const borderColor =
    task.status === 'pending'
      ? 'var(--cv-text-dim)'
      : task.status === 'in_progress'
        ? 'var(--cv-status-warning)'
        : 'var(--cv-status-success)';

  return (
    <div
      style={{
        background: 'var(--cv-bg-panel)',
        borderRadius: 6,
        borderLeft: `3px solid ${borderColor}`,
        padding: '10px 12px',
        marginBottom: 8,
        animation: isInProgress ? 'taskPulse 2s ease-in-out infinite' : 'none',
        transition: 'box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 2px 12px rgba(0, 0, 0, 0.4)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Subject */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--cv-text-primary)',
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {task.subject}
      </div>

      {/* Description (2 lines max) */}
      {task.description && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--cv-text-muted)',
            lineHeight: 1.4,
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {task.description}
        </div>
      )}

      {/* Active form (in-progress only) */}
      {isInProgress && task.activeForm && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--cv-status-warning)',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: 4,
            padding: '3px 6px',
            marginBottom: 6,
            display: 'inline-block',
          }}
        >
          {task.activeForm}
        </div>
      )}

      {/* Bottom row: owner + dependencies */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {/* Owner badge */}
        {task.owner && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 8,
              background: 'var(--cv-bg-owner-badge)',
              color: 'var(--cv-text-owner-badge)',
              border: '1px solid var(--cv-border-owner-badge)',
              fontWeight: 500,
            }}
          >
            {task.owner}
          </span>
        )}

        {/* Blocked by */}
        {task.blockedBy.length > 0 && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--cv-status-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11 }}>{'\u26D4'}</span>
            Blocked by:{' '}
            {task.blockedBy.map((id) => `#${id}`).join(', ')}
          </span>
        )}

        {/* Blocks */}
        {task.blocks.length > 0 && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--cv-status-orange)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11 }}>{'\u26A0'}</span>
            Blocks: {task.blocks.map((id) => `#${id}`).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Column component ---

function TaskColumn({ column, tasks }: { column: ColumnDef; tasks: TaskInfo[] }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cv-bg-inset)',
        borderRadius: 8,
        border: '1px solid var(--cv-bg-elevated)',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--cv-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--cv-bg-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              color: column.color,
              fontSize: 12,
            }}
          >
            {column.icon}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cv-text-primary)',
            }}
          >
            {column.label}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--cv-text-muted)',
            background: 'var(--cv-bg-elevated)',
            padding: '1px 7px',
            borderRadius: 10,
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
        }}
      >
        {tasks.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--cv-text-subtle)',
              textAlign: 'center',
              padding: '20px 8px',
              fontStyle: 'italic',
            }}
          >
            No tasks
          </div>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

// --- Main component ---

export function TaskBoard() {
  ensureKeyframes();

  const tasks = useStore((s) => s.tasks);

  const grouped = useMemo(() => {
    const result: Record<TaskInfo['status'], TaskInfo[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    };
    for (const task of tasks) {
      result[task.status].push(task);
    }
    return result;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cv-bg-canvas)',
          color: 'var(--cv-text-muted)',
          fontSize: 14,
          fontStyle: 'italic',
        }}
      >
        No tasks created yet
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        gap: 10,
        padding: 12,
        background: 'var(--cv-bg-canvas)',
        overflow: 'hidden',
      }}
    >
      {COLUMNS.map((col) => (
        <TaskColumn key={col.key} column={col} tasks={grouped[col.key]} />
      ))}
    </div>
  );
}
