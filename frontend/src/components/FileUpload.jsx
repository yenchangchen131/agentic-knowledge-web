// src/components/FileUpload.jsx
import { useRef, useState } from 'react';
import { Upload, Check, Loader2, AlertCircle } from 'lucide-react';
import useStore from '../store/useStore';
import { uploadFile, fetchGraphInit, fetchGraphStats } from '../lib/api';

export default function FileUpload() {
  const setGraphData = useStore((s) => s.setGraphData);
  const setStats = useStore((s) => s.setStats);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.md')) {
      setStatus('error');
      setMessage('僅接受 .md 檔案');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setStatus('uploading');
    setMessage(`上傳 ${file.name}...`);
    setProgress(0);
    setTotal(0);

    try {
      const result = await uploadFile(file, (data) => {
        if (data.total > 0) {
          setProgress(data.progress);
          setTotal(data.total);
          setMessage(`處理中... ${data.progress}/${data.total} 區塊`);
        }
      });
      setStatus('success');
      setMessage(`✅ ${result.filename} — ${result.total} chunks (完成)`);

      // 重新載入圖譜與統計
      const [graphData, stats] = await Promise.all([
        fetchGraphInit(),
        fetchGraphStats(),
      ]);
      setGraphData(graphData);
      setStats(stats);

      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setMessage(`❌ ${err.response?.data?.detail || err.message}`);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const StatusIcon = {
    idle: Upload,
    uploading: Loader2,
    success: Check,
    error: AlertCircle,
  }[status];

  const progressPct = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
      className={`
        relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
        ${status === 'idle' ? 'bg-surface-700/50 hover:bg-surface-700 text-slate-300 border border-dashed border-slate-600 hover:border-accent/50' : ''}
        ${status === 'uploading' ? 'bg-accent/10 text-accent-light border border-accent/30' : ''}
        ${status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : ''}
        ${status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : ''}
      `}
    >
      {status === 'uploading' && total > 0 && (
        <div 
          className="absolute left-0 bottom-0 h-1 bg-accent transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      )}
      <StatusIcon size={16} className={status === 'uploading' ? 'animate-spin' : ''} />
      <span className="text-xs">
        {status === 'idle' ? '上傳 .md 檔案' : message}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
