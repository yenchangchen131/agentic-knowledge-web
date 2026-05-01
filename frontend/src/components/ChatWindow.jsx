// src/components/ChatWindow.jsx
import { useRef, useEffect, useState } from 'react';
import { Send, Loader2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import useStore from '../store/useStore';
import { sendChat } from '../lib/api';

export default function ChatWindow() {
  const messages = useStore((s) => s.messages);
  const addMessage = useStore((s) => s.addMessage);
  const chatInput = useStore((s) => s.chatInput);
  const setChatInput = useStore((s) => s.setChatInput);
  const isChatLoading = useStore((s) => s.isChatLoading);
  const setIsChatLoading = useStore((s) => s.setIsChatLoading);
  const setHighlightedNodes = useStore((s) => s.setHighlightedNodes);
  const setOpenDocument = useStore((s) => s.setOpenDocument);
  const setViewMode = useStore((s) => s.setViewMode);
  const isUploading = useStore((s) => s.isUploading);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [localInput, setLocalInput] = useState('');

  useEffect(() => {
    if (chatInput) {
      setLocalInput(chatInput);
      setChatInput('');
      inputRef.current?.focus();
    }
  }, [chatInput, setChatInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const question = localInput.trim();
    if (!question || isChatLoading) return;

    addMessage({ id: Date.now() + '-user', role: 'user', content: question });
    setLocalInput('');
    setIsChatLoading(true);

    try {
      const result = await sendChat(question);
      addMessage({
        id: Date.now() + '-ai',
        role: 'ai',
        content: result.answer,
        extracted_entities: result.extracted_entities || [],
        used_entities: result.used_entities || [],
        numbered_sources: result.numbered_sources || [],
        cited_sources: result.cited_sources || [],
      });
      const allNodes = [...(result.extracted_entities || []), ...(result.used_entities || [])];
      if (allNodes.length > 0) setHighlightedNodes(allNodes);
    } catch (err) {
      addMessage({
        id: Date.now() + '-err',
        role: 'ai',
        content: `❌ 發生錯誤：${err.response?.data?.detail || err.message}`,
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          💬 Agent 聊天室
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm text-center">
              輸入問題開始對話，或點擊節點的「詢問 AI」按鈕
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`fade-in ${msg.role === 'user' ? 'msg-user' : 'msg-ai'}`}
          >
            {msg.role === 'ai' ? (
              <div className="text-sm">
                {/* 答案主體 */}
                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {/* Citation 來源列表 */}
                {msg.cited_sources?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">📎 參考來源：</span>
                      {msg.numbered_sources.map((src, i) => src && (
                        <button
                          key={i}
                          onClick={() => { setOpenDocument(src); setViewMode('document'); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-accent/10 hover:text-accent-light transition-colors"
                          title={src}
                        >
                          <FileText size={10} />
                          <span>[{i + 1}] {src}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm">{msg.content}</span>
            )}
          </div>
        ))}

        {isChatLoading && (
          <div className="msg-ai fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Agent 思考中...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700/50 relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入問題..."
            disabled={isChatLoading || isUploading}
            className="flex-1 min-w-0 bg-slate-100 dark:bg-surface-800 border border-slate-300 dark:border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isChatLoading || isUploading || !localInput.trim()}
            className="btn-accent flex-shrink-0 flex items-center justify-center w-9 h-9 !p-0 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
        {isUploading && (
          <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center cursor-not-allowed">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded">
              資料上傳中，請稍候
            </span>
          </div>
        )}
      </div>
    </>
  );
}
