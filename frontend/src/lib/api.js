// src/lib/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 120000, // LLM 回應可能較慢
});

/** 取得初始圖譜資料 */
export async function fetchGraphInit(limit = 150) {
  const { data } = await api.get('/api/graph/init', { params: { limit } });
  return data;
}

/** 展開指定節點的鄰居 */
export async function expandNode(nodeName) {
  const { data } = await api.get(`/api/graph/expand/${encodeURIComponent(nodeName)}`);
  return data;
}

/** 取得圖譜統計 */
export async function fetchGraphStats() {
  const { data } = await api.get('/api/graph/stats');
  return data;
}

/** Agent 聊天 */
export async function sendChat(question) {
  const { data } = await api.post('/api/chat', { question });
  return data;
}

/** 上傳 Markdown 檔案 */
export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/api/ingest', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** 重置資料庫 */
export async function resetDatabase() {
  const { data } = await api.post('/api/reset');
  return data;
}

export default api;
