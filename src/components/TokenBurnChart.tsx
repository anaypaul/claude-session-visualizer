import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store';
import type { ParsedMessage } from '../types';

// --- Pricing per million tokens ---

interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheCreation: 15,
  },
  'claude-sonnet-4-6': {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheCreation: 3,
  },
};

// Fallback to Sonnet pricing when model is unknown
const DEFAULT_PRICING: ModelPricing = PRICING['claude-sonnet-4-6'];

function getPricing(model?: string): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  // Match against known model prefixes (e.g. "claude-opus-4-6-20260301")
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key)) return PRICING[key];
  }
  return DEFAULT_PRICING;
}

// --- Formatting helpers ---

function formatTokenAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function formatTokenValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatCost(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

// --- Data point shape ---

interface CumulativeDataPoint {
  index: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost: number;
}

// --- Custom tooltip ---

function BurnTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  // Find the cost from the first payload entry's parent data point
  const dataPoint = (payload[0] as any)?.payload as CumulativeDataPoint | undefined;

  return (
    <div
      style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#e0e0e8',
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 6,
          color: '#8888a0',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Turn {label}
      </div>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '2px 0',
            gap: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#aaa' }}>{entry.name}</span>
          </span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatTokenValue(entry.value)}
          </span>
        </div>
      ))}
      {dataPoint && (
        <div
          style={{
            borderTop: '1px solid #333',
            marginTop: 6,
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
          }}
        >
          <span style={{ color: '#8888a0' }}>Cost</span>
          <span style={{ color: '#22c55e' }}>{formatCost(dataPoint.cost)}</span>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export function TokenBurnChart(): React.ReactElement {
  const messages = useStore((s) => s.messages);

  const { data, totalCost } = useMemo(() => {
    // Filter to assistant messages with usage data
    const assistantMsgs: ParsedMessage[] = messages.filter(
      (m) => m.type === 'assistant' && m.usage
    );

    if (assistantMsgs.length === 0) {
      return { data: [] as CumulativeDataPoint[], totalCost: 0 };
    }

    let cumInput = 0;
    let cumOutput = 0;
    let cumCacheRead = 0;
    let cumCacheCreation = 0;
    let cumCost = 0;

    const points: CumulativeDataPoint[] = assistantMsgs.map((msg, i) => {
      const u = msg.usage!;
      const pricing = getPricing(msg.model);

      cumInput += u.input_tokens;
      cumOutput += u.output_tokens;
      cumCacheRead += u.cache_read_input_tokens;
      cumCacheCreation += u.cache_creation_input_tokens;

      // Cost for this turn
      const turnCost =
        (u.input_tokens / 1_000_000) * pricing.input +
        (u.output_tokens / 1_000_000) * pricing.output +
        (u.cache_read_input_tokens / 1_000_000) * pricing.cacheRead +
        (u.cache_creation_input_tokens / 1_000_000) * pricing.cacheCreation;

      cumCost += turnCost;

      return {
        index: i + 1,
        input_tokens: cumInput,
        output_tokens: cumOutput,
        cache_read_input_tokens: cumCacheRead,
        cache_creation_input_tokens: cumCacheCreation,
        cost: cumCost,
      };
    });

    return { data: points, totalCost: cumCost };
  }, [messages]);

  // Empty state
  if (data.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          color: '#555',
          fontSize: 13,
          fontStyle: 'italic',
        }}
      >
        No token data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Floating cost badge */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 16,
          zIndex: 10,
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 13,
          fontWeight: 700,
          color: '#22c55e',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
      >
        {formatCost(totalCost)}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 16, right: 16, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id="grad-input" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="grad-output" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="grad-cache-read" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="grad-cache-create" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="index"
            tick={{ fontSize: 11, fill: '#888' }}
            tickLine={false}
            axisLine={{ stroke: '#222' }}
            label={{
              value: 'Turn',
              position: 'insideBottomRight',
              offset: -4,
              style: { fontSize: 10, fill: '#666' },
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#888' }}
            tickLine={false}
            axisLine={{ stroke: '#222' }}
            tickFormatter={formatTokenAxis}
            width={52}
          />

          <Tooltip content={<BurnTooltip />} />

          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, color: '#888' }}
            formatter={(value: string) => (
              <span style={{ color: '#888' }}>{value}</span>
            )}
          />

          {/* Render areas bottom-to-top in stacked order */}
          <Area
            type="monotone"
            dataKey="cache_creation_input_tokens"
            name="Cache Creation"
            stackId="tokens"
            stroke="#f59e0b"
            strokeWidth={1.5}
            fill="url(#grad-cache-create)"
          />
          <Area
            type="monotone"
            dataKey="cache_read_input_tokens"
            name="Cache Read"
            stackId="tokens"
            stroke="#06b6d4"
            strokeWidth={1.5}
            fill="url(#grad-cache-read)"
          />
          <Area
            type="monotone"
            dataKey="output_tokens"
            name="Output"
            stackId="tokens"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#grad-output)"
          />
          <Area
            type="monotone"
            dataKey="input_tokens"
            name="Input"
            stackId="tokens"
            stroke="#3b82f6"
            strokeWidth={1.5}
            fill="url(#grad-input)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
