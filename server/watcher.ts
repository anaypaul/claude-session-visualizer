// ============================================================
// File Watcher — Monitors Claude Code session files for changes
// ============================================================

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { watch, type FSWatcher as ChokidarWatcher } from 'chokidar';
import { parseLine, parseJsonlFile } from './parser.js';
import type {
  SSEEvent,
  SessionInfo,
  AgentInfo,
} from './types.js';

// --- Paths ---

const HOME = os.homedir();
const SESSIONS_DIR = path.join(HOME, '.claude', 'sessions');
const PROJECTS_DIR = path.join(HOME, '.claude', 'projects');

// --- Internal state ---

/** Maps session PID filename (e.g. "1234.json") to session info */
const activeSessions = new Map<string, SessionInfo>();

/** Maps JSONL file path to its current byte offset (for incremental reads) */
const fileOffsets = new Map<string, number>();

/** Maps JSONL file path to a partial line buffer (incomplete last line) */
const partialBuffers = new Map<string, string>();

/** Maps session directory path to its subagent watcher */
const subagentWatchers = new Map<string, ChokidarWatcher>();

/** Maps JSONL file path to the sessionId it belongs to */
const fileToSession = new Map<string, string>();

/** Maps JSONL file path to the agentId (for subagent files) */
const fileToAgent = new Map<string, string>();

/** Holds the main watchers for cleanup */
let sessionWatcher: ChokidarWatcher | null = null;
let projectWatcher: ChokidarWatcher | null = null;

// --- Public API ---

/**
 * Start watching Claude Code session and project files.
 * Calls onEvent with SSE events as changes are detected.
 */
export function startWatching(onEvent: (event: SSEEvent) => void): void {
  ensureDirectoriesExist();
  watchSessionFiles(onEvent);
  watchProjectFiles(onEvent);

  // Emit current session list on startup
  discoverExistingSessions(onEvent);
}

/**
 * Return a snapshot of all currently active sessions.
 */
export function getActiveSessions(): SessionInfo[] {
  return Array.from(activeSessions.values());
}

/**
 * Stop all watchers and clean up resources.
 */
export async function stopWatching(): Promise<void> {
  if (sessionWatcher) {
    await sessionWatcher.close();
    sessionWatcher = null;
  }
  if (projectWatcher) {
    await projectWatcher.close();
    projectWatcher = null;
  }
  for (const w of subagentWatchers.values()) {
    await w.close();
  }
  subagentWatchers.clear();
  activeSessions.clear();
  fileOffsets.clear();
  partialBuffers.clear();
  fileToSession.clear();
  fileToAgent.clear();
}

// --- Directory setup ---

function ensureDirectoriesExist(): void {
  try {
    fsSync.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch {
    // May already exist or be unwritable; non-fatal
  }
  try {
    fsSync.mkdirSync(PROJECTS_DIR, { recursive: true });
  } catch {
    // May already exist or be unwritable; non-fatal
  }
}

// --- Session PID file watching ---

/**
 * Discover sessions already present when the watcher starts.
 */
async function discoverExistingSessions(onEvent: (event: SSEEvent) => void): Promise<void> {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await handleSessionFileAdded(file, onEvent);
      }
    }
    // Emit consolidated session list
    onEvent({ type: 'session_list', sessions: getActiveSessions() });
  } catch (err) {
    console.warn('[watcher] Could not read sessions directory:', err);
  }
}

