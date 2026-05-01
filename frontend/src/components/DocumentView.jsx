// src/components/DocumentView.jsx
import { useEffect, useState, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Loader2, Clock, HardDrive, FileCode, FileType, Trash2 } from 'lucide-react';
import { fetchDocuments, fetchDocumentContent, deleteDocument, fetchGraphInit, fetchGraphStats, API_BASE } from '../lib/api';
import useStore from '../store/useStore';

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
        <div className="p-4 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-500/30">
          <p className="font-bold mb-2">Markdown 渲染錯誤</p>
          <pre className="text-xs text-red-400 dark:text-red-300 whitespace-pre-wrap">{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const FILE_ICONS = {
  md: FileText,
  txt: FileCode,
  pdf: FileType,
  docx: FileText,
};

export default function DocumentView() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docData, setDocData] = useState(null); // { type, content, url }
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState(null);

  const openDocument = useStore((s) => s.openDocument);
  const setOpenDocument = useStore((s) => s.setOpenDocument);
  const documentsVersion = useStore((s) => s.documentsVersion);
  const setGraphData = useStore((s) => s.setGraphData);
  const setStats = useStore((s) => s.setStats);

  const loadDocs = async () => {
    setIsLoadingList(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDoc) {
        setSelectedDoc(docs[0].filename);
      }
    } catch (err) {
      console.error('載入筆記列表失敗:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => { loadDocs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (documentsVersion > 0) loadDocs(); }, [documentsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // 監聽 openDocument，自動切換到指定文件
  useEffect(() => {
    if (openDocument) {
      setSelectedDoc(openDocument);
      setOpenDocument(null);
    }
  }, [openDocument, setOpenDocument]);

  const handleDelete = async (e, filename) => {
    e.stopPropagation();
    if (!window.confirm(`確定刪除「${filename}」？\n相關圖譜節點與向量資料會同步清除。`)) return;
    setDeletingDoc(filename);
    try {
      await deleteDocument(filename);
      setDocuments((prev) => prev.filter((d) => d.filename !== filename));
      if (selectedDoc === filename) {
        setSelectedDoc(null);
        setDocData(null);
      }
      // 重新整理圖譜
      const [graphData, stats] = await Promise.all([fetchGraphInit(), fetchGraphStats()]);
      setGraphData(graphData);
      setStats(stats);
    } catch (err) {
      console.error('刪除文件失敗:', err);
      alert('刪除失敗，請查看 console');
    } finally {
      setDeletingDoc(null);
    }
  };

  useEffect(() => {
    if (!selectedDoc) return;
    const loadContent = async () => {
      setIsLoadingContent(true);
      setDocData(null);
      try {
        const data = await fetchDocumentContent(selectedDoc);
        setDocData(data);
      } catch (err) {
        console.error('載入文件內容失敗:', err);
        setDocData({ type: 'error', content: '⚠️ 無法載入文件內容', url: null });
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, [selectedDoc]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp) => new Date(timestamp * 1000).toLocaleString();

  const renderContent = () => {
    if (!docData) return null;
    const { type, content, url } = docData;

    if (type === 'pdf') {
      return (
        <iframe
          src={`${API_BASE}${url}`}
          className="w-full h-full rounded border-0"
          title={selectedDoc}
        />
      );
    }

    if (type === 'md') {
      return (
        <div className="max-w-4xl mx-auto prose dark:prose-invert prose-sm text-slate-700 dark:text-slate-300">
          <MarkdownErrorBoundary>
            <ReactMarkdown>{content}</ReactMarkdown>
          </MarkdownErrorBoundary>
        </div>
      );
    }

    // txt / docx / error
    return (
      <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-w-4xl mx-auto">
        {content}
      </pre>
    );
  };

  return (
    <div className="h-full flex gap-3 p-3">
      {/* 左側 Sidebar */}
      <div className="flex-[20] min-w-[220px] max-w-[300px] glass-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-surface-800/50">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-600 dark:text-slate-300">
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
            <div className="text-sm text-slate-400 dark:text-slate-500 text-center p-4">查無記錄</div>
          )}
          {documents.map((doc) => {
            const Icon = FILE_ICONS[doc.type] || FileText;
            const isDeleting = deletingDoc === doc.filename;
            return (
              <div
                key={doc.filename}
                className={`
                  group relative flex items-start gap-1 p-3 rounded-lg transition-all cursor-pointer
                  ${selectedDoc === doc.filename
                    ? 'bg-accent/10 dark:bg-accent/20 border border-accent/30 text-accent-dark dark:text-accent-light'
                    : 'hover:bg-slate-100 dark:hover:bg-surface-700/50 text-slate-600 dark:text-slate-400 border border-transparent'}
                `}
                onClick={() => setSelectedDoc(doc.filename)}
              >
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 w-full">
                    <Icon size={13} className="flex-shrink-0 opacity-60" />
                    <span className="font-medium text-sm truncate">{doc.filename}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] opacity-60 pl-0.5">
                    <span className="flex items-center gap-1"><HardDrive size={10} /> {formatSize(doc.size)}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(doc.modified_time)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, doc.filename)}
                  disabled={isDeleting}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  title="刪除此筆記"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右側主畫面 */}
      <div className="flex-[80] glass-panel overflow-hidden flex flex-col bg-white/30 dark:bg-surface-800/30">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{selectedDoc || '尚未選擇檔案'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          {isLoadingContent ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-accent" />
            </div>
          ) : docData ? (
            docData.type === 'pdf'
              ? <div className="absolute inset-0 p-4">{renderContent()}</div>
              : renderContent()
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
              點擊左側清單來檢視文件內容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
