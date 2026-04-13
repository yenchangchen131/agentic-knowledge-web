// src/components/GraphView.jsx
import { useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useStore from '../store/useStore';
import { expandNode } from '../lib/api';

const NODE_COLORS = {
  '概念': '#6366f1',
  '技術': '#06b6d4',
  '工具': '#f59e0b',
  '人物': '#ec4899',
  'Entity': '#94a3b8',
};

function getNodeColor(node) {
  return NODE_COLORS[node.type] || NODE_COLORS['Entity'];
}

export default function GraphView() {
  const graphData = useStore((s) => s.graphData);
  const graphVersion = useStore((s) => s.graphVersion);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const mergeGraphData = useStore((s) => s.mergeGraphData);
  const markNodeExpanded = useStore((s) => s.markNodeExpanded);
  const expandedNodes = useStore((s) => s.expandedNodes);
  const isGraphLoading = useStore((s) => s.isGraphLoading);

  const fgRef = useRef();
  const containerRef = useRef();

  // 自適應容器尺寸
  useEffect(() => {
    const handleResize = () => {
      if (fgRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (typeof fgRef.current.width === 'function') fgRef.current.width(width);
        if (typeof fgRef.current.height === 'function') fgRef.current.height(height);
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // 單擊：選取節點
  const handleNodeClick = useCallback(
    (node) => {
      setSelectedNode(node);
      // 鏡頭聚焦到節點
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 500);
        fgRef.current.zoom(2, 500);
      }
    },
    [setSelectedNode]
  );

  // 雙擊：展開節點鄰居
  const handleNodeDoubleClick = useCallback(
    async (node) => {
      if (expandedNodes.has(node.id)) return; // 已展開過
      try {
        const result = await expandNode(node.id);
        mergeGraphData(result);
        markNodeExpanded(node.id);
      } catch (err) {
        console.error('展開節點失敗:', err);
      }
    },
    [expandedNodes, mergeGraphData, markNodeExpanded]
  );

  // 自訂節點繪製
  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.id;
    const fontSize = Math.max(12 / globalScale, 3);
    const nodeSize = Math.max(4, Math.min(node.neighbors?.length || 3, 12));
    const color = getNodeColor(node);

    // 光暈效果
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize + 3, 0, 2 * Math.PI);
    ctx.fillStyle = color + '20';
    ctx.fill();

    // 節點
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // 已展開標記（外圈）
    if (expandedNodes.has(node.id)) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    // 標籤
    if (globalScale > 0.8) {
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(label, node.x, node.y + nodeSize + 3);
    }
  }, [expandedNodes]);

  // 自訂連結繪製
  const paintLink = useCallback((link, ctx, globalScale) => {
    const start = link.source;
    const end = link.target;
    if (!start || !end || typeof start.x === 'undefined') return;

    // 線條
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 關係文字
    if (globalScale > 1.5 && link.type) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const fontSize = Math.max(8 / globalScale, 2);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.fillText(link.type, midX, midY);
    }
  }, []);

  if (isGraphLoading) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <div className="pulse-dot" style={{ animationDelay: '0s' }} />
            <div className="pulse-dot" style={{ animationDelay: '0.2s' }} />
            <div className="pulse-dot" style={{ animationDelay: '0.4s' }} />
          </div>
          <span className="text-slate-400 text-sm">載入圖譜中...</span>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-2">📭 尚無圖譜資料</p>
          <p className="text-slate-500 text-sm">請上傳 Markdown 檔案以建立知識庫</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        key={graphVersion}
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const size = Math.max(4, Math.min(node.neighbors?.length || 3, 12));
          ctx.beginPath();
          ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeDoubleClick}
        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onBackgroundClick={() => setSelectedNode(null)}
        cooldownTicks={100}
        backgroundColor="transparent"
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      {/* 雙擊提示 overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500 select-none pointer-events-none">
        單擊選取 · 右鍵展開 · 拖拽移動
      </div>
    </div>
  );
}
