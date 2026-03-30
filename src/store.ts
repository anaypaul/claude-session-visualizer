import { create } from 'zustand';
import type {
  SessionInfo,
  ParsedMessage,
  AgentInfo,
  TaskInfo,
  SSEEvent,
} from './types';

export interface AppState {
  // Sessions
  sessions: SessionInfo[];
  activeSessionId: string | null;
  setActiveSession: (id: string) => void;
  setSessions: (sessions: SessionInfo[]) => void;

  // Messages for the active session
  messages: ParsedMessage[];
  loadingMessages: boolean;
  loadSessionMessages: (sessionId: string) => void;

  // Agents
  agents: AgentInfo[];

  // Tasks
  tasks: TaskInfo[];

  // Connection status
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Actions
  handleSSEEvent: (event: SSEEvent) => void;
}

export const useStore = create<AppState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  loadingMessages: false,
  agents: [],
  tasks: [],
  connected: false,

  setConnected: (connected: boolean) => set({ connected }),

  setSessions: (sessions: SessionInfo[]) => set({ sessions }),

  setActiveSession: (id: string) => {
    set({ activeSessionId: id, messages: [], agents: [], loadingMessages: false });
  },

  loadSessionMessages: async (sessionId: string) => {
    set({ loadingMessages: true, messages: [], agents: [] });
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const state = get();
      // Only update if this is still the active session
      if (state.activeSessionId === sessionId) {
        // Build AgentInfo[] from the API response
        const agents: AgentInfo[] = (data.agents ?? []).map((a: any) => ({
          agentId: a.agentId,
          agentType: a.agentType ?? 'general-purpose',
          description: a.description ?? '',
          status: a.status ?? 'completed',
          messageCount: a.messageCount ?? 0,
          spawnedAt: a.spawnedAt ?? '',
        }));

        set({
          messages: data.messages ?? [],
          agents,
          loadingMessages: false,
        });
      }
    } catch {
      set({ loadingMessages: false });
    }
  },

  handleSSEEvent: (event: SSEEvent) => {
    const state = get();

    switch (event.type) {
      case 'session_list': {
        set({ sessions: event.sessions });
        // Auto-select the first active session if none is selected
        if (!state.activeSessionId) {
          const firstActive = event.sessions.find((s) => s.isActive);
          if (firstActive) {
            set({ activeSessionId: firstActive.sessionId });
          } else if (event.sessions.length > 0) {
            set({ activeSessionId: event.sessions[0].sessionId });
          }
        }
        break;
      }

      case 'session_started': {
        set({
          sessions: [...state.sessions.filter(
            (s) => s.sessionId !== event.session.sessionId
          ), event.session],
        });
        // Auto-select if no session is active
        if (!state.activeSessionId) {
          set({ activeSessionId: event.session.sessionId });
        }
        break;
      }

      case 'session_ended': {
        set({
          sessions: state.sessions.map((s) =>
            s.sessionId === event.sessionId
              ? { ...s, isActive: false }
              : s
          ),
        });
        break;
      }

      case 'initial_state': {
        if (event.sessionId === state.activeSessionId) {
          // Collect agents from the session
          const session = state.sessions.find(
            (s) => s.sessionId === event.sessionId
          );
          set({
            messages: event.messages,
            agents: session?.agents ?? [],
          });
        }
        break;
      }

      case 'new_message': {
        if (event.sessionId === state.activeSessionId) {
          set({ messages: [...state.messages, event.message] });
        }
        // Update message count on the session
        set({
          sessions: state.sessions.map((s) =>
            s.sessionId === event.sessionId
              ? { ...s, messageCount: s.messageCount + 1 }
              : s
          ),
        });
        break;
      }

      case 'agent_spawned': {
        if (event.sessionId === state.activeSessionId) {
          set({
            agents: [...state.agents.filter(
              (a) => a.agentId !== event.agent.agentId
            ), event.agent],
          });
        }
        // Also update the session's agents list
        set({
          sessions: state.sessions.map((s) =>
            s.sessionId === event.sessionId
              ? {
                  ...s,
                  agents: [...s.agents.filter(
                    (a) => a.agentId !== event.agent.agentId
                  ), event.agent],
                }
              : s
          ),
        });
        break;
      }

      case 'agent_message': {
        if (event.sessionId === state.activeSessionId) {
          set({ messages: [...state.messages, event.message] });
          // Increment message count on the agent
          set({
            agents: state.agents.map((a) =>
              a.agentId === event.agentId
                ? { ...a, messageCount: a.messageCount + 1 }
                : a
            ),
          });
        }
        break;
      }

      case 'agent_completed': {
        if (event.sessionId === state.activeSessionId) {
          set({
            agents: state.agents.map((a) =>
              a.agentId === event.agentId
                ? { ...a, status: 'completed' as const }
                : a
            ),
          });
        }
        // Also update the session's agents list
        set({
          sessions: state.sessions.map((s) =>
            s.sessionId === event.sessionId
              ? {
                  ...s,
                  agents: s.agents.map((a) =>
                    a.agentId === event.agentId
                      ? { ...a, status: 'completed' as const }
                      : a
                  ),
                }
              : s
          ),
        });
        break;
      }

      case 'task_update': {
        set({ tasks: event.tasks });
        break;
      }
    }
  },
}));