function watchSessionFiles(onEvent: (event: SSEEvent) => void): void {
  sessionWatcher = watch(SESSIONS_DIR, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  sessionWatcher.on('add', (filePath: string) => {
    const file = path.basename(filePath);
    if (file.endsWith('.json')) {
      handleSessionFileAdded(file, onEvent);
    }
  });

  sessionWatcher.on('unlink', (filePath: string) => {
    const file = path.basename(filePath);
    if (file.endsWith('.json')) {
      handleSessionFileRemoved(file, onEvent);
    }
  });

  sessionWatcher.on('error', (err) => {
    console.error('[watcher] Session watcher error:', err);
  });
}

async function handleSessionFileAdded(
  filename: string,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const filePath = path.join(SESSIONS_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const session: SessionInfo = {
      sessionId: data.sessionId,
      pid: data.pid,
      cwd: data.cwd ?? '',
      startedAt: data.startedAt ?? Date.now(),
      kind: data.kind ?? 'interactive',
      entrypoint: data.entrypoint ?? 'cli',
      isActive: true,
      messageCount: 0,
      agents: [],
    };

    activeSessions.set(filename, session);
    onEvent({ type: 'session_started', session });

    // Look for existing JSONL files for this session and load them
    await discoverSessionJsonl(session, onEvent);
  } catch (err) {
    console.warn(`[watcher] Could not read session file ${filename}:`, err);
  }
}

function handleSessionFileRemoved(
  filename: string,
  onEvent: (event: SSEEvent) => void
): void {
  const session = activeSessions.get(filename);
  if (session) {
    session.isActive = false;
    onEvent({ type: 'session_ended', sessionId: session.sessionId });
    activeSessions.delete(filename);

    // Clean up file offset tracking for this session's JSONL files
    for (const [fp, sid] of fileToSession.entries()) {
      if (sid === session.sessionId) {
        fileOffsets.delete(fp);
        partialBuffers.delete(fp);
        fileToSession.delete(fp);
        fileToAgent.delete(fp);
      }
    }

    // Clean up subagent watcher if any
    // The session dir is named with the sessionId
    for (const [dirPath, watcher] of subagentWatchers.entries()) {
      if (dirPath.includes(session.sessionId)) {
        watcher.close();
        subagentWatchers.delete(dirPath);
      }
    }
  }
}

// --- Project JSONL file watching ---

/**
 * Discover existing JSONL files for a newly registered session.
 */
async function discoverSessionJsonl(
  session: SessionInfo,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR);

    for (const projDir of projectDirs) {
      const projPath = path.join(PROJECTS_DIR, projDir);
      const stat = await fs.stat(projPath).catch(() => null);
      if (!stat?.isDirectory()) continue;

      // Check for main JSONL file
      const jsonlPath = path.join(projPath, `${session.sessionId}.jsonl`);
      if (fsSync.existsSync(jsonlPath)) {
        await loadInitialJsonl(jsonlPath, session.sessionId, onEvent);
      }

      // Check for session directory with subagents
      const sessionDir = path.join(projPath, session.sessionId);
      const sessionDirStat = await fs.stat(sessionDir).catch(() => null);
      if (sessionDirStat?.isDirectory()) {
        // Check for main JSONL in the session dir
        const mainJsonl = path.join(sessionDir, `${session.sessionId}.jsonl`);
        if (fsSync.existsSync(mainJsonl)) {
          await loadInitialJsonl(mainJsonl, session.sessionId, onEvent);
        }

        // Discover subagents
        await discoverSubagents(sessionDir, session.sessionId, onEvent);
      }
    }
  } catch (err) {
    console.warn('[watcher] Error discovering session JSONL:', err);
  }
}

async function loadInitialJsonl(
  filePath: string,
  sessionId: string,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  fileToSession.set(filePath, sessionId);

  const messages = await parseJsonlFile(filePath);

  // Update session message count
  const session = findSessionById(sessionId);
  if (session) {
    session.messageCount = messages.length;
  }

  // Set the byte offset to end of file so incremental reads only get new data
  try {
    const stat = await fs.stat(filePath);
    fileOffsets.set(filePath, stat.size);
  } catch {
    fileOffsets.set(filePath, 0);
  }

  if (messages.length > 0) {
    onEvent({ type: 'initial_state', sessionId, messages });
  }
}

