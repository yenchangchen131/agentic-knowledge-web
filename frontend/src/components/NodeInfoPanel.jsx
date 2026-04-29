// src/components/NodeInfoPanel.jsx
import { Network, Tag, ArrowRight, Bot } from 'lucide-react';
import useStore from '../store/useStore';

export default function NodeInfoPanel() {
  const selectedNode = useStore((s) => s.selectedNode);
  const graphData = useStore((s) => s.graphData);
  const setChatInput = useStore((s) => s.setChatInput);

  if (!selectedNode) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm text-center">
          👆 點擊圖譜中的節點以查看詳細資訊
        </p>
      </div>
    );
  }

  const relatedLinks = graphData.links.filter((l) => {
    const src = l.source?.id || l.source;
    const tgt = l.target?.id || l.target;
    return src === selectedNode.id || tgt === selectedNode.id;
  });

  const relations = relatedLinks.map((l) => {
    const src = l.source?.id || l.source;
    const tgt = l.target?.id || l.target;
    const isOutgoing = src === selectedNode.id;
    return {
      direction: isOutgoing ? 'out' : 'in',
      relType: l.type,
      neighbor: isOutgoing ? tgt : src,
    };
  });

  const handleAskAI = () => {
    const prompt = `請根據知識庫，詳細說明關於「${selectedNode.id}」的資訊，以及它與其他概念的關聯。`;
    setChatInput(prompt);
  };

  const NODE_COLOR_MAP = {
    '概念': 'bg-indigo-500',
    '技術': 'bg-cyan-500',
    '工具': 'bg-amber-500',
    '人物': 'bg-pink-500',
  };

  return (
    <div className="p-4 h-full flex flex-col fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-accent-light" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">節點資訊</h3>
        </div>
        <button
          onClick={handleAskAI}
          className="btn-accent flex items-center gap-1.5 text-xs !py-1.5 !px-3"
        >
          <Bot size={14} />
          詢問 AI
        </button>
      </div>

      <div className="mb-3 pb-3 border-b border-slate-200 dark:border-slate-700/50">
        <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{selectedNode.id}</h4>
        <div className="flex items-center gap-2">
          <Tag size={12} className="text-slate-400 dark:text-slate-400" />
          <span className={`text-xs px-2 py-0.5 rounded-full text-white ${NODE_COLOR_MAP[selectedNode.type] || 'bg-slate-500'}`}>
            {selectedNode.type || 'Entity'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {relations.length} 個關聯
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-1.5">
        {relations.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-xs">無已知的關聯</p>
        ) : (
          relations.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
            >
              <ArrowRight
                size={12}
                className={r.direction === 'out' ? 'text-accent-light' : 'text-cyan-400 rotate-180'}
              />
              <span className="text-slate-500 dark:text-slate-400 min-w-[60px]">{r.relType}</span>
              <span className="text-slate-700 dark:text-slate-200 truncate">{r.neighbor}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
