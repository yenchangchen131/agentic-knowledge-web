// src/App.jsx
import { useEffect } from 'react';
import Layout from './components/Layout';
import StatsBar from './components/StatsBar';
import { fetchGraphInit, fetchGraphStats } from './lib/api';
import useStore from './store/useStore';

function App() {
  const setGraphData = useStore((s) => s.setGraphData);
  const setStats = useStore((s) => s.setStats);
  const setIsGraphLoading = useStore((s) => s.setIsGraphLoading);

  useEffect(() => {
    // 載入初始圖譜資料
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
    <div className="h-full w-full flex flex-col bg-surface-900">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">K</span>
            </div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-accent-light to-purple-400 bg-clip-text text-transparent">
              Agentic Knowledge Web
            </h1>
          </div>
          <StatsBar />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Layout />
      </main>
    </div>
  );
}

export default App;