function watchProjectFiles(onEvent: (event: SSEEvent) => void): void {
  projectWatcher = watch(PROJECTS_DIR, {
    ignoreInitial: true,
    // Watch deep enough to catch subagent files:
    // projects/{project}/{sessionId}/subagents/agent-{id}.jsonl
    depth: 4,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  });

  projectWatcher.on('add', (filePath: string) => {
    handleProjectFileEvent(filePath, 'add', onEvent);
  });

  projectWatcher.on('change', (filePath: string) => {
    handleProjectFileEvent(filePath, 'change', onEvent);
  });

  projectWatcher.on('error', (err) => {
    console.error('[watcher] Project watcher error:', err);
  });
}

async function handleProjectFileEvent(
  filePath: string,
  eventType: 'add' | 'change',
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const basename = path.basename(filePath);

  // Handle subagent metadata files
  if (basename.endsWith('.meta.json')) {
    await handleSubagentMeta(filePath, onEvent);
    return;
  }

  // Only process .jsonl files
  if (!basename.endsWith('.jsonl')) return;

  // Determine if this is a subagent file
  const isSubagent = filePath.includes('/subagents/');

  if (eventType === 'add') {
    // New JSONL file appeared
    const sessionId = resolveSessionId(filePath);
    if (!sessionId) return;

    fileToSession.set(filePath, sessionId);

    if (isSubagent) {
      const agentId = extractAgentId(basename);
      if (agentId) {
        fileToAgent.set(filePath, agentId);
      }
    }

    // For new files, load everything then track offset
    await loadInitialJsonl(filePath, sessionId, onEvent);
  } else {
    // File changed — read incremental data
    await readIncremental(filePath, onEvent);
  }
}

// --- Subagent handling ---

async function discoverSubagents(
  sessionDir: string,
  sessionId: string,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const subagentsDir = path.join(sessionDir, 'subagents');
  try {
    const stat = await fs.stat(subagentsDir);
    if (!stat.isDirectory()) return;
  } catch {
    return; // No subagents directory
  }

  try {
    const files = await fs.readdir(subagentsDir);

    // Process metadata files first to register agents
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        await handleSubagentMeta(path.join(subagentsDir, file), onEvent);
      }
    }

    // Then load their JSONL data
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(subagentsDir, file);
        const agentId = extractAgentId(file);
        if (agentId) {
          fileToSession.set(filePath, sessionId);
          fileToAgent.set(filePath, agentId);
          await loadInitialJsonl(filePath, sessionId, onEvent);
        }
      }
    }
  } catch (err) {
    console.warn(`[watcher] Error reading subagents dir ${subagentsDir}:`, err);
  }
}

async function handleSubagentMeta(
  metaPath: string,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(content);
    const basename = path.basename(metaPath);
    // Extract agent ID from "agent-{id}.meta.json"
    const agentId = basename.replace('.meta.json', '').replace('agent-', '');
    const sessionId = resolveSessionId(metaPath);
    if (!sessionId) return;

    const agent: AgentInfo = {
      agentId,
      agentType: meta.agentType ?? 'unknown',
      description: meta.description ?? '',
      parentAgentId: meta.parentAgentId,
      status: 'running',
      messageCount: 0,
      spawnedAt: new Date().toISOString(),
    };

    // Add agent to session
    const session = findSessionById(sessionId);
    if (session) {
      const existing = session.agents.find((a) => a.agentId === agentId);
      if (!existing) {
        session.agents.push(agent);
        onEvent({ type: 'agent_spawned', sessionId, agent });
      }
    }
  } catch (err) {
    console.warn(`[watcher] Could not read subagent meta ${metaPath}:`, err);
  }
}

// --- Incremental reading ---

/**
 * Read new bytes from a JSONL file starting at the last known offset.
 * Handles partial lines by buffering them until the next read.
 */
