// ============================================================
// Hook Receiver — POST endpoints for Claude Code hook events
// ============================================================

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HookEvent, SSEEvent, ParsedMessage, AgentInfo } from './types.js';
import { broadcast } from './sse.js';

const hooks = new Hono();

// --- Helpers ---

/**
 * Extract a normalized ParsedMessage from a hook event.
 * Hooks carry partial info; we build what we can.
 */
function hookToMessage(event: HookEvent, hookName: string): ParsedMessage {
  const now = new Date().toISOString();
  return {
    id: `hook-${event.session_id}-${hookName}-${Date.now()}`,
    parentId: null,
    type: event.tool_response !== undefined ? 'assistant' : 'user',
    timestamp: now,
    isSidechain: false,
    agentId: event.agent_id,
    toolCalls: event.tool_name
      ? [
          {
            id: event.tool_use_id ?? `tool-${Date.now()}`,
            name: event.tool_name,
            input: event.tool_input ?? {},
            result: event.tool_response,
            isError: event.is_error,
          },
        ]
      : undefined,
  };
}

/**
 * Generic hook handler: parse body, broadcast, respond immediately.
 */
function handleHook(hookName: string, toSSE: (event: HookEvent) => SSEEvent) {
  return async (c: Context) => {
    const event = await c.req.json<HookEvent>();
    const sseEvent = toSSE(event);
    broadcast(sseEvent);
    return c.json({ success: true });
  };
}

// --- Hook Endpoints ---

hooks.post('/hooks/pre-tool-use', handleHook('pre-tool-use', (event) => ({
  type: 'new_message',
  sessionId: event.session_id,
  message: {
    ...hookToMessage(event, 'pre-tool-use'),
    type: 'assistant',
    text: `[pre-tool-use] ${event.tool_name ?? 'unknown'}`,
    toolCalls: event.tool_name
      ? [
          {
            id: event.tool_use_id ?? `tool-${Date.now()}`,
            name: event.tool_name,
            input: event.tool_input ?? {},
          },
        ]
      : undefined,
  },
})));

hooks.post('/hooks/post-tool-use', handleHook('post-tool-use', (event) => ({
  type: 'new_message',
  sessionId: event.session_id,
  message: {
    ...hookToMessage(event, 'post-tool-use'),
    type: 'assistant',
    text: `[post-tool-use] ${event.tool_name ?? 'unknown'}`,
    toolCalls: event.tool_name
      ? [
          {
            id: event.tool_use_id ?? `tool-${Date.now()}`,
            name: event.tool_name,
            input: event.tool_input ?? {},
            result: event.tool_response,
            isError: event.is_error,
          },
        ]
      : undefined,
  },
})));

hooks.post('/hooks/subagent-start', handleHook('subagent-start', (event) => {
  const agent: AgentInfo = {
    agentId: event.agent_id ?? `agent-${Date.now()}`,
    agentType: event.agent_type ?? 'unknown',
    description: '',
    status: 'running',
    messageCount: 0,
    spawnedAt: new Date().toISOString(),
  };
  return {
    type: 'agent_spawned',
    sessionId: event.session_id,
    agent,
  };
}));

hooks.post('/hooks/subagent-stop', handleHook('subagent-stop', (event) => ({
  type: 'agent_completed',
  sessionId: event.session_id,
  agentId: event.agent_id ?? 'unknown',
})));

hooks.post('/hooks/task-created', handleHook('task-created', (event) => ({
  type: 'task_update',
  tasks: [
    {
      id: `task-${Date.now()}`,
      subject: 'New task',
      description: '',
      status: 'pending' as const,
      owner: event.agent_id,
      blocks: [],
      blockedBy: [],
    },
  ],
})));

hooks.post('/hooks/task-completed', handleHook('task-completed', (event) => ({
  type: 'task_update',
  tasks: [
    {
      id: `task-${Date.now()}`,
      subject: 'Task completed',
      description: '',
      status: 'completed' as const,
      owner: event.agent_id,
      blocks: [],
      blockedBy: [],
    },
  ],
})));

hooks.post('/hooks/stop', handleHook('stop', (event) => ({
  type: 'new_message',
  sessionId: event.session_id,
  message: {
    ...hookToMessage(event, 'stop'),
    type: 'system',
    subtype: 'stop',
    text: '[stop] Session turn stopped',
  },
})));

hooks.post('/hooks/session-start', handleHook('session-start', (event) => ({
  type: 'session_started',
  session: {
    sessionId: event.session_id,
    pid: 0,
    cwd: event.cwd,
    startedAt: Date.now(),
    kind: 'hook',
    entrypoint: '',
    isActive: true,
    messageCount: 0,
    agents: [],
  },
})));

hooks.post('/hooks/session-end', handleHook('session-end', (event) => ({
  type: 'session_ended',
  sessionId: event.session_id,
})));

hooks.post('/hooks/user-prompt', handleHook('user-prompt', (event) => ({
  type: 'new_message',
  sessionId: event.session_id,
  message: {
    ...hookToMessage(event, 'user-prompt'),
    type: 'user',
    userContent: '[user-prompt] Prompt submitted',
  },
})));

export default hooks;
