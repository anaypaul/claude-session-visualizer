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
      0%, 100% { border-left-color: #f59e0b; }
      50% { border-left-color: #b45309; }
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
  { key: 'pending', label: 'Pending', color: '#6b7280', icon: '\u25CB' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b', icon: '\u25D4' },
  { key: 'completed', label: 'Completed', color: '#22c55e', icon: '\u25CF' },
];

// --- Task card component ---

function TaskCard({ task }: { task: TaskInfo }) {
  const isInProgress = task.status === 'in_progress';

  const borderColor =
    task.status === 'pending'
      ? '#6b7280'
      : task.status === 'in_progress'
        ? '#f59e0b'
        : '#22c55e';

  return (
    <div
      style={{
        background: '#12121a',
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
          color: '#e0e0e8',
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
            color: '#8888a0',
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
            color: '#f59e0b',
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
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
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
              color: '#ef4444',
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
              color: '#f97316',
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
        background: '#0d0d15',
        borderRadius: 8,
        border: '1px solid #1a1a2e',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#12121a',
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
              color: '#e0e0e8',
            }}
          >
            {column.label}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#8888a0',
            background: '#1a1a2e',
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
              color: '#555',
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
          background: '#0a0a0f',
          color: '#8888a0',
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
        background: '#0a0a0f',
        overflow: 'hidden',
      }}
    >
      {COLUMNS.map((col) => (
        <TaskColumn key={col.key} column={col} tasks={grouped[col.key]} />
      ))}
    </div>
  );
}
