import ReactMarkdown from "react-markdown";
import { useDashboardStore } from "../store";

const typeBadgeColors: Record<string, string> = {
  file: "bg-blue-800 text-blue-200",
  function: "bg-green-800 text-green-200",
  class: "bg-purple-800 text-purple-200",
  module: "bg-orange-800 text-orange-200",
  concept: "bg-pink-800 text-pink-200",
};

const complexityBadgeColors: Record<string, string> = {
  simple: "bg-green-700 text-green-200",
  moderate: "bg-yellow-700 text-yellow-200",
  complex: "bg-red-700 text-red-200",
};

export default function NodeInfo() {
  const graph = useDashboardStore((s) => s.graph);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const apiKey = useDashboardStore((s) => s.apiKey);
  const nodeExplanation = useDashboardStore((s) => s.nodeExplanation);
  const nodeExplanationLoading = useDashboardStore(
    (s) => s.nodeExplanationLoading,
  );
  const explainNode = useDashboardStore((s) => s.explainNode);

  const node = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!node) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm">Select a node to see details</p>
      </div>
    );
  }

  const connections = (graph?.edges ?? []).filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  const typeBadge = typeBadgeColors[node.type] ?? typeBadgeColors.file;
  const complexityBadge =
    complexityBadgeColors[node.complexity] ?? complexityBadgeColors.simple;

  return (
    <div className="h-full w-full bg-gray-800 rounded-lg overflow-auto p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${typeBadge}`}
        >
          {node.type}
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${complexityBadge}`}
        >
          {node.complexity}
        </span>
      </div>

      <h2 className="text-lg font-bold text-white mb-2">{node.name}</h2>

      <p className="text-sm text-gray-300 mb-4 leading-relaxed">
        {node.summary}
      </p>

      {node.filePath && (
        <div className="text-xs text-gray-400 mb-2">
          <span className="font-medium text-gray-500">File:</span>{" "}
          {node.filePath}
          {node.lineRange && (
            <span className="ml-2">
              (L{node.lineRange[0]}-{node.lineRange[1]})
            </span>
          )}
        </div>
      )}

      {node.languageNotes && (
        <div className="bg-blue-900/50 border border-blue-700 rounded p-3 mb-4 text-sm text-blue-200">
          {node.languageNotes}
        </div>
      )}

      {apiKey && (
        <div className="mb-4">
          {!nodeExplanation && !nodeExplanationLoading && (
            <button
              onClick={() => explainNode(node.id)}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors"
            >
              Explain This
            </button>
          )}
          {nodeExplanationLoading && (
            <div className="text-xs text-gray-400 animate-pulse">
              Generating explanation...
            </div>
          )}
          {nodeExplanation && (
            <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300 leading-relaxed">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-white">
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code className="bg-gray-900 rounded px-1 py-0.5 text-[11px]">
                      {children}
                    </code>
                  ),
                }}
              >
                {nodeExplanation}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {node.tags.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {connections.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Connections ({connections.length})
          </h3>
          <div className="space-y-1.5">
            {connections.map((edge, i) => {
              const isSource = edge.source === node.id;
              const otherId = isSource ? edge.target : edge.source;
              const otherNode = graph?.nodes.find((n) => n.id === otherId);
              const arrow = isSource ? "\u2192" : "\u2190";

              return (
                <div
                  key={i}
                  className="text-xs bg-gray-700/50 rounded px-2 py-1.5 flex items-center gap-2"
                >
                  <span className="text-gray-400 font-mono">{arrow}</span>
                  <span className="text-gray-400">{edge.type}</span>
                  <span className="text-white truncate">
                    {otherNode?.name ?? otherId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
