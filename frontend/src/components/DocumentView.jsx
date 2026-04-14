// src/components/DocumentView.jsx
import { useEffect, useState, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Loader2, Clock, HardDrive } from 'lucide-react';
import { fetchDocuments, fetchDocumentContent } from '../lib/api';

// React Error Boundary 防止 Markdown 渲染崩潰時帶走整個畫面
class MarkdownErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-400 bg-red-900/20 rounded-lg border border-red-500/30">
          <p className="font-bold mb-2">Markdown 渲染錯誤</p>
          <pre className="text-xs text-red-300 whitespace-pre-wrap">{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DocumentView() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [content, setContent] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await fetchDocuments();
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDoc(docs[0].filename);
        }
      } catch (err) {
        console.error('載入筆記列表失敗:', err);
      } finally {
        setIsLoadingList(false);
      }
    };
    loadDocs();
  }, []);

  useEffect(() => {
    if (!selectedDoc) return;
    const loadContent = async () => {
      setIsLoadingContent(true);
      try {
        const text = await fetchDocumentContent(selectedDoc);
        setContent(typeof text === 'string' ? text : String(text));
      } catch (err) {
        console.error('載入筆記內容失敗:', err);
        setContent('⚠️ 無法載入筆記內容');
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, [selectedDoc]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="h-full flex gap-3 p-3">
      {/* 左側 Sidebar：檔案列表 */}
      <div className="flex-[20] min-w-[250px] max-w-[320px] glass-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-surface-800/50">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-300">
            <FileText size={16} className="text-accent" />
            已上傳筆記 ({documents.length})
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {isLoadingList && (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin text-accent" />
            </div>
          )}
          {!isLoadingList && documents.length === 0 && (
            <div className="text-sm text-slate-500 text-center p-4">查無筆記記錄</div>
          )}
          {documents.map((doc) => (
            <button
              key={doc.filename}
              onClick={() => setSelectedDoc(doc.filename)}
              className={`
                flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all
                ${selectedDoc === doc.filename 
                  ? 'bg-accent/20 border border-accent/30 text-accent-light' 
                  : 'hover:bg-surface-700/50 text-slate-400 border border-transparent'}
              `}
            >
              <div className="font-semibold text-sm truncate w-full">{doc.filename}</div>
              <div className="flex gap-3 text-[10px] text-slate-500 opacity-80">
                <span className="flex items-center gap-1"><HardDrive size={10}/> {formatSize(doc.size)}</span>
                <span className="flex items-center gap-1"><Clock size={10}/> {formatDate(doc.modified_time)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右側主畫面：Markdown 渲染 */}
      <div className="flex-[80] glass-panel overflow-hidden flex flex-col bg-surface-800/30">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">{selectedDoc || '尚未選擇檔案'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          {isLoadingContent ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-accent" />
            </div>
          ) : content ? (
            <div className="max-w-4xl mx-auto text-slate-300 prose prose-invert prose-sm">
              <MarkdownErrorBoundary>
                <ReactMarkdown>{content}</ReactMarkdown>
              </MarkdownErrorBoundary>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              點擊左側清單來檢視筆記內容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
