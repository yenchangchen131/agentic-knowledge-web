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

    try {
      const result = await uploadFile(file);
      setStatus('success');
      setMessage(`✅ ${result.filename} — ${result.chunks} chunks`);

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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
        ${status === 'idle' ? 'bg-surface-700/50 hover:bg-surface-700 text-slate-300 border border-dashed border-slate-600 hover:border-accent/50' : ''}
        ${status === 'uploading' ? 'bg-accent/10 text-accent-light border border-accent/30' : ''}
        ${status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : ''}
        ${status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : ''}
      `}
    >
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
