import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CustomNode from "./CustomNode";
import type { CustomFlowNode } from "./CustomNode";
import { useDashboardStore } from "../store";
import { applyDagreLayout } from "../utils/layout";
import { getLayerColor, getLayerBorderColor } from "./LayerLegend";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;
const LAYER_PADDING = 40;

const nodeTypes = { custom: CustomNode };

export default function GraphView() {
  const graph = useDashboardStore((s) => s.graph);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const searchResults = useDashboardStore((s) => s.searchResults);
  const selectNode = useDashboardStore((s) => s.selectNode);
  const showLayers = useDashboardStore((s) => s.showLayers);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph)
      return {
        initialNodes: [] as (CustomFlowNode | Node)[],
        initialEdges: [] as Edge[],
      };

    const flowNodes: CustomFlowNode[] = graph.nodes.map((node) => {
      const matchResult = searchResults.find((r) => r.nodeId === node.id);
      return {
        id: node.id,
        type: "custom" as const,
        position: { x: 0, y: 0 },
        data: {
          label: node.name,
          nodeType: node.type,
          summary: node.summary,
          complexity: node.complexity,
          isHighlighted: !!matchResult,
          searchScore: matchResult?.score,
          isSelected: selectedNodeId === node.id,
        },
      };
    });

    const flowEdges: Edge[] = graph.edges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      label: edge.type,
      animated: edge.type === "calls",
      style: { stroke: "#6b7280", strokeWidth: 1.5 },
      labelStyle: { fill: "#9ca3af", fontSize: 10 },
    }));

    // Run dagre layout on all nodes (without groups)
    const laid = applyDagreLayout(flowNodes, flowEdges);
    const laidNodes = laid.nodes as CustomFlowNode[];

    const layers = graph.layers ?? [];
    if (!showLayers || layers.length === 0) {
      return { initialNodes: laidNodes, initialEdges: laid.edges };
    }

    // Build a map of nodeId -> layer for quick lookup
    const nodeToLayer = new Map<string, string>();
    for (const layer of layers) {
      for (const nodeId of layer.nodeIds) {
        nodeToLayer.set(nodeId, layer.id);
      }
    }

    // Create group nodes and adjust member positions
    const groupNodes: Node[] = [];
    const adjustedNodes: (CustomFlowNode | Node)[] = [];

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const memberNodes = laidNodes.filter((n) =>
        layer.nodeIds.includes(n.id),
      );

      if (memberNodes.length === 0) continue;

      // Compute bounding box around member nodes
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of memberNodes) {
        const x = node.position.x;
        const y = node.position.y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + NODE_WIDTH);
        maxY = Math.max(maxY, y + NODE_HEIGHT);
      }

      // Group node position = top-left with padding
      const groupX = minX - LAYER_PADDING;
      const groupY = minY - LAYER_PADDING - 24; // extra space for label
      const groupWidth = maxX - minX + LAYER_PADDING * 2;
      const groupHeight = maxY - minY + LAYER_PADDING * 2 + 24;

      const bgColor = getLayerColor(layerIdx);
      const borderColor = getLayerBorderColor(layerIdx);

      // Create the group node
      groupNodes.push({
        id: layer.id,
        type: "group",
        position: { x: groupX, y: groupY },
        data: { label: layer.name },
        style: {
          width: groupWidth,
          height: groupHeight,
          backgroundColor: bgColor,
          borderRadius: 12,
          border: `2px dashed ${borderColor}`,
          padding: 8,
          fontSize: 13,
          fontWeight: 600,
          color: borderColor,
        },
      });

      // Adjust member node positions to be relative to the group
      for (const node of memberNodes) {
        adjustedNodes.push({
          ...node,
          parentId: layer.id,
          extent: "parent" as const,
          position: {
            x: node.position.x - groupX,
            y: node.position.y - groupY,
          },
        });
      }
    }

    // Add nodes that are not in any layer (keep original positions)
    for (const node of laidNodes) {
      if (!nodeToLayer.has(node.id)) {
        adjustedNodes.push(node);
      }
    }

    // Group nodes must come before their children in the array
    const allNodes: (CustomFlowNode | Node)[] = [
      ...groupNodes,
      ...adjustedNodes,
    ];

    return { initialNodes: allNodes, initialEdges: laid.edges };
  }, [graph, searchResults, selectedNodeId, showLayers]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      // Ignore clicks on group nodes
      const isGroupNode = graph?.layers?.some((l) => l.id === node.id);
      if (isGroupNode) return;
      selectNode(node.id);
    },
    [selectNode, graph],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  if (!graph) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm">No knowledge graph loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor="#374151"
          maskColor="rgba(0,0,0,0.6)"
          className="!bg-gray-800"
        />
      </ReactFlow>
    </div>
  );
}
