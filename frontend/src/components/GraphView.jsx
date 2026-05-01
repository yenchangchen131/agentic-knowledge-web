// src/components/GraphView.jsx
import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { RotateCw } from 'lucide-react';
import useStore from '../store/useStore';
import { expandNode, fetchGraphInit } from '../lib/api';

// 自訂引力 (Gravity)：將所有節點向中心輕微拉扯，防止孤立的子圖或群集漂離太遠
function makeGravityForce(strength = 0.01) {
  let nodes = [];
  const force = (alpha) => {
    for (const node of nodes) {
      if (node.fx != null) continue;
      node.vx -= (node.x || 0) * strength * alpha;
      node.vy -= (node.y || 0) * strength * alpha;
    }
  };
  force.initialize = (n) => { nodes = n; };
  return force;
}

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
  const setGraphData = useStore((s) => s.setGraphData);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const mergeGraphData = useStore((s) => s.mergeGraphData);
  const markNodeExpanded = useStore((s) => s.markNodeExpanded);
  const expandedNodes = useStore((s) => s.expandedNodes);
  const highlightedNodes = useStore((s) => s.highlightedNodes);
  const isGraphLoading = useStore((s) => s.isGraphLoading);
  const theme = useStore((s) => s.theme);

  const fgRef = useRef();
  const containerRef = useRef();
  const hasInitialFit = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // 自適應容器尺寸
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        // 同步更新內部 canvas 尺寸，避免不一致
        if (fgRef.current) {
          if (typeof fgRef.current.width === 'function') fgRef.current.width(width);
          if (typeof fgRef.current.height === 'function') fgRef.current.height(height);
        }
      }
    };
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    // 初始觸發一次
    handleResize();
    return () => observer.disconnect();
  }, []);

  // 重置初始 fit 旗標並設定自然展開的 forces
  useEffect(() => {
    hasInitialFit.current = false;
    const fg = fgRef.current;
    if (!fg) return;

    // 初始強制縮小，讓節點在畫面上慢慢彈開時不會飛出視窗 (看起來太局部)
    fg.zoom(0.7);

    const timer = setTimeout(() => {
      try {
        // 設定較長的連線距離，讓放射狀結構能展開
        fg.d3Force('link')?.distance(60).strength(0.8);
        // 排斥力調小，讓彈開過程變慢、變柔和
        fg.d3Force('charge')?.strength(-120).distanceMax(400);
        // 降低 center force，依賴引力
        fg.d3Force('center')?.strength(0.05);
        // 增強向心引力，讓群跟群之間的距離縮短，且有慢慢收攏的感覺
        fg.d3Force('gravity', makeGravityForce(0.02));

        // 移除前次實作可能留下的自訂 force
        fg.d3Force('bounding', null);
        fg.d3Force('radial', null);
      } catch (_) { }
      fg.d3ReheatSimulation();
    }, 50);
    return () => clearTimeout(timer);
  }, [graphVersion, graphData.nodes.length]);

  // 模擬穩定後第一次自動 fit 全圖
  const handleEngineStop = useCallback(() => {
    if (!hasInitialFit.current && fgRef.current) {
      hasInitialFit.current = true;
      fgRef.current.zoomToFit(400, 80);
    }
  }, []);

  // 高亮節點：reheat 確保重繪，並聚焦到節點群組中心（不改變縮放層級）
  useEffect(() => {
    if (highlightedNodes.size === 0 || !fgRef.current) return;
    fgRef.current.d3ReheatSimulation();
    const timer = setTimeout(() => {
      if (!fgRef.current) return;
      const pts = graphData.nodes.filter((n) => highlightedNodes.has(n.id) && n.x !== undefined);
      if (pts.length === 0) return;
      const cx = pts.reduce((s, n) => s + n.x, 0) / pts.length;
      const cy = pts.reduce((s, n) => s + n.y, 0) / pts.length;
      // 只平移到中心，不改變縮放層級
      fgRef.current.centerAt(cx, cy, 600);
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightedNodes, graphData.nodes]);

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

  const handleRefresh = useCallback(async () => {
    try {
      const data = await fetchGraphInit(500);
      setGraphData(data);
      setSelectedNode(null);
      useStore.getState().clearHighlightedNodes();
      useStore.setState({ expandedNodes: new Set() });

      // 確保重整後能重新觸發自動 fit
      hasInitialFit.current = false;
    } catch (err) {
      console.error('重整圖譜失敗:', err);
    }
  }, [setGraphData, setSelectedNode]);

  const labelColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const linkColor = theme === 'dark' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(71, 85, 105, 0.35)';
  const linkLabelColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.6)' : 'rgba(71, 85, 105, 0.7)';
  const bgColor = theme === 'dark' ? 'transparent' : '#f1f5f9';

  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.id;
    const fontSize = Math.max(13 / globalScale, 4);
    const nodeSize = Math.max(6, Math.min((node.neighbors?.length || 4) * 1.5, 14));
    const color = getNodeColor(node);
    const isHighlighted = highlightedNodes.has(node.id);

    // 高亮脈動光暈
    if (isHighlighted) {
      const pulse = (Math.sin(Date.now() / 400) + 1) / 2; // 0~1
      const ringRadius = nodeSize + 5 + pulse * 5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color + Math.round(pulse * 80 + 20).toString(16).padStart(2, '0');
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    } else {
      // 一般光暈
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 3, 0, 2 * Math.PI);
      ctx.fillStyle = color + '20';
      ctx.fill();
    }

    // 節點本體
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // 已展開標記（外圈）
    if (expandedNodes.has(node.id) && !isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    // 標籤（縮小到一定程度後隱藏）
    if (globalScale > 0.5 || isHighlighted) {
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? color : labelColor;
      ctx.fillText(label, node.x, node.y + nodeSize + 2);
    }
  }, [expandedNodes, highlightedNodes, labelColor]);

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
    <div ref={containerRef} className="w-full h-full relative">
      <ForceGraph2D
        key={graphVersion}
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const size = Math.max(6, Math.min((node.neighbors?.length || 4) * 1.5, 14));
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(12, size + 6), 0, 2 * Math.PI);
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
        warmupTicks={0}
        cooldownTicks={Infinity}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.6}
        backgroundColor={bgColor}
      />
      {/* 重整按鈕 */}
      <button
        onClick={handleRefresh}
        className="absolute top-3 right-3 p-2 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-accent-light hover:border-accent/40 transition-all backdrop-blur-sm"
        title="重整圖譜"
      >
        <RotateCw size={15} />
      </button>
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 dark:text-slate-500 select-none pointer-events-none">
        單擊選取 · 右鍵展開 · 拖拽移動
      </div>
    </div>
  );
}
