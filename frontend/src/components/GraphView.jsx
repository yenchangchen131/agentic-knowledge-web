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
  const theme = useStore((s) => s.theme);

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

  // 自訂 D3 forces（只在掛載時執行一次；graphVersion 變化觸發重新掛載時也會重新執行）
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // 稍微延遲，等 ForceGraph2D 初始化完成
    const timer = setTimeout(() => {
      try {
        fg.d3Force('link')?.distance(80).strength(0.5);
        fg.d3Force('charge')?.strength(-180);
        fg.d3Force('center')?.strength(0.05);
      } catch (_) {
        // ForceGraph2D 可能在 warmupTicks 期間還沒有 expose forces
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [graphVersion]);

  const handleNodeClick = useCallback(
    (node) => {
      setSelectedNode(node);
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 500);
        fgRef.current.zoom(2, 500);
      }
    },
    [setSelectedNode]
  );

  const handleNodeRightClick = useCallback(
    async (node) => {
      if (expandedNodes.has(node.id)) return;
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

  // 模擬結束後凍結所有節點，避免展開時擾動已穩定節點
  const handleEngineStop = useCallback(() => {
    graphData.nodes.forEach((node) => {
      if (node.x !== undefined && node.fx === undefined) {
        node.fx = node.x;
        node.fy = node.y;
      }
    });
  }, [graphData.nodes]);

  const labelColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const linkColor = theme === 'dark' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(71, 85, 105, 0.35)';
  const linkLabelColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.6)' : 'rgba(71, 85, 105, 0.7)';
  const bgColor = theme === 'dark' ? 'transparent' : '#f1f5f9';

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

    // 節點本體
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
      ctx.fillStyle = labelColor;
      ctx.fillText(label, node.x, node.y + nodeSize + 3);
    }
  }, [expandedNodes, labelColor]);

  const paintLink = useCallback((link, ctx, globalScale) => {
    const start = link.source;
    const end = link.target;
    if (!start || !end || typeof start.x === 'undefined') return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (globalScale > 1.5 && link.type) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const fontSize = Math.max(8 / globalScale, 2);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = linkLabelColor;
      ctx.fillText(link.type, midX, midY);
    }
  }, [linkColor, linkLabelColor]);

  if (isGraphLoading) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <div className="pulse-dot" style={{ animationDelay: '0s' }} />
            <div className="pulse-dot" style={{ animationDelay: '0.2s' }} />
            <div className="pulse-dot" style={{ animationDelay: '0.4s' }} />
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm">載入圖譜中...</span>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 dark:text-slate-400 text-lg mb-2">📭 尚無圖譜資料</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">請上傳文件以建立知識庫</p>
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
          // 點擊範圍比視覺節點大，讓點擊更容易
          const size = Math.max(4, Math.min(node.neighbors?.length || 3, 12));
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(10, size + 6), 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onBackgroundClick={() => setSelectedNode(null)}
        onEngineStop={handleEngineStop}
        warmupTicks={50}
        cooldownTicks={150}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.4}
        backgroundColor={bgColor}
      />
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 dark:text-slate-500 select-none pointer-events-none">
        單擊選取 · 右鍵展開 · 拖拽移動
      </div>
    </div>
  );
}
