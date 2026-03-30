# Launch Kit — Claude Session Visualizer

Ready-to-post drafts for each platform. Copy, customize, and post.

---

## 1. Hacker News — Show HN

**Post when:** Tuesday-Thursday, 8:00-10:00 AM Pacific

**Title:**
```
Show HN: DevTools for Claude Code – visualize sessions, track costs, debug failures
```

**URL:** `https://github.com/anaypaul/claude-session-visualizer`

**First comment (post immediately after submitting):**

```
Hi HN, I built this because I was spending $50+/day on Claude Code sessions and had
no idea where the tokens were going.

Claude Code stores every session as append-only JSONL files in ~/.claude/. Each file
contains the full transcript — messages, tool calls, thinking blocks, token usage,
agent spawns — but there's no way to see any of it without reading raw JSON.

So I built a local dashboard that reads these files in real-time and renders them as
interactive visualizations:

- Execution Tree: A React Flow graph showing agents as large nodes and every tool
  call (Bash, Read, Write, Grep, etc.) as small color-coded child nodes. You can see
  the full execution flow — which tools were called, in what order, and which failed.

- Token Burn Chart: Stacked area chart of cumulative token usage (input, output,
  cache read, cache creation) with a running cost estimate in USD.

- Thinking Explorer: All of Claude's thinking blocks in one searchable view with a
  density sparkline. Turns out Claude spends ~40% of output tokens on thinking blocks
  you never see in the terminal.

- Error Replay: Surfaces every tool failure with recovery detection — did Claude retry,
  try something different, or give up?

Tech stack: Hono backend watching JSONL files with chokidar (byte-offset tracking,
partial-line buffering), SSE streaming to a React/Zustand/React Flow frontend.
7,600 lines of TypeScript.

Everything runs locally. It only reads files — never writes to Claude's data.
No telemetry, no external API calls.

3 commands to try it: git clone, npm install, npm run dev.

Happy to answer questions about the architecture or what I've learned from
visualizing ~65 Claude Code sessions.
```

---

## 2. Reddit Posts

### r/ClaudeCode (post first — your core audience)

**Title:**
```
I built a live visualization dashboard for Claude Code sessions — execution trees, token costs, error debugging, and more
```

**Body:**
```
I was tired of not knowing what Claude Code was actually doing in my sessions — how
many tokens it used, which tools it called, where it failed, and what it was thinking.

So I built Claude Session Visualizer — a local dashboard that reads your ~/.claude/
session files and renders them as interactive visualizations in your browser.

**What it shows:**
- **Execution Tree** — agents and every tool call as an interactive flowchart
- **Token Burn Chart** — cumulative token usage with USD cost estimate
- **Thinking Explorer** — all thinking blocks searchable with density sparkline
- **Error Replay** — every failure with recovery detection
- **Message Search** — full-text search across all messages, tool calls, and thinking
- **Session History** — browse all 65+ of your past sessions

**3 commands to try it:**
```
git clone https://github.com/anaypaul/claude-session-visualizer.git
cd claude-session-visualizer && npm install
npm run dev    # Open http://localhost:3458
```

It's 100% local, read-only, and open source (MIT).

Repo: https://github.com/anaypaul/claude-session-visualizer

Some things I learned by visualizing my sessions:
- Claude spends ~40% of output tokens on thinking blocks
- Cache read efficiency varies wildly between sessions (20% to 85%)
- Error recovery patterns are fascinating — Claude retries the same tool ~60% of the time

Would love feedback. PRs welcome — there are "good first issue" labels for anyone
who wants to contribute.
```

### r/ClaudeAI (post 2-3 days after r/ClaudeCode)

**Title:**
```
I built DevTools for Claude Code — see exactly what it does, how much it costs, and where it fails
```

*(Use same body as above, slightly shorter)*

### r/ChatGPTCoding (post 2-3 days after r/ClaudeAI)

**Title:**
```
Built an open-source dashboard that visualizes Claude Code sessions — execution trees, token costs, error debugging
```

