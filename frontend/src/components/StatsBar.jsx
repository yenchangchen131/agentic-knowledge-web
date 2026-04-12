// src/components/StatsBar.jsx
import { Database, GitBranch, FileText } from 'lucide-react';
import useStore from '../store/useStore';

export default function StatsBar() {
  const stats = useStore((s) => s.stats);

  if (!stats) return null;

  const items = [
    { icon: Database, label: '節點', value: stats.node_count, color: 'text-indigo-400' },
    { icon: GitBranch, label: '關係', value: stats.relation_count, color: 'text-cyan-400' },
    { icon: FileText, label: 'Chunks', value: stats.chunk_count, color: 'text-amber-400' },
  ];

  return (
    <div className="flex items-center gap-3">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="stat-card flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs text-slate-400">{label}</span>
          <span className="text-sm font-semibold text-white">{value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
