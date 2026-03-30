import type { ParsedMessage } from '../types';

// ---- Filter types ----

export interface MessageFilter {
  searchQuery: string;
  showUser: boolean;
  showAssistant: boolean;
  showSystem: boolean;
  showSidechains: boolean;
  errorsOnly: boolean;
  agentId: string | null; // null = all agents
}

export const DEFAULT_FILTER: MessageFilter = {
  searchQuery: '',
  showUser: true,
  showAssistant: true,
  showSystem: true,
  showSidechains: true,
  errorsOnly: false,
  agentId: null,
};

// ---- Search matching ----

/**
 * Returns true if any searchable field in the message matches the query
 * (case-insensitive). Searches across: userContent, text, thinking,
 * toolCalls[].name, and toolCalls[].input (JSON stringified).
 */
export function matchesSearch(message: ParsedMessage, query: string): boolean {
  if (!query) return true;

  const lower = query.toLowerCase();

  if (message.userContent && message.userContent.toLowerCase().includes(lower)) {
    return true;
  }

  if (message.text && message.text.toLowerCase().includes(lower)) {
    return true;
  }

  if (message.thinking && message.thinking.toLowerCase().includes(lower)) {
    return true;
  }

  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      if (tc.name.toLowerCase().includes(lower)) {
        return true;
      }
      try {
        const inputStr = JSON.stringify(tc.input);
        if (inputStr.toLowerCase().includes(lower)) {
          return true;
        }
      } catch {
        // skip unparseable input
      }
      if (tc.result && tc.result.toLowerCase().includes(lower)) {
        return true;
      }
    }
  }

  return false;
}

// ---- Filter application ----

/**
 * Applies all active filters to a message array and returns the subset
 * that passes every enabled filter criterion.
 */
export function applyMessageFilter(
  messages: ParsedMessage[],
  filter: MessageFilter,
): ParsedMessage[] {
  return messages.filter((msg) => {
    // Type toggles
    if (msg.type === 'user' && !filter.showUser) return false;
    if (msg.type === 'assistant' && !filter.showAssistant) return false;
    if ((msg.type === 'system' || msg.type === 'progress') && !filter.showSystem) return false;

    // Sidechain filter
    if (msg.isSidechain && !filter.showSidechains) return false;

    // Errors only
    if (filter.errorsOnly) {
      const hasError =
        msg.isError ||
        (msg.toolCalls && msg.toolCalls.some((tc) => tc.isError === true));
      if (!hasError) return false;
    }

    // Agent filter
    if (filter.agentId !== null && msg.agentId !== filter.agentId) return false;

    // Text search
    if (filter.searchQuery && !matchesSearch(msg, filter.searchQuery)) return false;

    return true;
  });
}
