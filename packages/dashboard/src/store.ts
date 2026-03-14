import Anthropic from "@anthropic-ai/sdk";
import { create } from "zustand";
import { SearchEngine } from "@understand-anything/core/search";
import type { SearchResult } from "@understand-anything/core/search";
import type { KnowledgeGraph } from "@understand-anything/core/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DashboardStore {
  graph: KnowledgeGraph | null;
  selectedNodeId: string | null;
  searchQuery: string;
  searchResults: SearchResult[];
  searchEngine: SearchEngine | null;

  apiKey: string;
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  showLayers: boolean;

  setGraph: (graph: KnowledgeGraph) => void;
  selectNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setApiKey: (key: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  toggleLayers: () => void;
}

function buildSystemPrompt(
  graph: KnowledgeGraph | null,
  selectedNodeId: string | null,
): string {
  const parts: string[] = [];

  parts.push(
    "You are an expert code assistant for the Understand Anything dashboard. " +
      "You help users understand codebases by answering questions about the project structure, " +
      "code relationships, and architecture. Be concise and helpful.",
  );

  if (graph) {
    const { project, nodes, edges, layers } = graph;
    parts.push(
      `\n## Project: ${project.name}\n` +
        `Description: ${project.description}\n` +
        `Languages: ${project.languages.join(", ")}\n` +
        `Frameworks: ${project.frameworks.join(", ")}\n` +
        `Analyzed at: ${project.analyzedAt}`,
    );

    parts.push(
      `\n## Graph Overview\n` +
        `Nodes: ${nodes.length}\n` +
        `Edges: ${edges.length}\n` +
        `Layers: ${layers.map((l) => l.name).join(", ") || "none"}`,
    );

    // Include a summary of all nodes for context
    const nodeSummaries = nodes
      .map(
        (n) =>
          `- [${n.type}] ${n.name}${n.filePath ? ` (${n.filePath})` : ""}: ${n.summary}`,
      )
      .join("\n");
    parts.push(`\n## All Nodes\n${nodeSummaries}`);

    // Selected node details
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node) {
        const connections = edges.filter(
          (e) => e.source === node.id || e.target === node.id,
        );
        const connDetails = connections
          .map((e) => {
            const isSource = e.source === node.id;
            const otherId = isSource ? e.target : e.source;
            const otherNode = nodes.find((n) => n.id === otherId);
            return `  ${isSource ? "->" : "<-"} [${e.type}] ${otherNode?.name ?? otherId}`;
          })
          .join("\n");

        parts.push(
          `\n## Currently Selected Node\n` +
            `Name: ${node.name}\n` +
            `Type: ${node.type}\n` +
            `Summary: ${node.summary}\n` +
            `File: ${node.filePath ?? "N/A"}\n` +
            `Tags: ${node.tags.join(", ") || "none"}\n` +
            `Complexity: ${node.complexity}\n` +
            `Connections:\n${connDetails || "  none"}`,
        );
      }
    }
  }

  return parts.join("\n");
}

export const useDashboardStore = create<DashboardStore>()((set, get) => ({
  graph: null,
  selectedNodeId: null,
  searchQuery: "",
  searchResults: [],
  searchEngine: null,

  apiKey: "",
  chatMessages: [],
  chatLoading: false,

  showLayers: false,

  setGraph: (graph) => {
    const searchEngine = new SearchEngine(graph.nodes);
    const query = get().searchQuery;
    const searchResults = query.trim() ? searchEngine.search(query) : [];
    set({ graph, searchEngine, searchResults });
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setSearchQuery: (query) => {
    const engine = get().searchEngine;
    if (!engine || !query.trim()) {
      set({ searchQuery: query, searchResults: [] });
      return;
    }
    const searchResults = engine.search(query);
    set({ searchQuery: query, searchResults });
  },

  setApiKey: (key) => {
    localStorage.setItem("ua-api-key", key);
    set({ apiKey: key });
  },

  sendChatMessage: async (message) => {
    const { apiKey, chatMessages, graph, selectedNodeId } = get();
    if (!apiKey || !message.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: message };
    set({
      chatMessages: [...chatMessages, userMessage],
      chatLoading: true,
    });

    try {
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });

      const systemPrompt = buildSystemPrompt(graph, selectedNodeId);

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [...chatMessages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantContent =
        response.content[0].type === "text"
          ? response.content[0].text
          : "Unable to generate a response.";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: assistantContent,
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMessage],
        chatLoading: false,
      }));
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Failed to get response. Please check your API key."}`,
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, errorMessage],
        chatLoading: false,
      }));
    }
  },

  clearChat: () => set({ chatMessages: [] }),

  toggleLayers: () => set((state) => ({ showLayers: !state.showLayers })),
}));
