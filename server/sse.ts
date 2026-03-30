// ============================================================
// SSE Broadcaster — manages connected clients and broadcasts events
// ============================================================

import type { SSEEvent } from './types.js';

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

const clients = new Set<SSEClient>();

let clientIdCounter = 0;

/**
 * Register a new SSE client stream controller.
 * Returns a client handle for later removal.
 */
export function addClient(controller: ReadableStreamDefaultController): SSEClient {
  const client: SSEClient = {
    id: `sse-client-${++clientIdCounter}`,
    controller,
  };
  clients.add(client);
  console.log(`[SSE] Client connected: ${client.id} (total: ${clients.size})`);
  return client;
}

/**
 * Remove a disconnected SSE client.
 */
export function removeClient(client: SSEClient): void {
  clients.delete(client);
  console.log(`[SSE] Client disconnected: ${client.id} (total: ${clients.size})`);
}

/**
 * Broadcast an SSE event to all connected clients.
 * Clients that fail to receive are silently removed.
 */
export function broadcast(event: SSEEvent): void {
  if (clients.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(payload);

  const deadClients: SSEClient[] = [];

  for (const client of clients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Client stream closed or errored — mark for removal
      deadClients.push(client);
    }
  }

  for (const dead of deadClients) {
    removeClient(dead);
  }
}

/**
 * Create a new ReadableStream for an SSE connection.
 * Returns the stream (to be used as a Hono Response body) and
 * handles client lifecycle automatically.
 */
export function createSSEStream(): ReadableStream {
  let client: SSEClient | null = null;

  return new ReadableStream({
    start(controller) {
      client = addClient(controller);

      // Send an initial comment to establish the connection
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(': connected\n\n'));
    },
    cancel() {
      if (client) {
        removeClient(client);
        client = null;
      }
    },
  });
}

/**
 * Get the count of currently connected SSE clients.
 */
export function getClientCount(): number {
  return clients.size;
}
