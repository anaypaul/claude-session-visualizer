// ============================================================
// REST API — session listing and conversation retrieval
// Supports both active (PID-based) and historical (JSONL-based) sessions
// ============================================================

import { Hono } from 'hono';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { SessionInfo } from './types.js';
import { parseJsonlFile } from './parser.js';

const api = new Hono();

const CLAUDE_DIR = join(homedir(), '.claude');
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

// Decode path-encoded project directory name back to a readable path
// e.g., "-Users-anaypaul-workspace-omni-cli" → "/Users/anaypaul/workspace/omni-cli"
function decodeProjectPath(encoded: string): string {
  // Replace leading dash with /, then remaining dashes with /
  // But only dashes that are path separators (heuristic: split and rejoin)
  return '/' + encoded.slice(1).replace(/-/g, '/');
}

// Extract the last directory name as a short project label
function shortProjectName(decodedPath: string): string {
  const parts = decodedPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || decodedPath;
}

// Read the first and last lines of a file efficiently (no full file read)
async function getFirstLastLines(filePath: string): Promise<{ first: string | null; last: string | null; lineCount: number }> {
  return new Promise((resolve) => {
    let first: string | null = null;
    let last: string | null = null;
    let lineCount = 0;

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      lineCount++;
      if (!first) first = line;
      last = line;
    });

    rl.on('close', () => resolve({ first, last, lineCount }));
    rl.on('error', () => resolve({ first: null, last: null, lineCount: 0 }));
  });
}

// Extract timestamp from a JSONL line
function extractTimestamp(line: string): number | null {
  try {
    const obj = JSON.parse(line);
    if (obj.timestamp) return new Date(obj.timestamp).getTime();
    if (obj.startedAt) return obj.startedAt;
  } catch { /* skip */ }
  return null;
}

// Get active session IDs from PID files
async function getActiveSessionIds(): Promise<Set<string>> {
  const active = new Set<string>();
  try {
    const files = await readdir(SESSIONS_DIR).catch(() => [] as string[]);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await readFile(join(SESSIONS_DIR, file), 'utf-8');
        const data = JSON.parse(content);
        if (data.sessionId) active.add(data.sessionId);
      } catch { /* skip */ }
    }
  } catch { /* directory may not exist */ }
  return active;
}

/**
 * GET /api/sessions — list ALL sessions (active + historical) from JSONL files
 * Query params:
 *   ?filter=all|active|closed  (default: all)
 *   ?project=<encoded-project-name>  (filter by project)
 *   ?search=<query>  (search session content — future)
 */