async function readIncremental(
  filePath: string,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const sessionId = fileToSession.get(filePath);
  if (!sessionId) {
    // Try to discover the session for this file
    const sid = resolveSessionId(filePath);
    if (sid) {
      fileToSession.set(filePath, sid);
    } else {
      return;
    }
  }

  const currentOffset = fileOffsets.get(filePath) ?? 0;
  let fileSize: number;

  try {
    const stat = await fs.stat(filePath);
    fileSize = stat.size;
  } catch {
    return; // File may have been deleted
  }

  if (fileSize <= currentOffset) return; // No new data

  // Read only the new bytes
  let fd: fs.FileHandle | null = null;
  let newData: string;

  try {
    fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(fileSize - currentOffset);
    await fd.read(buffer, 0, buffer.length, currentOffset);
    newData = buffer.toString('utf-8');
  } catch (err) {
    console.warn(`[watcher] Error reading incremental data from ${filePath}:`, err);
    return;
  } finally {
    if (fd) await fd.close();
  }

  // Update offset
  fileOffsets.set(filePath, fileSize);

  // Prepend any buffered partial line from the previous read
  const partial = partialBuffers.get(filePath) ?? '';
  const fullData = partial + newData;

  // Split into lines
  const lines = fullData.split('\n');

  // The last element may be a partial line (no trailing newline)
  // If the data ends with \n, the last element is an empty string — no partial
  const lastLine = lines[lines.length - 1];
  if (lastLine === '') {
    // Data ended cleanly with a newline
    partialBuffers.delete(filePath);
    lines.pop(); // Remove trailing empty string
  } else {
    // Last line is incomplete — buffer it
    partialBuffers.set(filePath, lastLine);
    lines.pop();
  }

  const resolvedSessionId = fileToSession.get(filePath) ?? sessionId!;
  const agentId = fileToAgent.get(filePath);
  const session = findSessionById(resolvedSessionId);

  for (const line of lines) {
    const msg = parseLine(line);
    if (!msg) continue;

    if (session) {
      session.messageCount++;
    }

    if (agentId) {
      // This is a subagent message
      onEvent({
        type: 'agent_message',
        sessionId: resolvedSessionId,
        agentId,
        message: msg,
      });
    } else {
      onEvent({
        type: 'new_message',
        sessionId: resolvedSessionId,
        message: msg,
      });
    }
  }
}

// --- Utility helpers ---

/**
 * Resolve which sessionId a JSONL file belongs to by inspecting
 * the file path structure.
 *
 * Patterns:
 *   .../projects/{project}/{sessionId}.jsonl
 *   .../projects/{project}/{sessionId}/subagents/agent-{id}.jsonl
 *   .../projects/{project}/{sessionId}/{sessionId}.jsonl
 */
function resolveSessionId(filePath: string): string | null {
  const parts = filePath.split(path.sep);
  const projectsIdx = parts.indexOf('projects');
  if (projectsIdx === -1) return null;

  // projects/{projectDir}/{sessionIdOrFile}
  // Index: projectsIdx / projectsIdx+1 / projectsIdx+2

  if (parts.length <= projectsIdx + 2) return null;

  const thirdPart = parts[projectsIdx + 2]; // Either "{sessionId}.jsonl" or "{sessionId}" (dir)

  if (thirdPart.endsWith('.jsonl')) {
    // Direct JSONL: projects/{project}/{sessionId}.jsonl
    return thirdPart.replace('.jsonl', '');
  }

  // It's a directory name, which is the sessionId
  // Verify it looks like a UUID
  if (thirdPart.match(/^[0-9a-f]{8}-/)) {
    return thirdPart;
  }

  // Also check if this session is known
  for (const session of activeSessions.values()) {
    if (filePath.includes(session.sessionId)) {
      return session.sessionId;
    }
  }

  return null;
}

/**
 * Extract agent ID from a subagent JSONL filename.
 * Pattern: "agent-{id}.jsonl" -> "{id}"
 */
function extractAgentId(filename: string): string | null {
  const match = filename.match(/^agent-(.+)\.jsonl$/);
  return match ? match[1] : null;
}

/**
 * Find a session by its sessionId across all active sessions.
 */
function findSessionById(sessionId: string): SessionInfo | null {
  for (const session of activeSessions.values()) {
    if (session.sessionId === sessionId) return session;
  }
  return null;
}
