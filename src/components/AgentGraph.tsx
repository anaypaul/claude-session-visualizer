import React, { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  type ReactFlowInstance,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store';
import type { AgentInfo, ToolCallInfo, ParsedMessage } from '../types';

// ─── Tool color mapping ───────────────────────────────────────────

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
  Skill: '#ec4899',
};

function getToolColor(toolName: string): string {
  return TOOL_COLORS[toolName] ?? '#6b7280';
}

// ─── Utility: truncate tool input to a summary ───────────────────

function getToolInputSummary(toolName: string, input: Record<string, unknown>): string {
  if (!input) return '';
  const lowerName = toolName.toLowerCase();

  if (lowerName === 'bash' && typeof input.command === 'string') {
    return input.command;
  }
  if ((lowerName === 'read' || lowerName === 'write') && typeof input.file_path === 'string') {
    return input.file_path;
  }
  if (lowerName === 'edit' && typeof input.file_path === 'string') {
    return input.file_path;
  }
  if (lowerName === 'grep' && typeof input.pattern === 'string') {
    return input.pattern;
  }
  if (lowerName === 'glob' && typeof input.pattern === 'string') {
    return input.pattern;
  }
  if (lowerName === 'agent' && typeof input.prompt === 'string') {
    return input.prompt;
  }
  if (lowerName === 'skill' && typeof input.skill === 'string') {
    return input.skill;
  }
  if (lowerName === 'websearch' && typeof input.query === 'string') {
    return input.query;
  }
  if (lowerName === 'webfetch' && typeof input.url === 'string') {
    return input.url;
  }
  // Fallback: show first string value
  for (const val of Object.values(input)) {
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return '';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

// ─── Custom node: AgentNode (large, collapsible) ─────────────────

interface AgentNodeData {
  agent?: AgentInfo;
  isRoot: boolean;
  isRunning: boolean;
  messageCount: number;
  toolCallCount: number;
  isCollapsed: boolean;
  onToggleCollapse: (nodeId: string) => void;
  nodeId: string;
}

function AgentNode({ data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  const { agent, isRoot, isRunning, messageCount, toolCallCount, isCollapsed, onToggleCollapse, nodeId } = d;

  return (
    <div
      style={{
        background: '#1a1a2e',
        border: `1.5px solid ${isRunning ? '#4f46e5' : '#333'}`,
        borderRadius: 10,
        padding: '14px 18px',
        minWidth: 220,
        maxWidth: 260,
        boxShadow: isRunning
          ? '0 0 16px rgba(79, 70, 229, 0.3)'
          : '0 2px 10px rgba(0, 0, 0, 0.4)',
        cursor: toolCallCount > 0 ? 'pointer' : 'default',
        userSelect: 'none' as const,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (toolCallCount > 0) onToggleCollapse(nodeId);
      }}
    >
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#555', border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Header row: status + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isRunning ? '#22c55e' : '#6b7280',
              boxShadow: isRunning ? '0 0 6px #22c55e' : 'none',
              animation: isRunning ? 'agentPulse 2s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: isRunning ? '#a5b4fc' : '#8888a0', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            {isRunning ? 'Running' : 'Completed'}
          </span>
        </div>

        {(agent?.agentType || isRoot) && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              background: isRoot ? '#312e81' : '#1e293b',
              color: isRoot ? '#a5b4fc' : '#94a3b8',
              fontWeight: 500,
              border: `1px solid ${isRoot ? '#4338ca' : '#334155'}`,
            }}
          >
            {isRoot ? 'Main Session' : agent?.agentType ?? 'agent'}
          </span>
        )}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 13,
          color: '#e0e0e8',
          fontWeight: 500,
          lineHeight: 1.4,
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}
      >
        {isRoot ? 'Main Session' : agent?.description ?? 'Agent'}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#8888a0' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12 }}>&#9993;</span>
          <span>{messageCount} messages</span>
        </span>
        {toolCallCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
            <span>{toolCallCount} tool calls</span>
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555', border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
}

// ─── Custom node: ToolNode (small, compact) ──────────────────────

interface ToolNodeData {
  toolCall: ToolCallInfo;
  toolName: string;
  color: string;
  inputSummary: string;
  isError: boolean;
  isRunning: boolean;
}

function ToolNode({ data }: NodeProps) {
  const d = data as unknown as ToolNodeData;
  const { toolName, color, inputSummary, isError, isRunning } = d;

  return (
    <div
      style={{
        background: '#141422',
        border: `1.5px solid ${isError ? '#ef4444' : color}`,
        borderRadius: 6,
        padding: '6px 10px',
        width: 120,
        boxShadow: isError
          ? '0 0 8px rgba(239, 68, 68, 0.3)'
          : `0 1px 4px rgba(0, 0, 0, 0.3)`,
        opacity: isRunning ? 1 : 0.9,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, border: 'none', width: 6, height: 6 }}
      />

      {/* Tool name + status icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.02em' }}>
          {toolName}
        </span>
        {isError ? (
          <span style={{ fontSize: 11, color: '#ef4444' }} title="Error">{'\u2716'}</span>
        ) : (
          <span style={{ fontSize: 11, color: '#22c55e' }} title="Success">{'\u2714'}</span>
        )}
      </div>

      {/* Input summary */}
      {inputSummary && (
        <div
          style={{
            fontSize: 10,
            color: '#8888a0',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}
          title={inputSummary}
        >
          {truncate(inputSummary, 30)}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, border: 'none', width: 6, height: 6 }}
      />
    </div>
  );
}

// ─── Node types registry ─────────────────────────────────────────

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
  toolNode: ToolNode,
};

// ─── Gather tool calls per agent ─────────────────────────────────

function collectToolCallsByAgent(messages: ParsedMessage[]): Map<string, ToolCallInfo[]> {
  const map = new Map<string, ToolCallInfo[]>();

  for (const msg of messages) {
    if (msg.type !== 'assistant' || !msg.toolCalls || msg.toolCalls.length === 0) continue;
    const key = msg.agentId ?? '__main__';
    const existing = map.get(key) ?? [];
    existing.push(...msg.toolCalls);
    map.set(key, existing);
  }

  return map;
}

// ─── Build tree (agents only) ────────────────────────────────────

interface TreeNode {
  id: string;
  agent?: AgentInfo;
  children: TreeNode[];
}

function buildAgentTree(agents: AgentInfo[]): TreeNode {
  const root: TreeNode = { id: 'root', children: [] };
  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set('root', root);

  for (const agent of agents) {
    nodeMap.set(agent.agentId, { id: agent.agentId, agent, children: [] });
  }

  for (const agent of agents) {
    const parentId = agent.parentAgentId ?? 'root';
    const parent = nodeMap.get(parentId) ?? root;
    const child = nodeMap.get(agent.agentId)!;
    parent.children.push(child);
  }

  return root;
}

// ─── Layout engine ───────────────────────────────────────────────

const AGENT_LEVEL_GAP = 200;
const AGENT_SIBLING_GAP = 300;
const TOOL_Y_OFFSET = 80;
const TOOL_Y_GAP = 52;
const TOOL_X_CENTER_OFFSET = -60; // center 120px tool node under ~240px agent

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function layoutFullTree(
  agentTree: TreeNode,
  agents: AgentInfo[],
  toolCallsByAgent: Map<string, ToolCallInfo[]>,
  collapsedSet: Set<string>,
  mainMessageCount: number,
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Compute subtree width for horizontal spacing
  function subtreeWidth(node: TreeNode): number {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, c) => sum + subtreeWidth(c), 0);
  }

  function layoutAgent(node: TreeNode, depth: number, xOffset: number): number {
    const width = subtreeWidth(node);
    const nodeX = xOffset + (width * AGENT_SIBLING_GAP) / 2 - AGENT_SIBLING_GAP / 2;
    const isRoot = node.id === 'root';
    const agentKey = isRoot ? '__main__' : node.id;
    const isRunning = isRoot
      ? agents.some((a) => a.status === 'running')
      : node.agent?.status === 'running';
    const calls = toolCallsByAgent.get(agentKey) ?? [];
    const isCollapsed = collapsedSet.has(agentKey);

    // Compute cumulative Y offset from all ancestor tool chains
    // We use depth * AGENT_LEVEL_GAP as base, then add tool chain heights
    // For simplicity, compute Y purely from depth + tool chain of this agent
    const baseY = depth * AGENT_LEVEL_GAP;

    nodes.push({
      id: node.id,
      type: 'agentNode',
      position: { x: nodeX, y: baseY },
      data: {
        agent: node.agent,
        isRoot,
        isRunning: !!isRunning,
        messageCount: isRoot ? mainMessageCount : (node.agent?.messageCount ?? 0),
        toolCallCount: calls.length,
        isCollapsed,
        onToggleCollapse: () => {}, // placeholder, replaced externally
        nodeId: node.id,
      } satisfies AgentNodeData,
    });

    // Tool call nodes (if not collapsed)
    if (!isCollapsed && calls.length > 0) {
      let prevToolId: string | null = null;
      calls.forEach((tc, i) => {
        const toolId = `tool-${agentKey}-${i}`;
        const toolColor = getToolColor(tc.name);
        const summary = getToolInputSummary(tc.name, tc.input);
        const toolIsRunning = tc.result === undefined && !tc.isError;

        nodes.push({
          id: toolId,
          type: 'toolNode',
          position: { x: nodeX + TOOL_X_CENTER_OFFSET, y: baseY + TOOL_Y_OFFSET + i * TOOL_Y_GAP },
          data: {
            toolCall: tc,
            toolName: tc.name,
            color: toolColor,
            inputSummary: summary,
            isError: !!tc.isError,
            isRunning: toolIsRunning,
          } satisfies ToolNodeData,
        });

        if (i === 0) {
          // Edge from agent to first tool call
          edges.push({
            id: `e-${node.id}-${toolId}`,
            source: node.id,
            target: toolId,
            type: 'default',
            animated: toolIsRunning,
            style: {
              stroke: tc.isError ? '#ef4444' : toolColor,
              strokeWidth: 1.5,
              strokeDasharray: toolIsRunning ? '4 3' : 'none',
              opacity: 0.7,
            },
          });
        } else if (prevToolId) {
          // Edge from previous tool to this tool
          const prevTc = calls[i - 1];
          edges.push({
            id: `e-${prevToolId}-${toolId}`,
            source: prevToolId,
            target: toolId,
            type: 'default',
            animated: toolIsRunning,
            style: {
              stroke: tc.isError ? '#ef4444' : '#444',
              strokeWidth: 1,
              strokeDasharray: toolIsRunning ? '4 3' : 'none',
              opacity: 0.6,
            },
          });
        }
        prevToolId = toolId;
      });
    }

    // Layout children agents
    // Compute the Y level for children: base Y + agent height + tool chain height + gap
    const childDepthGap = isCollapsed
      ? 1
      : 1 + Math.ceil((calls.length * TOOL_Y_GAP) / AGENT_LEVEL_GAP);

    let childXOffset = xOffset;
    for (const child of node.children) {
      const childWidth = subtreeWidth(child);
      const childIsRunning = child.agent?.status === 'running';

      edges.push({
        id: `e-agent-${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'default',
        animated: !!childIsRunning,
        style: {
          stroke: childIsRunning ? '#4f46e5' : '#444',
          strokeWidth: 2,
          strokeDasharray: childIsRunning ? '5 5' : 'none',
        },
      });

      layoutAgent(child, depth + childDepthGap, childXOffset);
      childXOffset += childWidth * AGENT_SIBLING_GAP;
    }

    return width;
  }

  layoutAgent(agentTree, 0, 0);
  return { nodes, edges };
}

// ─── Inject keyframes ────────────────────────────────────────────

const STYLE_ID = 'agent-graph-keyframes';

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes agentPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Main component ──────────────────────────────────────────────

export function AgentGraph() {
  ensureKeyframes();

  const agents = useStore((s) => s.agents);
  const messages = useStore((s) => s.messages);

  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() => new Set(['__main__']));
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const mainMessageCount = useMemo(
    () => messages.filter((m) => !m.agentId).length,
    [messages],
  );

  const toolCallsByAgent = useMemo(() => collectToolCallsByAgent(messages), [messages]);

  // Check if there is any data at all
  const hasToolCalls = useMemo(() => {
    for (const calls of toolCallsByAgent.values()) {
      if (calls.length > 0) return true;
    }
    return false;
  }, [toolCallsByAgent]);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      const agentKey = nodeId === 'root' ? '__main__' : nodeId;
      if (next.has(agentKey)) {
        next.delete(agentKey);
      } else {
        next.add(agentKey);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedSet(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    const allKeys = new Set<string>(['__main__']);
    for (const agent of agents) {
      allKeys.add(agent.agentId);
    }
    setCollapsedSet(allKeys);
  }, [agents]);

  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.15, duration: 300 });
    }
  }, [rfInstance]);

  const { nodes, edges } = useMemo(() => {
    // Always show at least the root if we have any tool calls
    const tree = buildAgentTree(agents);
    const result = layoutFullTree(tree, agents, toolCallsByAgent, collapsedSet, mainMessageCount);

    // Inject the real toggle callback into agent nodes
    for (const node of result.nodes) {
      if (node.type === 'agentNode') {
        (node.data as unknown as AgentNodeData).onToggleCollapse = toggleCollapse;
      }
    }

    return result;
  }, [agents, toolCallsByAgent, collapsedSet, mainMessageCount, toggleCollapse]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
    setTimeout(() => instance.fitView({ padding: 0.15 }), 80);
  }, []);

  // Empty state
  if (agents.length === 0 && !hasToolCalls) {
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
        No execution data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f', position: 'relative' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          gap: 6,
        }}
      >
        <ToolbarButton label="Expand All" onClick={expandAll} />
        <ToolbarButton label="Collapse All" onClick={collapseAll} />
        <ToolbarButton label="Fit View" onClick={handleFitView} />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0a0f' }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.15}
        maxZoom={2.5}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1a1a2e"
        />
        <MiniMap
          nodeStrokeColor={(n: Node) => {
            if (n.type === 'toolNode') {
              const td = n.data as unknown as ToolNodeData;
              return td.isError ? '#ef4444' : td.color;
            }
            return '#333';
          }}
          nodeColor={(n: Node) => {
            if (n.type === 'toolNode') {
              const td = n.data as unknown as ToolNodeData;
              return td.color + '33'; // with alpha
            }
            return '#1a1a2e';
          }}
          nodeBorderRadius={4}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{
            background: '#0d0d15',
            border: '1px solid #222',
            borderRadius: 4,
          }}
        />
        <Controls
          showInteractive={false}
          style={{
            background: '#12121a',
            border: '1px solid #333',
            borderRadius: 4,
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── Toolbar button ──────────────────────────────────────────────

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 6,
        color: '#c0c0d0',
        fontSize: 11,
        fontWeight: 500,
        padding: '5px 10px',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#252540';
        e.currentTarget.style.borderColor = '#555';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#1a1a2e';
        e.currentTarget.style.borderColor = '#333';
      }}
    >
      {label}
    </button>
  );
}

// AgentGraph is already exported as a named export above
