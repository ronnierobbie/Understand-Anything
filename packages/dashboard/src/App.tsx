import { useEffect } from "react";
import type { KnowledgeGraph } from "@understand-anything/core";
import { useDashboardStore } from "./store";
import GraphView from "./components/GraphView";
import CodeViewer from "./components/CodeViewer";
import SearchBar from "./components/SearchBar";
import NodeInfo from "./components/NodeInfo";
import ChatPanel from "./components/ChatPanel";
import LayerLegend from "./components/LayerLegend";

function App() {
  const graph = useDashboardStore((s) => s.graph);
  const setGraph = useDashboardStore((s) => s.setGraph);

  useEffect(() => {
    fetch("/knowledge-graph.json")
      .then((res) => res.json())
      .then((data: KnowledgeGraph) => setGraph(data))
      .catch((err) => console.error("Failed to load knowledge graph:", err));
  }, [setGraph]);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800 shrink-0">
        <h1 className="text-sm font-bold tracking-widest text-gray-200">
          UNDERSTAND ANYTHING
        </h1>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {graph && (
            <>
              <span>{graph.project.name}</span>
              <span className="text-gray-600">|</span>
              <span>{nodeCount} nodes</span>
              <span className="text-gray-600">|</span>
              <span>{edgeCount} edges</span>
              <span className="text-gray-600">|</span>
              <LayerLegend />
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar />

      {/* 4-panel grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1 p-1 min-h-0">
        {/* Top-left: Graph View */}
        <div className="min-h-0 min-w-0">
          <GraphView />
        </div>

        {/* Top-right: Code Viewer */}
        <div className="min-h-0 min-w-0">
          <CodeViewer />
        </div>

        {/* Bottom-left: Chat */}
        <div className="min-h-0 min-w-0">
          <ChatPanel />
        </div>

        {/* Bottom-right: Node Info */}
        <div className="min-h-0 min-w-0">
          <NodeInfo />
        </div>
      </div>
    </div>
  );
}

export default App;
