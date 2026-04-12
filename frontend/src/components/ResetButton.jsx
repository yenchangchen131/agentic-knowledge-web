// src/components/ResetButton.jsx
import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import { resetDatabase } from '../lib/api';

export default function ResetButton() {
  const resetAll = useStore((s) => s.resetAll);
  const setStats = useStore((s) => s.setStats);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      resetAll();
      setStats({ node_count: 0, relation_count: 0, chunk_count: 0, type_distribution: {} });
    } catch (err) {
      console.error('重置失敗:', err);
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">確定清空所有資料？</span>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="btn-danger flex items-center gap-1 text-xs !py-1.5 !px-3"
        >
          {isResetting ? <Loader2 size={12} className="animate-spin" /> : '確定'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1.5"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded-md hover:bg-red-500/10"
    >
      <Trash2 size={14} />
      重置
    </button>
  );
}