api.get('/api/sessions', async (c) => {
  const filter = (c.req.query('filter') ?? 'all') as 'all' | 'active' | 'closed';
  const projectFilter = c.req.query('project') ?? null;

  try {
    const activeSessionIds = await getActiveSessionIds();
    const sessions: SessionInfo[] = [];

    // Scan all project directories for JSONL files
    const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[]);

    for (const projDir of projectDirs) {
      if (projectFilter && projDir !== projectFilter) continue;

      const projPath = join(PROJECTS_DIR, projDir);
      const projStat = await stat(projPath).catch(() => null);
      if (!projStat?.isDirectory()) continue;

      const decodedPath = decodeProjectPath(projDir);
      const projectName = shortProjectName(decodedPath);

      // List all JSONL files in this project directory
      const files = await readdir(projPath).catch(() => [] as string[]);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const sessionId = file.replace(/\.jsonl$/, '');
        const isActive = activeSessionIds.has(sessionId);

        // Apply filter
        if (filter === 'active' && !isActive) continue;
        if (filter === 'closed' && isActive) continue;

        const filePath = join(projPath, file);

        try {
          const fileStat = await stat(filePath);
          const { first, last, lineCount } = await getFirstLastLines(filePath);

          const startedAt = (first ? extractTimestamp(first) : null) ?? fileStat.birthtimeMs;
          const lastActivityAt = (last ? extractTimestamp(last) : null) ?? fileStat.mtimeMs;

          // Try to extract cwd from first message
          let cwd = decodedPath;
          if (first) {
            try {
              const parsed = JSON.parse(first);
              if (parsed.cwd) cwd = parsed.cwd;
            } catch { /* use decoded path */ }
          }

          sessions.push({
            sessionId,
            pid: 0,
            cwd,
            startedAt,
            kind: 'interactive',
            entrypoint: 'cli',
            isActive,
            messageCount: lineCount,
            agents: [],
            // Extended fields for the history view
            projectName,
            projectDir: projDir,
            lastActivityAt,
            fileSizeBytes: fileStat.size,
          } as SessionInfo & { projectName: string; projectDir: string; lastActivityAt: number; fileSizeBytes: number });
        } catch {
          // Skip files that can't be read
          continue;
        }
      }
    }

    // Sort by last activity, most recent first
    sessions.sort((a, b) => {
      const aTime = (a as any).lastActivityAt ?? a.startedAt;
      const bTime = (b as any).lastActivityAt ?? b.startedAt;
      return bTime - aTime;
    });

    return c.json({ sessions, totalCount: sessions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to list sessions: ${message}` }, 500);
  }
});

/**
 * GET /api/sessions/:sessionId — get full parsed conversation for a session
 * Searches across all project directories to find the JSONL file
 */
api.get('/api/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    // Search across all project directories for this session's JSONL
    const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[]);

    for (const projDir of projectDirs) {
      const jsonlPath = join(PROJECTS_DIR, projDir, `${sessionId}.jsonl`);
      try {
        await stat(jsonlPath);
        // File exists — parse it
        const messages = await parseJsonlFile(jsonlPath);

        // Check for subagents
        const subagentDir = join(PROJECTS_DIR, projDir, sessionId, 'subagents');
        const subagentFiles = await readdir(subagentDir).catch(() => [] as string[]);
        const agentJsonls = subagentFiles.filter(f => f.endsWith('.jsonl'));
        const metaFiles = subagentFiles.filter(f => f.endsWith('.meta.json'));

        const subagentMessages: Record<string, any[]> = {};
        const agents: Array<{
          agentId: string;
          agentType: string;
          description: string;
          status: string;
          messageCount: number;
          spawnedAt: string;
        }> = [];

        for (const af of agentJsonls) {
          const agentId = af.replace(/^agent-/, '').replace(/\.jsonl$/, '');
          const agentMsgs = await parseJsonlFile(join(subagentDir, af));
          subagentMessages[agentId] = agentMsgs;

          // Read agent metadata
          const metaFile = metaFiles.find(m => m.includes(agentId));
          let agentType = 'general-purpose';
          let description = '';
          if (metaFile) {
            try {
              const metaContent = await readFile(join(subagentDir, metaFile), 'utf-8');
              const meta = JSON.parse(metaContent);
              agentType = meta.agentType ?? 'general-purpose';
              description = meta.description ?? '';
            } catch { /* skip */ }
          }

          // Get spawn time from the first message
          const spawnedAt = agentMsgs.length > 0 ? agentMsgs[0].timestamp : '';

          agents.push({
            agentId,
            agentType,
            description,
            status: 'completed', // Historical sessions — all agents are done
            messageCount: agentMsgs.length,
            spawnedAt,
          });
        }

        return c.json({
          sessionId,
          projectDir: projDir,
          projectName: shortProjectName(decodeProjectPath(projDir)),
          messageCount: messages.length,
          messages,
          agents,
          subagents: subagentMessages,
        });
      } catch {
        // Not in this project directory, try next
        continue;
      }
    }

    return c.json({ error: `Session not found: ${sessionId}` }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to load session: ${message}` }, 500);
  }
});

/**
 * GET /api/projects — list all project directories with session counts
 */
api.get('/api/projects', async (c) => {
  try {
    const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[]);
    const projects: { name: string; dir: string; path: string; sessionCount: number }[] = [];

    for (const projDir of projectDirs) {
      const projPath = join(PROJECTS_DIR, projDir);
      const projStat = await stat(projPath).catch(() => null);
      if (!projStat?.isDirectory()) continue;

      const files = await readdir(projPath).catch(() => [] as string[]);
      const sessionCount = files.filter(f => f.endsWith('.jsonl')).length;

      const decodedPath = decodeProjectPath(projDir);
      projects.push({
        name: shortProjectName(decodedPath),
        dir: projDir,
        path: decodedPath,
        sessionCount,
      });
    }

    projects.sort((a, b) => b.sessionCount - a.sessionCount);
    return c.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to list projects: ${message}` }, 500);
  }
});

export default api;
