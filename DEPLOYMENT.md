# Agentic Knowledge Web 部署指南

這份指南說明了如何將整個系統（React 前端 + FastAPI 後端 + Neo4j + ChromaDB + Ollama）部署到生產環境伺服器上（例如 AWS EC2、GCP 或 VPS）。

目前專案的設計非常適合一體化部署，因為 `main.py` 已設定好自動 serve `frontend/dist` 中的前端靜態檔案，因此只需要對外開放一個後端 Port 即可同時提供 API 與網頁服務。

---

## 階段一：準備環境與基礎設施

1. **基礎軟體安裝**：
   - **Python** (建議 3.10+)：執行 FastAPI 後端。
   - **Node.js** (建議 v18+)：用於編譯打包前端。
   
2. **準備圖形資料庫 (Neo4j)**：
   - **選項 A**：在本機或伺服器安裝 Neo4j Community Edition，或透過 Docker 運行。
   - **選項 B**：使用免費雲端託管的 [Neo4j AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/)（免維護，最推薦）。

3. **準備本機模型 (Ollama) / 可選**：
   - 若使用 Ollama 作為 Embedding 模型（專案預設為 `nomic-embed-text`），需在伺服器上安裝 Ollama。
   - 執行以下指令下載模型：
     ```bash
     ollama pull nomic-embed-text
     ```
   - 若改用 OpenAI API 則無需此步驟，只需在 `.env` 設定金鑰即可。

---

## 階段二：編譯前端打包產物

在伺服器上（或先在本地端編譯好後將 `dist` 傳送至伺服器），將 React 前端專案編譯為靜態檔案：

```bash
cd frontend
npm install
npm run build
```

編譯完成後，會生成 `frontend/dist` 目錄。後端的 `main.py` 會在啟動時偵測此目錄，並將所有網頁路由導向這些靜態檔案。

---

## 階段三：設定後端與啟動

1. **安裝 Python 依賴**：
   回到專案根目錄，安裝所需的套件（使用 `uv` 或 `pip`）：
   ```bash
   uv sync
   # 或 pip install -r requirements.txt
   ```

2. **設定環境變數 (`.env`)**：
   在專案根目錄建立或更新 `.env` 檔案，填寫正確的生產環境資料庫帳密與 API 金鑰：
   ```env
   NEO4J_URI=bolt://localhost:7687  # 或填寫 Neo4j Aura 的 URI
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_secure_password
   
   # 其他相關的 LLM 或 API 金鑰
   ```
   *(註：ChromaDB 會自動在根目錄建立 `chroma_db` 資料夾儲存本機向量資料，不需額外架設伺服器)*

3. **啟動 FastAPI**：
   在生產環境中，切勿使用開發用的 `--reload` 參數。建議使用 `uvicorn` 搭配多行程工作程序（Workers），或使用背景執行：

   ```bash
   # 簡單背景執行方式
   nohup uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 > app.log 2>&1 &
   ```
   *(實務上建議使用 Systemd 設定檔將此指令註冊為系統服務，確保重開機後會自動啟動)*

---

## 階段四：反向代理與網域綁定 (強烈建議)

現在系統已運行在 `http://<伺服器IP>:8000`。為了綁定網域（如 `your-domain.com`）並設定 HTTPS，建議在前端加上 Nginx 作為反向代理 (Reverse Proxy)。

**Nginx 設定檔範例 (`/etc/nginx/sites-available/agentic-web`)**：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 允許較大的檔案上傳 (針對我們的知識庫文檔上傳需求)
        client_max_body_size 50M; 
    }
}
```

設定完成後，建議使用 `certbot` 為該網域申請免費的 Let's Encrypt SSL 憑證。

---

## 未來升級：Docker 容器化部署

若未來需頻繁轉移伺服器，可以考慮撰寫 `Dockerfile` 與 `docker-compose.yml`，將 FastAPI、前端產物、Neo4j 甚至 Ollama 打包為一體，透過 `docker compose up -d` 即可實現一鍵部署。
