import type { ParsedMessage, SessionInfo, ToolCallInfo } from '../types';

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildBaseFilename(session: SessionInfo | null): string {
  if (!session) {
    return 'claude-session';
  }

  const sessionPart = sanitizeFilenamePart(session.sessionId) || 'session';
  return `claude-session-${sessionPart}`;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function formatToolCall(toolCall: ToolCallInfo): string {
  const lines = [
    `Tool: ${toolCall.name}`,
    `ID: ${toolCall.id}`,
  ];

  if (toolCall.input && Object.keys(toolCall.input).length > 0) {
  lines.push(`Input: ${JSON.stringify(toolCall.input, null, 2)}`);
}

  if (toolCall.result != null) {
  lines.push(
    `Result: ${
      typeof toolCall.result === 'string'
        ? toolCall.result
        : JSON.stringify(toolCall.result, null, 2)
    }`
  );
}

  if (toolCall.durationMs != null) {
    lines.push(`Duration: ${toolCall.durationMs}ms`);
  }

  if (toolCall.isError) {
    lines.push('Status: error');
  }

  return lines.join('\n');
}

function formatMessageLabel(message: ParsedMessage): string {
  if (message.type === 'user') {
    return message.isToolResult
      ? message.isError ? 'Tool Error' : 'Tool Result'
      : 'User';
  }

  if (message.type === 'assistant') {
    return 'Assistant';
  }

  if (message.type === 'progress') {
    return 'Progress';
  }

  return 'System';
}

function formatMessageBody(message: ParsedMessage): string {
  if (message.type === 'user') {
    return message.userContent?.trim() || '(empty)';
  }

  if (message.type === 'assistant') {
    const parts: string[] = [];

    if (message.thinking) {
      parts.push(`Thinking:\n${message.thinking.trim()}`);
    }

    if (message.text) {
      parts.push(message.text.trim());
    }

    if (message.toolCalls?.length) {
      const tools = message.toolCalls.map((toolCall) => formatToolCall(toolCall));
      parts.push(`Tool Calls:\n${tools.join('\n\n')}`);
    }

    if (message.usage) {
      parts.push(
        `Usage: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output`
      );
    }

    return parts.join('\n\n') || '(empty)';
  }

  if (message.type === 'progress') {
    return 'Processing...';
  }

  if (message.subtype === 'turn_duration' && message.durationMs != null) {
    return `Turn completed in ${(message.durationMs / 1000).toFixed(1)}s`;
  }

  if (message.durationMs != null) {
    return `${(message.durationMs / 1000).toFixed(1)}s`;
  }

  return message.subtype || '(system)';
}

export function exportSessionAsJson(
  session: SessionInfo | null,
  messages: ParsedMessage[],
) {
  const filename = `${buildBaseFilename(session)}.json`;
  const payload = JSON.stringify(messages, null, 2);

  triggerDownload(payload, filename, 'application/json');
}

export function exportSessionAsMarkdown(
  session: SessionInfo | null,
  messages: ParsedMessage[],
) {
  const filename = `${buildBaseFilename(session)}.md`;
  const lines: string[] = [
    '# Claude Session Transcript',
    '',
  ];

  if (session) {
    lines.push(`- Session ID: \`${session.sessionId}\``);
    lines.push(`- CWD: \`${session.cwd}\``);
    lines.push(`- Started: ${new Date(session.startedAt).toLocaleString()}`);
    lines.push(`- Status: ${session.isActive ? 'Live' : 'Closed'}`);
    lines.push('');
  }

  if (messages.length === 0) {
    lines.push('_No messages in this session._');
  } else {
    for (const message of messages) {
      lines.push(`## ${formatMessageLabel(message)}`);
      lines.push('');
      lines.push(`- Timestamp: ${new Date(message.timestamp).toLocaleString()}`);

      if (message.agentId) {
        lines.push(`- Agent: \`${message.agentId}\``);
      }

      if (message.model) {
        lines.push(`- Model: \`${message.model}\``);
      }

      lines.push('');
      lines.push('```text');
      lines.push(formatMessageBody(message));
      lines.push('```');
      lines.push('');
    }
  }

  triggerDownload(lines.join('\n'), filename, 'text/markdown;charset=utf-8');
}
