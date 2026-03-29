// ============================================================
// SHARED TYPES — Contract between all modules
// ============================================================

// --- Raw JSONL Schema (as stored on disk) ---

export interface RawMessageEnvelope {
  type: 'user' | 'assistant' | 'system' | 'progress' | 'file-history-snapshot' | 'queue-operation' | 'last-prompt';
  uuid: string;
  parentUuid: string | null;
  isSidechain: boolean;
  timestamp: string;
  sessionId: string;
  version: string;
  cwd: string;
  entrypoint: string;
  gitBranch?: string;
  userType?: string;
  agentId?: string;
  promptId?: string;
}

export interface RawUserMessage extends RawMessageEnvelope {
  type: 'user';
  message: {
    role: 'user';
    content: string | RawContentBlock[];
  };
  isMeta?: boolean;
  sourceToolAssistantUUID?: string;
  toolUseResult?: {
    isAsync: boolean;
    status: string;
    agentId: string;
    description: string;
    prompt: string;
    outputFile: string;
  };
}

export interface RawAssistantMessage extends RawMessageEnvelope {
  type: 'assistant';
  requestId: string;
  message: {
    model: string;
    id: string;
    type: 'message';
    role: 'assistant';
    content: RawAssistantContentBlock[];
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: UsageData;
  };
}

export interface RawSystemMessage extends RawMessageEnvelope {
  type: 'system';
  subtype?: 'turn_duration' | 'stop_hook_summary' | 'informational';
  durationMs?: number;
  messageCount?: number;
}

export interface RawProgressMessage extends RawMessageEnvelope {
  type: 'progress';
  toolUseID?: string;
  parentToolUseID?: string;
  data?: {
    type: string;
    message?: { role: string; content: string };
  };
}

export type RawContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string | RawContentBlock[]; is_error?: boolean };

export type RawAssistantContentBlock =
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown>; caller?: { type: string } };

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

// --- Normalized types (sent to frontend) ---

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

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
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

// --- SSE Event Types (server → client) ---

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

// --- Hook Event Types (received from Claude Code) ---

export interface HookEvent {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: string;
  tool_use_id?: string;
  is_error?: boolean;
}
