# Claude Session Visualizer

A real-time visualization dashboard for [Claude Code](https://claude.ai/code) sessions. Browse, search, and analyze your coding sessions with interactive execution trees, token cost tracking, thinking trace exploration, and error debugging — all in your browser.

<p align="center">
  <strong>
    <a href="#quick-start">Quick Start</a> &nbsp;&bull;&nbsp;
    <a href="#features">Features</a> &nbsp;&bull;&nbsp;
    <a href="#how-it-works">How It Works</a> &nbsp;&bull;&nbsp;
    <a href="#development">Development</a> &nbsp;&bull;&nbsp;
    <a href="#contributing">Contributing</a>
  </strong>
</p>

---

## What is this?

Every Claude Code session generates a rich transcript — messages, tool calls, agent spawns, thinking blocks, and token usage — stored as JSONL files on your machine. **Claude Session Visualizer** reads these files and renders them as an interactive, real-time dashboard in your browser.

Think of it as **DevTools for Claude Code**: you can see exactly what Claude did, how much it cost, where it failed, and what it was thinking.

### Who is this for?

- **Claude Code power users** who want to understand and optimize their sessions
- **Developers debugging** failed or expensive Claude Code runs
- **Teams evaluating** different prompting strategies across sessions
- **Anyone curious** about what happens inside a Claude Code session

---

## Quick Start

### Prerequisites

- **Node.js 18+** (check with `node -v`)
- **Claude Code** installed (sessions are stored in `~/.claude/`)

### Install and Run

```bash
# Clone the repository
git clone https://github.com/anaypaul/claude-session-visualizer.git
cd claude-session-visualizer

# Install dependencies
npm install

# Start the dashboard (backend + frontend)
npm run dev
```

Open **http://localhost:3458** in your browser. That's it.

The dashboard will automatically discover all your Claude Code sessions (active and historical) and display them in the sidebar. Click any session to explore it.

---

## Features

### Conversation Timeline

The default view renders your session as a threaded conversation with:

- **User/Assistant messages** with markdown rendering and model badges
- **Tool call cards** — color-coded by type (Bash, Read, Write, Agent, etc.), expandable to show full input/output
- **Thinking blocks** — collapsible, showing Claude's reasoning process
- **Full-text search** — search across all messages, tool calls, and thinking blocks
- **Filter toggles** — show/hide by message type, sidechain, errors, or specific agent

### Execution Tree

An interactive graph (powered by React Flow) showing the complete execution flow:

- **Agent nodes** (large) — main session and every subagent with status, type, and message count
- **Tool call nodes** (small) — every tool invocation as a color-coded child node
- **Collapsible groups** — click an agent to expand/collapse its tool calls
- **Error highlighting** — failed tool calls glow red
- **Pan, zoom, minimap** — navigate large execution trees with ease

### Token Burn Chart

A stacked area chart tracking cumulative token consumption over the session:

- **Four token types** — input, output, cache read, cache creation
- **Running cost estimate** — in USD, using model-specific Anthropic pricing (Opus / Sonnet)
- **Per-turn tooltips** — hover to see the cost breakdown for any individual turn
- **Real-time updates** — the chart grows as the session progresses

### Thinking Explorer

A dedicated view for Claude's reasoning:

- **Density sparkline** — see where Claude was thinking hardest (longest thinking blocks)
- **Keyword search** — search across all thinking blocks with match highlighting
- **Trigger context** — see which user message triggered each thinking block
- **Stats** — estimated token count, character count, and average thinking length

### Error Replay

A debugging view that surfaces every failure:

- **Error density strip** — red dots on a session timeline showing where errors occurred
- **Failure rate** — X errors out of Y tool calls (Z%)
- **Recovery detection** — did Claude retry the same tool, try a different approach, or give up?
- **Error cards** — tool name, input summary, error message, and what happened next

### Session History

Browse all your Claude Code sessions across every project:

- **65+ sessions** discoverable from `~/.claude/projects/`
- **Filter by status** — All / Live / Closed
- **Search** — by session ID, project name, or working directory
- **Project badges** — see which project each session belongs to
- **Metadata** — message count, session duration, file size

### Task Board

A kanban-style view of Claude Code tasks:

- **Three columns** — Pending, In Progress, Completed
- **Dependency tracking** — blocked-by and blocks relationships
- **Owner badges** — who (or which agent) owns each task

---

## How It Works

Claude Session Visualizer is a local-only tool. It reads files from your machine — nothing is sent to any server.

### Architecture

```
~/.claude/
  projects/              Hono Backend (port 3457)          Browser (port 3458)
  ├── *.jsonl  ────────>  File Watcher (chokidar)  ──────>  React + Zustand
  └── sessions/           JSONL Parser                      React Flow
      └── *.json          SSE Broadcaster          <──────  EventSource
                          REST API                 <──────  fetch()
```

### Data flow

1. **Claude Code** writes conversation data as append-only JSONL files in `~/.claude/projects/`
2. **File watcher** (chokidar) detects changes using byte-offset tracking — only reads new data, never re-reads the full file
3. **JSONL parser** normalizes raw messages into a clean schema, grouping streamed assistant responses by `message.id`
4. **SSE broadcaster** pushes events to all connected browsers in real time
5. **React frontend** receives events via `EventSource`, updates the Zustand store, and re-renders the active view

### What data does it read?

| File | What it contains |
|------|-----------------|
| `~/.claude/sessions/{pid}.json` | Active session registry (PID, session ID, working directory) |
| `~/.claude/projects/{path}/{sessionId}.jsonl` | Full conversation transcript (messages, tool calls, thinking) |
| `~/.claude/projects/{path}/{sessionId}/subagents/agent-{id}.jsonl` | Subagent conversation transcripts |
| `~/.claude/projects/{path}/{sessionId}/subagents/agent-{id}.meta.json` | Agent metadata (type, description) |
| `~/.claude/tasks/{groupId}/{taskId}.json` | Task definitions (subject, status, dependencies) |

### Privacy

- **100% local** — the dashboard runs on your machine and reads local files only
- **Read-only** — it never writes to or modifies any Claude Code files
- **No telemetry** — no data is sent anywhere
- **No authentication** — designed for single-user local use

---

## Development

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | [Hono](https://hono.dev/) (TypeScript), Node.js |
| Real-time | Server-Sent Events (SSE) |
| File watching | [chokidar](https://github.com/paulmillr/chokidar) v4 |
| Frontend | [React](https://react.dev/) 18, [Vite](https://vite.dev/) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) v5 |
| Graph viz | [React Flow](https://reactflow.dev/) (@xyflow/react) |
| Charts | [Recharts](https://recharts.org/) |
| Language | TypeScript throughout |

### Project Structure

```
claude-session-visualizer/
├── server/                     # Backend (Hono, port 3457)
│   ├── index.ts                #   Server entry point
│   ├── api.ts                  #   REST API (session listing, conversation loading)
│   ├── hooks.ts                #   Claude Code hook receiver (10 endpoints)
│   ├── sse.ts                  #   SSE broadcaster (client management, event dispatch)
│   ├── parser.ts               #   JSONL parser (message normalization, grouping)
│   ├── watcher.ts              #   File watcher (byte-offset tracking, session discovery)
│   └── types.ts                #   Shared type definitions (the contract)
├── src/                        # Frontend (React, port 3458)
│   ├── main.tsx                #   React entry point
│   ├── App.tsx                 #   Dashboard layout (sidebar, tabs, metrics)
│   ├── store.ts                #   Zustand store (sessions, messages, agents, tasks)
│   ├── types.ts                #   Frontend type definitions
│   ├── hooks/
│   │   └── useSSE.ts           #   SSE connection hook
│   ├── components/
│   │   ├── SessionList.tsx     #   Session browser (filter, search, history)
│   │   ├── ConversationTimeline.tsx  # Message timeline with search integration
│   │   ├── MessageBubble.tsx   #   Individual message renderer
│   │   ├── ToolCallCard.tsx    #   Tool call visualization
│   │   ├── ThinkingBlock.tsx   #   Inline thinking block (collapsible)
│   │   ├── AgentGraph.tsx      #   Execution tree (React Flow)
│   │   ├── TaskBoard.tsx       #   Kanban task board
│   │   ├── MetricsPanel.tsx    #   Token/tool metrics
│   │   ├── TokenBurnChart.tsx  #   Cost waterfall chart
│   │   ├── ThinkingExplorer.tsx #  Thinking trace viewer
│   │   ├── ErrorReplayView.tsx #   Error investigation view
│   │   └── MessageSearchBar.tsx #  Search & filter bar
│   └── utils/
│       └── messageFilter.ts    #   Message filtering logic
├── index.html                  # HTML entry point
├── package.json
├── tsconfig.json
└── vite.config.ts              # Vite config (proxy 3458 → 3457)
```

### Scripts

```bash
npm run dev          # Start both backend and frontend in dev mode
npm run dev:server   # Start only the backend (port 3457)
npm run dev:client   # Start only the frontend (port 3458)
npm run build        # Production build (TypeScript check + Vite build)
npm run preview      # Preview the production build
```

### Adding a New View

The tab system is plug-and-play. To add a new visualization:

1. Create `src/components/MyNewView.tsx`:
   ```tsx
   import { useStore } from '../store';

   export function MyNewView() {
     const messages = useStore(s => s.messages);
     // Your visualization here
     return <div>...</div>;
   }
   ```

2. Register it in `src/App.tsx`:
   ```tsx
   import { MyNewView } from './components/MyNewView';

   type TabId = '...' | 'myview';

   const TABS = [
     ...existing,
     { id: 'myview', label: 'My View' },
   ];

   const TAB_COMPONENTS = {
     ...existing,
     myview: MyNewView,
   };
   ```

3. That's it. No backend changes needed if your view uses existing data from the store.

### Adding a New SSE Event

To stream new data types from backend to frontend:

1. Add the event type to `server/types.ts` in the `SSEEvent` union
2. Emit it from `server/watcher.ts` or `server/hooks.ts` via `broadcast(event)`
3. Handle it in `src/store.ts` inside `handleSSEEvent()`
4. Consume it in any component via `useStore()`

---

## Optional: Real-Time Hooks

By default, the visualizer discovers sessions by watching JSONL files. For lower-latency updates, you can configure Claude Code to send HTTP hooks directly to the visualizer.

Add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/pre-tool-use" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/post-tool-use" }] }],
    "SubagentStart": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/subagent-start" }] }],
    "SubagentStop": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/subagent-stop" }] }],
    "Stop": [{ "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/stop" }] }],
    "SessionStart": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/session-start" }] }],
    "SessionEnd": [{ "hooks": [{ "type": "http", "url": "http://localhost:3457/hooks/session-end" }] }]
  }
}
```

---

## Troubleshooting

### "No sessions detected"

Make sure Claude Code has been run at least once. Session data is stored in `~/.claude/projects/`. Check that this directory exists and contains `.jsonl` files:

```bash
ls ~/.claude/projects/
```

### "Waiting for messages..."

Click a session in the sidebar to load it. If sessions appear but messages don't load, check the backend is running:

```bash
curl http://localhost:3457/health
```

### Port conflicts

If ports 3457 or 3458 are in use, update them in:
- `server/index.ts` (line 13) for the backend port
- `vite.config.ts` (line 11-12) for the frontend port and proxy target

---

## Roadmap

- [ ] Session comparison view (side-by-side metrics for two sessions)
- [ ] File activity heatmap (which files Claude touched most)
- [ ] Session tagging and annotations
- [ ] Export sessions as JSON/CSV
- [ ] Deep linking (`?session=<id>` URL parameter)
- [ ] Code-splitting for faster initial load

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feat/my-feature`)
3. **Make your changes** — see [Development](#development) for the project structure
4. **Test locally** — run `npm run dev` and verify in the browser
5. **Submit a pull request** with a clear description of what you built

### Guidelines

- TypeScript strict mode — no `any` unless absolutely necessary
- All styling inline (no CSS modules or Tailwind) — keeps the project self-contained
- New views should read from the Zustand store, not fetch data independently
- Keep the backend read-only — never write to Claude Code's files

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Built with Claude Code.
