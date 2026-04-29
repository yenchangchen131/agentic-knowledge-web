// src/store/useStore.js
import { create } from 'zustand';

// Apply saved theme on module load (before first render)
const _savedTheme = localStorage.getItem('theme') || 'light';
if (_savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

const useStore = create((set, get) => ({
  // ─── 圖譜狀態 ───
  graphData: { nodes: [], links: [] },
  graphVersion: 0,
  selectedNode: null,
  expandedNodes: new Set(),

  // ─── 視圖狀態 ───
  viewMode: 'graph', // 'graph' | 'document'

  // ─── 主題狀態 ───
  theme: _savedTheme, // 'light' | 'dark'

  // ─── 聊天狀態 ───
  messages: [],
  chatInput: '',
  isChatLoading: false,

  // ─── 全域狀態 ───
  stats: null,
  isGraphLoading: false,

  // ─── 圖譜 Actions ───
  setGraphData: (data) => set((state) => ({
    graphData: {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    },
    graphVersion: state.graphVersion + 1,
  })),

  mergeGraphData: (newData) => {
    const { graphData } = get();
    const existingNodeIds = new Set(graphData.nodes.map((n) => n.id));
    const existingLinkKeys = new Set(
      graphData.links.map((l) => `${l.source?.id || l.source}-${l.target?.id || l.target}-${l.type}`)
    );

    const newNodes = newData.nodes.filter((n) => !existingNodeIds.has(n.id));
    const newLinks = newData.links.filter((l) => {
      const key = `${l.source}-${l.target}-${l.type}`;
      return !existingLinkKeys.has(key);
    });

    set({
      graphData: {
        nodes: [...graphData.nodes, ...newNodes],
        links: [...graphData.links, ...newLinks],
      },
    });
  },

  markNodeExpanded: (nodeName) => {
    const { expandedNodes } = get();
    const updated = new Set(expandedNodes);
    updated.add(nodeName);
    set({ expandedNodes: updated });
  },

  setSelectedNode: (node) => set({ selectedNode: node }),

  // ─── UI Actions ───
  setViewMode: (mode) => set({ viewMode: mode }),

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', next);
    set({ theme: next });
  },

  // ─── 聊天 Actions ───
  setChatInput: (text) => set({ chatInput: text }),
  setIsChatLoading: (v) => set({ isChatLoading: v }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  clearMessages: () => set({ messages: [] }),

  // ─── 全域 Actions ───
  setStats: (stats) => set({ stats }),
  setIsGraphLoading: (v) => set({ isGraphLoading: v }),

  resetAll: () =>
    set({
      graphData: { nodes: [], links: [] },
      selectedNode: null,
      expandedNodes: new Set(),
      messages: [],
      chatInput: '',
      stats: null,
    }),
}));

export default useStore;