*(Use same body, add note: "Works with any Claude Code session. Curious if anyone has
built something similar for other AI coding tools?")*

---

## 3. Twitter/X Thread (7 tweets)

**Post when:** Weekday morning, 8-10 AM ET

**Tweet 1 (Hook):**
```
I had no idea what Claude Code was actually doing in my sessions.

How many tokens? Which tools? Where did it fail? What was it thinking?

So I built DevTools for Claude Code — a real-time visualization dashboard.

Open source, runs locally, 3 commands to start.

Thread 🧵
```

**Tweet 2 (Demo):**
```
The Execution Tree shows EVERYTHING Claude did:

- Agents as large nodes
- Every tool call (Bash, Read, Write, Grep...) as small colored nodes
- Click to expand/collapse
- Red glow on failures

It's like Chrome DevTools, but for Claude Code.

[ATTACH: screenshot of execution tree]
```

**Tweet 3 (Cost insight):**
```
The Token Burn Chart tracks cumulative cost in real-time.

Fun fact: Claude spends ~40% of output tokens on thinking blocks you never see.

Cache efficiency varies wildly — some sessions hit 85% cache reads, others only 20%.

[ATTACH: screenshot of token burn chart]
```

**Tweet 4 (Thinking):**
```
The Thinking Explorer lets you read Claude's "inner monologue."

Every thinking block, searchable, with a density sparkline showing where
Claude was reasoning hardest.

This is the best way to understand WHY Claude made a decision.

[ATTACH: screenshot of thinking explorer]
```

**Tweet 5 (Errors):**
```
The Error Replay view surfaces every failure.

For each error it shows:
- What tool failed and why
- Did Claude retry, try something else, or give up?

Error density strip at the top reveals clustering patterns.

[ATTACH: screenshot of error replay]
```

**Tweet 6 (Tech):**
```
Tech stack:
- Hono backend with chokidar file watcher
- Byte-offset tracking (never re-reads files)
- SSE streaming to React + Zustand
- React Flow for the execution tree
- Recharts for analytics
- 7,600 lines of TypeScript

100% local. Read-only. No telemetry.
```

**Tweet 7 (CTA):**
```
3 commands to try it:

git clone https://github.com/anaypaul/claude-session-visualizer
cd claude-session-visualizer && npm install
npm run dev

Star it if this is useful: https://github.com/anaypaul/claude-session-visualizer

MIT licensed. PRs welcome.

cc @AnthropicAI @alexalbert__
```

---

## 4. Dev.to Article

**Title:**
```
I Built DevTools for Claude Code — Here's What I Learned About How Claude Actually Works
```

**Tags:** `claude`, `devtools`, `visualization`, `typescript`, `opensource`

**Structure:**
1. The problem (no visibility into Claude Code sessions)
2. What I built (screenshots of each view)
3. Surprising findings from visualizing 65+ sessions
4. Technical architecture (brief)
5. How to try it (3 commands)
6. What's next (roadmap)
7. Call for contributors

---

## 5. Awesome-List PRs (being submitted automatically)

- [ ] awesome-claude-code (hesreallyhim)
- [ ] awesome-claude-code-toolkit (rohitg00)
- [ ] awesome-claude-skills (travisvn)

---

## Launch Timeline

| Day | Action | Platform |
|-----|--------|----------|
| **Pre-launch** | Seed 50+ stars from personal network | Direct |
| **Day 1** (Tue-Thu) | Show HN post + Twitter thread | HN + Twitter |
| **Day 3** | Post to r/ClaudeCode | Reddit |
| **Day 5** | Post to r/ClaudeAI | Reddit |
| **Day 7** | Publish Dev.to article | Dev.to |
| **Day 9** | Post to r/ChatGPTCoding | Reddit |
| **Day 14** | Cross-post to Hashnode + Medium | Blogs |
| **Day 21** | Post to r/programming (technical angle) | Reddit |
| **Month 2** | Product Hunt launch (after 200+ stars) | Product Hunt |
