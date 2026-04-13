// src/store/useStore.js
import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ─── 圖譜狀態 ───
  graphData: { nodes: [], links: [] },
  graphVersion: 0, // 遞增以強制 ForceGraph 重新掛載
  selectedNode: null,
  expandedNodes: new Set(), // 已展開的節點

  // ─── 視圖狀態 ───
  viewMode: 'graph', // 'graph' | 'document'

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
