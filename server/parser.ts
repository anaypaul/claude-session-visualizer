// ============================================================
// JSONL Parser — Parses Claude Code JSONL lines into normalized messages
// ============================================================

import fs from 'node:fs/promises';
import type {
  RawMessageEnvelope,
  RawUserMessage,
  RawAssistantMessage,
  RawSystemMessage,
  RawProgressMessage,
  RawContentBlock,
  RawAssistantContentBlock,
  ParsedMessage,
} from './types.js';

const MAX_CONTENT_LENGTH = 10_000;

// Types we skip entirely — they carry no displayable conversation data
const SKIP_TYPES = new Set(['file-history-snapshot', 'queue-operation', 'last-prompt']);

/**
 * Parse a single JSONL line into a ParsedMessage.
 * Returns null for skippable types, empty lines, or malformed JSON.
 */
export function parseLine(line: string): ParsedMessage | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;

  let raw: RawMessageEnvelope;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    console.warn('[parser] Malformed JSON line, skipping:', trimmed.slice(0, 120));
    return null;
  }

  if (!raw || typeof raw !== 'object' || !raw.type) return null;
  if (SKIP_TYPES.has(raw.type)) return null;

  switch (raw.type) {
    case 'user':
      return parseUserMessage(raw as RawUserMessage);
    case 'assistant':
      return parseAssistantMessage(raw as RawAssistantMessage);
    case 'system':
      return parseSystemMessage(raw as RawSystemMessage);
    case 'progress':
      return parseProgressMessage(raw as RawProgressMessage);
    default:
      return null;
  }
}

/**
 * Parse an entire JSONL file, grouping assistant messages that share the same
 * message.id into single merged ParsedMessages.
 */
export async function parseJsonlFile(filePath: string): Promise<ParsedMessage[]> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[parser] Could not read file ${filePath}:`, err);
    return [];
  }

  const lines = content.split('\n');
  const messages: ParsedMessage[] = [];
  // Map from API message ID to the in-progress merged ParsedMessage for grouping
  const assistantGroupMap = new Map<string, ParsedMessage>();

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    if (parsed.type === 'assistant' && parsed.apiMessageId) {
      const existing = assistantGroupMap.get(parsed.apiMessageId);
      if (existing) {
        mergeAssistantMessage(existing, parsed);
      } else {
        assistantGroupMap.set(parsed.apiMessageId, parsed);
        messages.push(parsed);
      }
    } else {
      messages.push(parsed);
    }
  }

  return messages;
}

// --- Private helpers ---

function parseUserMessage(raw: RawUserMessage): ParsedMessage {
  const msg: ParsedMessage = {
    id: raw.uuid,
    parentId: raw.parentUuid ?? null,
    type: 'user',
    timestamp: raw.timestamp,
    isSidechain: raw.isSidechain,
    agentId: raw.agentId,
  };

  const content = raw.message?.content;
  if (typeof content === 'string') {
    msg.userContent = truncate(content);
  } else if (Array.isArray(content)) {
    // Look for tool_result blocks or text blocks
    const toolResult = content.find(
      (b): b is Extract<RawContentBlock, { type: 'tool_result' }> => b.type === 'tool_result'
    );
    if (toolResult) {
      msg.isToolResult = true;
      msg.toolUseId = toolResult.tool_use_id;
      msg.isError = toolResult.is_error ?? false;
      msg.userContent = truncate(extractToolResultContent(toolResult.content));
    } else {
      // Concatenate text blocks
      const textParts = content
        .filter((b): b is Extract<RawContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text);
      msg.userContent = truncate(textParts.join('\n'));
    }
  }

  return msg;
}

function parseAssistantMessage(raw: RawAssistantMessage): ParsedMessage {
  const apiMsg = raw.message;
  const msg: ParsedMessage = {
    id: raw.uuid,
    parentId: raw.parentUuid ?? null,
    type: 'assistant',
    timestamp: raw.timestamp,
    isSidechain: raw.isSidechain,
    agentId: raw.agentId,
    model: apiMsg?.model,
    apiMessageId: apiMsg?.id,
    stopReason: apiMsg?.stop_reason ?? undefined,
    usage: apiMsg?.usage,
  };

  if (apiMsg?.content && Array.isArray(apiMsg.content)) {
    extractAssistantContent(apiMsg.content, msg);
  }

  return msg;
}

function parseSystemMessage(raw: RawSystemMessage): ParsedMessage {
  return {
    id: raw.uuid,
    parentId: raw.parentUuid ?? null,
    type: 'system',
    timestamp: raw.timestamp,
    isSidechain: raw.isSidechain,
    agentId: raw.agentId,
    subtype: raw.subtype,
    durationMs: raw.durationMs,
  };
}

function parseProgressMessage(raw: RawProgressMessage): ParsedMessage {
  const msg: ParsedMessage = {
    id: raw.uuid,
    parentId: raw.parentUuid ?? null,
    type: 'progress',
    timestamp: raw.timestamp,
    isSidechain: raw.isSidechain,
    agentId: raw.agentId,
  };

  if (raw.data?.message?.content) {
    msg.userContent = truncate(raw.data.message.content);
  }

  return msg;
}

/**
 * Extract thinking, text, and tool_use blocks from assistant content
 * and populate the ParsedMessage fields.
 */
function extractAssistantContent(
  blocks: RawAssistantContentBlock[],
  msg: ParsedMessage
): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'thinking':
        // Append thinking (multiple thinking blocks are concatenated)
        msg.thinking = msg.thinking
          ? msg.thinking + '\n' + block.thinking
          : block.thinking;
        break;

      case 'text':
        // Append text blocks
        msg.text = msg.text
          ? msg.text + '\n' + block.text
          : block.text;
        break;

      case 'tool_use':
        if (!msg.toolCalls) msg.toolCalls = [];
        msg.toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
        break;
    }
  }
}

/**
 * Merge a new assistant ParsedMessage into an existing one that shares
 * the same API message.id. Accumulates thinking, text, and tool_use blocks.
 */
function mergeAssistantMessage(existing: ParsedMessage, incoming: ParsedMessage): void {
  // Merge thinking
  if (incoming.thinking) {
    existing.thinking = existing.thinking
      ? existing.thinking + '\n' + incoming.thinking
      : incoming.thinking;
  }

  // Merge text
  if (incoming.text) {
    existing.text = existing.text
      ? existing.text + '\n' + incoming.text
      : incoming.text;
  }

  // Merge tool calls
  if (incoming.toolCalls) {
    if (!existing.toolCalls) existing.toolCalls = [];
    existing.toolCalls.push(...incoming.toolCalls);
  }

  // Update stop reason when the final chunk arrives
  if (incoming.stopReason) {
    existing.stopReason = incoming.stopReason;
  }

  // Accumulate usage from the last chunk (which has final totals)
  if (incoming.usage) {
    existing.usage = incoming.usage;
  }
}

/**
 * Extract displayable text from a tool_result's content field,
 * which can be a string or array of content blocks.
 */
function extractToolResultContent(
  content: string | RawContentBlock[] | undefined
): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (b.type === 'text') return b.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/**
 * Truncate content to MAX_CONTENT_LENGTH characters for display.
 */
function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_LENGTH) return text;
  return text.slice(0, MAX_CONTENT_LENGTH) + '\n... [truncated]';
}
