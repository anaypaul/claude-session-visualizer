// ============================================================
// Main Server Entry Point — Hono + SSE + Hooks + REST API
// ============================================================

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import hooks from './hooks.js';
import api from './api.js';
import { broadcast, createSSEStream, getClientCount } from './sse.js';
import { startWatching } from './watcher.js';

const PORT = 3457;

const app = new Hono();

// --- Middleware ---

app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',  // Vite dev server
      'http://localhost:3457',  // Self
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3457',
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
);

// --- SSE Stream Endpoint ---

app.get('/events', (c) => {
  const stream = createSSEStream();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
    },
  });
});

// --- Health Check ---

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: getClientCount(),
  });
});

// --- Mount Routes ---

app.route('/', hooks);
app.route('/', api);

// --- Start Server ---

console.log('=========================================');
console.log(' Claude Session Visualizer — Backend');
console.log('=========================================');
console.log(`Starting server on port ${PORT}...`);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
    console.log(`  SSE stream:  http://localhost:${info.port}/events`);
    console.log(`  Hooks:       http://localhost:${info.port}/hooks/*`);
    console.log(`  API:         http://localhost:${info.port}/api/sessions`);
    console.log(`  Health:      http://localhost:${info.port}/health`);
    console.log('=========================================');
  }
);

// Start the file watcher for live session monitoring
startWatching((event) => broadcast(event));
