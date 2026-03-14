import Anthropic from "@anthropic-ai/sdk";
import { create } from "zustand";
import { SearchEngine } from "@understand-anything/core/search";
import type { SearchResult } from "@understand-anything/core/search";
import type {
  KnowledgeGraph,
  TourStep,
} from "@understand-anything/core/types";

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

  nodeExplanation: string | null;
  nodeExplanationLoading: boolean;
  nodeExplanationCache: Record<string, string>;

  tourActive: boolean;
  currentTourStep: number;
  tourHighlightedNodeIds: string[];

  setGraph: (graph: KnowledgeGraph) => void;
  selectNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setApiKey: (key: string) => void;
  sendChatMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  toggleLayers: () => void;
  explainNode: (nodeId: string) => Promise<void>;

  startTour: () => void;
  stopTour: () => void;
  setTourStep: (step: number) => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
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

function getSortedTour(graph: KnowledgeGraph): TourStep[] {
  return [...graph.tour].sort((a, b) => a.order - b.order);
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

  nodeExplanation: null,
  nodeExplanationLoading: false,
  nodeExplanationCache: {},

  tourActive: false,
  currentTourStep: 0,
  tourHighlightedNodeIds: [],

  setGraph: (graph) => {
    const searchEngine = new SearchEngine(graph.nodes);
    const query = get().searchQuery;
    const searchResults = query.trim() ? searchEngine.search(query) : [];
    set({ graph, searchEngine, searchResults });
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, nodeExplanation: null }),
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

  explainNode: async (nodeId) => {
    const { apiKey, graph, nodeExplanationCache } = get();
    if (!apiKey || !graph) return;

    // Check cache first
    if (nodeExplanationCache[nodeId]) {
      set({ nodeExplanation: nodeExplanationCache[nodeId] });
      return;
    }

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    set({ nodeExplanationLoading: true, nodeExplanation: null });

    try {
      const connections = graph.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId,
      );
      const connDetails = connections
        .map((e) => {
          const isSource = e.source === nodeId;
          const otherId = isSource ? e.target : e.source;
          const otherNode = graph.nodes.find((n) => n.id === otherId);
          return `${isSource ? "->" : "<-"} [${e.type}] ${otherNode?.name ?? otherId}`;
        })
        .join("\n");

      const layer = graph.layers.find((l) => l.nodeIds.includes(nodeId));

      const prompt = [
        `Explain the following code component in plain English. Be thorough but accessible.`,
        ``,
        `**Component:** ${node.name}`,
        `**Type:** ${node.type}`,
        `**File:** ${node.filePath ?? "N/A"}`,
        `**Summary:** ${node.summary}`,
        `**Complexity:** ${node.complexity}`,
        `**Tags:** ${node.tags.join(", ") || "none"}`,
        layer ? `**Layer:** ${layer.name} — ${layer.description}` : "",
        ``,
        `**Connections:**`,
        connDetails || "  none",
        ``,
        `Explain:`,
        `1. What this component does and WHY it exists`,
        `2. How it fits into the larger architecture`,
        `3. Key relationships with other components`,
        `4. Any patterns or concepts worth understanding`,
        ``,
        `Keep the explanation concise (2-4 paragraphs). Use markdown formatting.`,
      ].join("\n");

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text"
          ? response.content[0].text
          : "Unable to generate explanation.";

      set((state) => ({
        nodeExplanation: text,
        nodeExplanationLoading: false,
        nodeExplanationCache: { ...state.nodeExplanationCache, [nodeId]: text },
      }));
    } catch (err) {
      set({
        nodeExplanation: `Error: ${err instanceof Error ? err.message : "Failed to generate explanation"}`,
        nodeExplanationLoading: false,
      });
    }
  },

  startTour: () => {
    const { graph } = get();
    if (!graph || graph.tour.length === 0) return;
    const sorted = getSortedTour(graph);
    set({
      tourActive: true,
      currentTourStep: 0,
      tourHighlightedNodeIds: sorted[0].nodeIds,
      selectedNodeId: null,
    });
  },

  stopTour: () =>
    set({
      tourActive: false,
      currentTourStep: 0,
      tourHighlightedNodeIds: [],
    }),

  setTourStep: (step) => {
    const { graph } = get();
    if (!graph || graph.tour.length === 0) return;
    const sorted = getSortedTour(graph);
    if (step < 0 || step >= sorted.length) return;
    set({
      currentTourStep: step,
      tourHighlightedNodeIds: sorted[step].nodeIds,
    });
  },

  nextTourStep: () => {
    const { graph, currentTourStep } = get();
    if (!graph || graph.tour.length === 0) return;
    const sorted = getSortedTour(graph);
    if (currentTourStep < sorted.length - 1) {
      const next = currentTourStep + 1;
      set({
        currentTourStep: next,
        tourHighlightedNodeIds: sorted[next].nodeIds,
      });
    }
  },

  prevTourStep: () => {
    const { graph, currentTourStep } = get();
    if (!graph || graph.tour.length === 0) return;
    if (currentTourStep > 0) {
      const sorted = getSortedTour(graph);
      const prev = currentTourStep - 1;
      set({
        currentTourStep: prev,
        tourHighlightedNodeIds: sorted[prev].nodeIds,
      });
    }
  },
}));
