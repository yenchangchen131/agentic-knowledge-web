import React, { useEffect } from 'react';
import Layout from './components/Layout';
import DocumentView from './components/DocumentView';
import StatsBar from './components/StatsBar';
import { fetchGraphInit, fetchGraphStats } from './lib/api';
import useStore from './store/useStore';
import { Network, BookOpen, Sun, Moon } from 'lucide-react';

function App() {
  const setGraphData = useStore((s) => s.setGraphData);
  const setStats = useStore((s) => s.setStats);
  const setIsGraphLoading = useStore((s) => s.setIsGraphLoading);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  useEffect(() => {
    const loadData = async () => {
      setIsGraphLoading(true);
      try {
        const [graphData, stats] = await Promise.all([
          fetchGraphInit(),
          fetchGraphStats(),
        ]);
        setGraphData(graphData);
        setStats(stats);
      } catch (err) {
        console.error('載入初始資料失敗:', err);
      } finally {
        setIsGraphLoading(false);
      }
    };
    loadData();
  }, [setGraphData, setStats, setIsGraphLoading]);

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">K</span>
            </div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent">
              Agentic Knowledge Web
            </h1>
          </div>

          {/* 分頁按鈕 */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-surface-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-accent text-white shadow-lg'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface-700/50'
              }`}
            >
              <Network size={16} />
              知識圖譜
            </button>
            <button
              onClick={() => setViewMode('document')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'document'
                  ? 'bg-accent text-white shadow-lg'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface-700/50'
              }`}
            >
              <BookOpen size={16} />
              筆記庫
            </button>
          </div>

          <div className="flex items-center gap-3">
            <StatsBar />
            {/* 深/淺主題切換 */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-700 transition-colors"
              title={theme === 'dark' ? '切換淺色主題' : '切換深色主題'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {viewMode === 'graph' ? <Layout /> : <DocumentView />}
      </main>
    </div>
  );
}

export default App;
