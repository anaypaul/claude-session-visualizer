import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store';

// --- Helpers ---

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// --- Metric row component ---

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 0',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#8888a0' }}>{label}</span>
      <span
        style={{
          color: color ?? '#e0e0e8',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// --- Custom tooltip for bar chart ---

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string } }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 11,
        color: '#e0e0e8',
      }}
    >
      <span style={{ color: '#8888a0' }}>{payload[0].payload.name}: </span>
      <span style={{ fontWeight: 600 }}>{payload[0].value}</span>
    </div>
  );
}

// --- Main component ---

export function MetricsPanel() {
  const messages = useStore((s) => s.messages);
  const agents = useStore((s) => s.agents);

  const metrics = useMemo(() => {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let userCount = 0;
    let assistantCount = 0;
    const toolCallCounts = new Map<string, number>();
    let firstTimestamp: string | null = null;

    for (const msg of messages) {
      // Track first timestamp
      if (!firstTimestamp || msg.timestamp < firstTimestamp) {
        firstTimestamp = msg.timestamp;
      }

      // Count by type
      if (msg.type === 'user') userCount++;
      if (msg.type === 'assistant') assistantCount++;

      // Aggregate usage
      if (msg.usage) {
        totalInputTokens += msg.usage.input_tokens;
        totalOutputTokens += msg.usage.output_tokens;
        cacheReadTokens += msg.usage.cache_read_input_tokens;
        cacheCreationTokens += msg.usage.cache_creation_input_tokens;
      }

      // Count tool calls
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          toolCallCounts.set(tc.name, (toolCallCounts.get(tc.name) ?? 0) + 1);
        }
      }
    }

    const totalTokens = totalInputTokens + totalOutputTokens;
    const cacheEfficiency =
      totalInputTokens > 0
        ? Math.round((cacheReadTokens / totalInputTokens) * 100)
        : 0;

    // Top 5 tool calls
    const topTools = Array.from(toolCallCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const totalToolCalls = Array.from(toolCallCounts.values()).reduce(
      (sum, c) => sum + c,
      0
    );

    // Session duration
    let durationMs = 0;
    if (firstTimestamp) {
      durationMs = Date.now() - new Date(firstTimestamp).getTime();
    }

    const activeAgents = agents.filter((a) => a.status === 'running').length;

    return {
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      cacheEfficiency,
      cacheReadTokens,
      cacheCreationTokens,
      userCount,
      assistantCount,
      topTools,
      totalToolCalls,
      durationMs,
      activeAgents,
    };
  }, [messages, agents]);

  return (
    <div
      style={{
        width: '100%',
        background: '#12121a',
        borderTop: '1px solid #1a1a2e',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#8888a0',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 2,
        }}
      >
        Metrics
      </div>

      {/* Token metrics */}
      <MetricRow label="Total tokens" value={formatNumber(metrics.totalTokens)} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#6b7280',
          paddingLeft: 8,
        }}
      >
        <span>In: {formatNumber(metrics.totalInputTokens)}</span>
        <span>Out: {formatNumber(metrics.totalOutputTokens)}</span>
      </div>

      {/* Cache efficiency */}
      <div style={{ padding: '2px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
          }}
        >
          <span style={{ color: '#8888a0' }}>Cache efficiency</span>
          <span
            style={{
              color:
                metrics.cacheEfficiency > 70
                  ? '#22c55e'
                  : metrics.cacheEfficiency > 30
                    ? '#f59e0b'
                    : '#ef4444',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {metrics.cacheEfficiency}%
          </span>
        </div>
        {/* Mini progress bar */}
        <div
          style={{
            height: 3,
            background: '#1a1a2e',
            borderRadius: 2,
            marginTop: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${metrics.cacheEfficiency}%`,
              background:
                metrics.cacheEfficiency > 70
                  ? '#22c55e'
                  : metrics.cacheEfficiency > 30
                    ? '#f59e0b'
                    : '#ef4444',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1a1a2e', margin: '2px 0' }} />

      {/* Messages */}
      <MetricRow
        label="Messages"
        value={`${metrics.userCount}U / ${metrics.assistantCount}A`}
      />

      {/* Active agents */}
      <MetricRow
        label="Active agents"
        value={metrics.activeAgents}
        color={metrics.activeAgents > 0 ? '#22c55e' : '#8888a0'}
      />

      {/* Session duration */}
      <MetricRow
        label="Duration"
        value={metrics.durationMs > 0 ? formatDuration(metrics.durationMs) : '--'}
      />

      {/* Divider */}
      <div style={{ height: 1, background: '#1a1a2e', margin: '2px 0' }} />

      {/* Tool calls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
        }}
      >
        <span style={{ color: '#8888a0' }}>Tool calls</span>
        <span style={{ color: '#e0e0e8', fontWeight: 600 }}>
          {metrics.totalToolCalls}
        </span>
      </div>

      {/* Tool distribution bar chart */}
      {metrics.topTools.length > 0 && (
        <div style={{ width: '100%', height: 60, marginTop: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metrics.topTools}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={(name: string) =>
                  name.length > 8 ? name.slice(0, 7) + '\u2026' : name
                }
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="count"
                fill="#4f46e5"
                radius={[2, 2, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
