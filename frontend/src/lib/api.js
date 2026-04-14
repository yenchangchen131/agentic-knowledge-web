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

/** 上傳 Markdown 檔案並追蹤進度 */
export async function uploadFile(file, onProgress) {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ingest`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk_str = decoder.decode(value, { stream: true });
    // 因為可能是多個 JSON 連在一起被讀取 (NDJSON)
    const lines = chunk_str.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.status === 'error') {
          throw new Error(data.error);
        }
        if (onProgress) {
          onProgress(data);
        }
        if (data.status === 'success') {
          result = data;
        }
      } catch (err) {
        if (err.message !== "Unexpected end of JSON input") {
          // Skip half-parsed lines or re-throw proper errors
          if (err.message !== data?.error) console.error("JSON Parse Error:", err, line);
          else throw err;
        }
      }
    }
  }
  return result;
}

/** 重置資料庫 */
export async function resetDatabase() {
  const { data } = await api.post('/api/reset');
  return data;
}

/** 取得上傳的檔案清單 */
export async function fetchDocuments() {
  const { data } = await api.get('/api/documents');
  return data.documents;
}

/** 取得特定 Markdown 檔案內容 */
export async function fetchDocumentContent(filename) {
  const { data } = await api.get(`/api/documents/${encodeURIComponent(filename)}`, {
    responseType: 'text',
    transformResponse: [(data) => data],  // 不要嘗試 JSON parse
  });
  return data;
}

export default api;
