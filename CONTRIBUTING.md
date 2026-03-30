# Contributing to Claude Session Visualizer

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-session-visualizer.git
   cd claude-session-visualizer
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Start** the dev server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3458 in your browser

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes
3. Verify TypeScript compiles:
   ```bash
   npx tsc --noEmit
   ```
4. Test in the browser with `npm run dev`
5. Commit your changes with a descriptive message
6. Push and open a Pull Request

## What to Work On

Check the [Issues](https://github.com/anaypaul/claude-session-visualizer/issues) tab for open tasks. Good first issues are labeled `good first issue`.

### Ideas for Contributions

- **New visualization views** — see the [Adding a New View](README.md#adding-a-new-view) guide
- **Bug fixes** — if something doesn't render correctly or data is missing
- **Performance improvements** — especially for large sessions (1000+ messages)
- **Accessibility** — keyboard navigation, screen reader support
- **Documentation** — improve guides, add screenshots, write tutorials

## Code Style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **Inline styles** — no CSS modules, Tailwind, or external stylesheets
- **Functional components** — React hooks, no class components
- **Named exports** — `export function MyComponent()` not `export default`
- **Dark theme** — backgrounds: `#0a0a0f`, `#12121a`, `#1a1a2e`; text: `#e0e0e8`

## Architecture Rules

- **Read-only** — never write to Claude Code's files (`~/.claude/`)
- **Local-only** — no external API calls, no telemetry, no tracking
- **Store-first** — new views should read from the Zustand store, not fetch independently
- **Type-safe** — shared types live in `server/types.ts` (the contract between backend and frontend)

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Add screenshots for UI changes
- Make sure `npx tsc --noEmit` passes with zero errors

## Questions?

Open an issue or start a discussion. We're happy to help!
