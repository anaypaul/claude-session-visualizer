// ============================================================
// Frontend types — mirrored from server/types.ts
// ============================================================

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  service_tier?: string;
  server_tool_use?: {
    web_search_requests?: number;
    web_fetch_requests?: number;
  };
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  durationMs?: number;
}

export interface ParsedMessage {
  id: string;
  parentId: string | null;
  type: 'user' | 'assistant' | 'system' | 'progress';
  timestamp: string;
  isSidechain: boolean;
  agentId?: string;

  // User message fields
  userContent?: string;
  isToolResult?: boolean;
  toolUseId?: string;
  isError?: boolean;

  // Assistant message fields
  model?: string;
  apiMessageId?: string;
  thinking?: string;
  text?: string;
  toolCalls?: ToolCallInfo[];
  stopReason?: string;
  usage?: UsageData;

  // System message fields
  subtype?: string;
  durationMs?: number;
}

export interface AgentInfo {
  agentId: string;
  agentType: string;
  description: string;
  parentAgentId?: string;
  status: 'running' | 'completed';
  messageCount: number;
  spawnedAt: string;
}

export interface SessionInfo {
  sessionId: string;
  pid: number;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  isActive: boolean;
  messageCount: number;
  agents: AgentInfo[];
}

export interface TaskInfo {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  owner?: string;
  blocks: string[];
  blockedBy: string[];
  activeForm?: string;
}

export type SSEEvent =
  | { type: 'session_list'; sessions: SessionInfo[] }
  | { type: 'session_started'; session: SessionInfo }
  | { type: 'session_ended'; sessionId: string }
  | { type: 'initial_state'; sessionId: string; messages: ParsedMessage[] }
  | { type: 'new_message'; sessionId: string; message: ParsedMessage }
  | { type: 'agent_spawned'; sessionId: string; agent: AgentInfo }
  | { type: 'agent_message'; sessionId: string; agentId: string; message: ParsedMessage }
  | { type: 'agent_completed'; sessionId: string; agentId: string }
  | { type: 'task_update'; tasks: TaskInfo[] };
